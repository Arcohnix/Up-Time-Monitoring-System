"""Lightweight External Watchdog mechanism to verify monitoring system self-health.

Decoupled from the primary monitoring worker and API processes to ensure reliable
outage detection even if the monitoring service crashes, deadlocks, or OOM-terminates.
"""

import asyncio
import logging
import time
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Callable, Dict, Optional, Tuple

import httpx

from watchdog.config import WatchdogConfig, get_watchdog_config

logger = logging.getLogger("utms.watchdog")


class WatchdogState(str, Enum):
    """External watchdog evaluation state."""

    HEALTHY = "HEALTHY"
    DOWN = "DOWN"


class WatchdogAlertEventType(str, Enum):
    """Watchdog alert notification types."""

    MONITORING_SYSTEM_DOWN = "MONITORING_SYSTEM_DOWN"
    MONITORING_SYSTEM_RECOVERED = "MONITORING_SYSTEM_RECOVERED"


@dataclass
class WatchdogCheckResult:
    """Result of an individual watchdog self-health probe."""

    success: bool
    status_code: Optional[int]
    response_time_ms: float
    api_alive: bool
    scheduler_running: bool
    worker_alive: bool
    error_message: Optional[str] = None
    timestamp: float = field(default_factory=time.time)
    details: Dict = field(default_factory=dict)


@dataclass
class WatchdogAlertEvent:
    """Outage or recovery alert event emitted by the external watchdog."""

    event_type: str
    target_url: str
    timestamp: float
    consecutive_failures: int
    error_message: str
    details: Dict = field(default_factory=dict)


class ExternalWatchdog:
    """External watchdog service that independently probes the monitoring system."""

    def __init__(
        self,
        config: Optional[WatchdogConfig] = None,
        alert_callback: Optional[Callable[[WatchdogAlertEvent], None]] = None,
    ):
        self.config = config or get_watchdog_config()
        self.alert_callback = alert_callback

        # Internal state tracking
        self.state: WatchdogState = WatchdogState.HEALTHY
        self.consecutive_failures: int = 0
        self.last_check_timestamp: Optional[float] = None
        self.last_check_result: Optional[WatchdogCheckResult] = None
        self.last_error: Optional[str] = None

    async def probe_once(self, client: Optional[httpx.AsyncClient] = None) -> WatchdogCheckResult:
        """Perform an independent HTTP probe verifying API availability and worker heartbeat."""
        should_close = False
        if client is None:
            client = httpx.AsyncClient()
            should_close = True

        start_time = time.perf_counter()
        probe_url = (
            f"{self.config.target_url}/health/heartbeat"
            f"?stale_threshold={self.config.heartbeat_stale_threshold_seconds}"
        )
        timeout = httpx.Timeout(self.config.timeout_seconds)

        try:
            response = await client.get(probe_url, timeout=timeout)
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            status_code = response.status_code

            if status_code != 200:
                error_msg = f"Heartbeat returned HTTP status {status_code}"
                try:
                    data = response.json()
                except Exception:
                    data = {"raw_response": response.text[:200]}

                return WatchdogCheckResult(
                    success=False,
                    status_code=status_code,
                    response_time_ms=elapsed_ms,
                    api_alive=(status_code != 503),
                    scheduler_running=data.get("scheduler_running", False),
                    worker_alive=data.get("worker_alive", False),
                    error_message=error_msg,
                    details=data,
                )

            data = response.json()
            api_alive = bool(data.get("api_alive", False))
            scheduler_running = bool(data.get("scheduler_running", False))
            worker_alive = bool(data.get("worker_alive", False))

            if not api_alive:
                error_msg = "API reported not alive"
                success = False
            elif not scheduler_running:
                error_msg = "Monitoring scheduler is stopped or not running"
                success = False
            elif not worker_alive:
                sec_since = data.get("seconds_since_last_heartbeat")
                error_msg = f"Monitoring worker heartbeat is stale ({sec_since}s ago; worker may be frozen or crashed)"
                success = False
            else:
                error_msg = None
                success = True

            return WatchdogCheckResult(
                success=success,
                status_code=status_code,
                response_time_ms=elapsed_ms,
                api_alive=api_alive,
                scheduler_running=scheduler_running,
                worker_alive=worker_alive,
                error_message=error_msg,
                details=data,
            )

        except httpx.TimeoutException:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return WatchdogCheckResult(
                success=False,
                status_code=None,
                response_time_ms=elapsed_ms,
                api_alive=False,
                scheduler_running=False,
                worker_alive=False,
                error_message=f"Connection timed out after {self.config.timeout_seconds}s (monitoring service unresponsive)",
            )

        except (httpx.ConnectError, httpx.NetworkError) as net_exc:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return WatchdogCheckResult(
                success=False,
                status_code=None,
                response_time_ms=elapsed_ms,
                api_alive=False,
                scheduler_running=False,
                worker_alive=False,
                error_message=f"Connection failed to {self.config.target_url}: {str(net_exc) or type(net_exc).__name__}",
            )

        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return WatchdogCheckResult(
                success=False,
                status_code=None,
                response_time_ms=elapsed_ms,
                api_alive=False,
                scheduler_running=False,
                worker_alive=False,
                error_message=f"Unexpected error probing monitoring system: {type(exc).__name__}: {str(exc)}",
            )

        finally:
            if should_close:
                await client.aclose()

    def evaluate(self, result: WatchdogCheckResult) -> Optional[WatchdogAlertEvent]:
        """Evaluate check result against consecutive failure thresholds and state transitions."""
        self.last_check_timestamp = result.timestamp
        self.last_check_result = result

        if result.success:
            if self.state == WatchdogState.DOWN:
                # Recovery transition: system was DOWN and has now recovered
                logger.info(
                    "WATCHDOG: Monitoring service has recovered at %s after %d consecutive failures.",
                    self.config.target_url,
                    self.consecutive_failures,
                )
                alert = WatchdogAlertEvent(
                    event_type=WatchdogAlertEventType.MONITORING_SYSTEM_RECOVERED.value,
                    target_url=self.config.target_url,
                    timestamp=result.timestamp,
                    consecutive_failures=self.consecutive_failures,
                    error_message="Monitoring service restored and responsive",
                    details=result.details,
                )
                self.state = WatchdogState.HEALTHY
                self.consecutive_failures = 0
                self.last_error = None
                return alert
            else:
                self.consecutive_failures = 0
                self.last_error = None
                return None

        # Failure condition
        self.consecutive_failures += 1
        self.last_error = result.error_message

        logger.warning(
            "WATCHDOG: Health probe failed (%d/%d): %s",
            self.consecutive_failures,
            self.config.failure_threshold,
            result.error_message,
        )

        if self.consecutive_failures >= self.config.failure_threshold:
            if self.state != WatchdogState.DOWN:
                # Outage transition: reached threshold, declare system DOWN
                self.state = WatchdogState.DOWN
                logger.critical(
                    "WATCHDOG CRITICAL: Monitoring system at %s is DOWN! (consecutive_failures=%d, reason=%s)",
                    self.config.target_url,
                    self.consecutive_failures,
                    result.error_message,
                )
                return WatchdogAlertEvent(
                    event_type=WatchdogAlertEventType.MONITORING_SYSTEM_DOWN.value,
                    target_url=self.config.target_url,
                    timestamp=result.timestamp,
                    consecutive_failures=self.consecutive_failures,
                    error_message=result.error_message or "Monitoring system unreachable",
                    details=result.details,
                )
            else:
                # Already DOWN: ongoing failure, do not spam duplicate alerts
                logger.warning(
                    "WATCHDOG: Monitoring system remains DOWN (failure #%d)",
                    self.consecutive_failures,
                )
                return None

        return None

    async def dispatch_alert(
        self,
        alert: WatchdogAlertEvent,
        client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        """Dispatch watchdog alert via webhook and structured notification handlers."""
        # Execute optional in-memory callback if provided (useful for tests and plugins)
        if self.alert_callback:
            try:
                self.alert_callback(alert)
            except Exception as cb_exc:
                logger.error("Error in watchdog alert callback: %s", cb_exc, exc_info=True)

        if not self.config.alert_webhook_url:
            return

        should_close = False
        if client is None:
            client = httpx.AsyncClient()
            should_close = True

        try:
            payload = {
                "source": "UTMS_WATCHDOG",
                "alert": asdict(alert),
            }
            res = await client.post(
                self.config.alert_webhook_url,
                json=payload,
                timeout=5.0,
            )
            if 200 <= res.status_code < 300:
                logger.info(
                    "WATCHDOG: Dispatched alert %s to webhook %s (HTTP %s)",
                    alert.event_type,
                    self.config.alert_webhook_url,
                    res.status_code,
                )
            else:
                logger.error(
                    "WATCHDOG: Webhook returned HTTP %s on alert dispatch: %s",
                    res.status_code,
                    res.text[:200],
                )
        except Exception as alert_err:
            logger.error(
                "WATCHDOG: Failed to deliver alert webhook to %s: %s",
                self.config.alert_webhook_url,
                alert_err,
            )
        finally:
            if should_close:
                await client.aclose()

    async def tick(
        self,
        client: Optional[httpx.AsyncClient] = None,
    ) -> Tuple[WatchdogCheckResult, Optional[WatchdogAlertEvent]]:
        """Run a single watchdog evaluation cycle."""
        result = await self.probe_once(client=client)
        alert = self.evaluate(result)
        if alert:
            await self.dispatch_alert(alert, client=client)
        return result, alert

    async def run_forever(self) -> None:
        """Run the external watchdog loop indefinitely."""
        logger.info(
            "Starting External Watchdog: target=%s, interval=%.1fs, threshold=%d, stale_threshold=%.1fs",
            self.config.target_url,
            self.config.check_interval_seconds,
            self.config.failure_threshold,
            self.config.heartbeat_stale_threshold_seconds,
        )

        async with httpx.AsyncClient() as client:
            try:
                while True:
                    await self.tick(client=client)
                    await asyncio.sleep(self.config.check_interval_seconds)
            except asyncio.CancelledError:
                logger.info("Watchdog service received cancellation signal; stopping cleanly.")
            except Exception as loop_exc:
                logger.error("Unexpected error in watchdog execution loop: %s", loop_exc, exc_info=True)
