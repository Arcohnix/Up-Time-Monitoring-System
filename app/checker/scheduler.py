import asyncio
import logging
import time
from typing import Dict, Optional, Set

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.checker.runner import check_service
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.service import Service

logger = logging.getLogger("utms.scheduler")


class MonitoringScheduler:
    """Continuous asynchronous health check scheduler.

    Monitors enabled services concurrently while respecting each service's configured
    check interval, preventing overlapping checks on the same service, and isolating
    slow or failing endpoints.
    """

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
        client: Optional[httpx.AsyncClient] = None,
        tick_interval: float = 1.0,
        max_concurrency: int = 50,
    ) -> None:
        self.session_factory = session_factory
        self.client = client
        self._owned_client = False
        self.tick_interval = tick_interval
        self.max_concurrency = max_concurrency
        self.semaphore = asyncio.Semaphore(max_concurrency)

        self._running: bool = False
        self._loop_task: Optional[asyncio.Task[None]] = None
        self._in_flight: Set[int] = set()
        self._last_checked: Dict[int, float] = {}
        self._active_tasks: Set[asyncio.Task[None]] = set()

        # Heartbeat tracking for self-health and external watchdog monitoring
        self._last_heartbeat: Optional[float] = None
        self._ticks_count: int = 0

    @property
    def is_running(self) -> bool:
        """Return True if the scheduler loop is actively running."""
        return self._running

    async def start(self) -> None:
        """Start the monitoring scheduler background task."""
        if self._running:
            logger.warning("Scheduler start requested but it is already running")
            return

        logger.info(
            "Scheduler starting: tick_interval=%.2fs, max_concurrency=%d",
            self.tick_interval,
            self.max_concurrency,
        )

        if self.client is None:
            self.client = httpx.AsyncClient()
            self._owned_client = True

        self._running = True
        self._last_heartbeat = time.time()
        self._loop_task = asyncio.create_task(self._run_loop(), name="monitoring-scheduler-loop")
        try:
            from app.core.metrics import set_scheduler_running
            set_scheduler_running(True)
        except Exception:
            pass
        logger.info("Scheduler startup complete")

    async def stop(self, timeout: float = 5.0) -> None:
        """Gracefully stop the scheduler and wait for active probe tasks to drain."""
        if not self._running:
            return

        logger.info("Scheduler shutdown initiated")
        self._running = False
        try:
            from app.core.metrics import set_scheduler_running
            set_scheduler_running(False)
        except Exception:
            pass

        # Cancel the tick loop
        if self._loop_task and not self._loop_task.done():
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass

        # Drain any running check tasks with a timeout
        if self._active_tasks:
            logger.info("Draining %d active check tasks (timeout=%.1fs)...", len(self._active_tasks), timeout)
            try:
                await asyncio.wait_for(
                    asyncio.gather(*self._active_tasks, return_exceptions=True),
                    timeout=timeout,
                )
            except asyncio.TimeoutError:
                logger.warning("Timed out waiting for check tasks to drain; forcing cancellation")
                for task in self._active_tasks:
                    task.cancel()

        # Close client if owned
        if self._owned_client and self.client is not None:
            await self.client.aclose()
            self.client = None
            self._owned_client = False

        self._in_flight.clear()
        self._active_tasks.clear()
        logger.info("Scheduler shutdown complete")

    async def _run_loop(self) -> None:
        """Continuous scheduler loop running periodic ticks."""
        try:
            while self._running:
                await self.tick()
                await asyncio.sleep(self.tick_interval)
        except asyncio.CancelledError:
            logger.debug("Scheduler loop task cancelled")
        except Exception as exc:
            logger.error("Unexpected exception in scheduler loop: %s", exc, exc_info=True)

    async def tick(self) -> None:
        """Execute a single evaluation pass: query enabled services and dispatch due checks."""
        # Update heartbeat and tick telemetry
        self._ticks_count += 1
        self._last_heartbeat = time.time()

        try:
            async with self.session_factory() as db:
                stmt = select(Service)
                result = await db.execute(stmt)
                all_services = list(result.scalars().all())
                enabled_services = [s for s in all_services if s.is_active]
                disabled_services = [s for s in all_services if not s.is_active]

                try:
                    from app.core.metrics import record_scheduler_tick, update_service_counts
                    update_service_counts(enabled=len(enabled_services), disabled=len(disabled_services))
                    record_scheduler_tick(in_flight_count=len(self._in_flight))
                except Exception:
                    pass
        except Exception as db_exc:
            logger.error("Unexpected exception querying enabled services in scheduler tick: %s", db_exc, exc_info=True)
            return

        now = time.monotonic()

        for srv in enabled_services:
            # Rule: Avoid overlapping checks for the same service
            if srv.id in self._in_flight:
                logger.debug("Check skipped for service %s: existing check still in-flight", srv.id)
                continue

            # Rule: Each service respects its configured interval
            last_time = self._last_checked.get(srv.id)
            if last_time is None:
                is_due = True
            else:
                elapsed = now - last_time
                is_due = elapsed >= srv.check_interval_seconds

            if is_due:
                self._in_flight.add(srv.id)
                self._last_checked[srv.id] = now
                task = asyncio.create_task(
                    self._execute_service_check(srv),
                    name=f"check-service-{srv.id}",
                )
                self._active_tasks.add(task)
                task.add_done_callback(self._active_tasks.discard)

    async def _execute_service_check(self, srv: Service) -> None:
        """Worker task to execute and persist a single service check bounded by semaphore."""
        async with self.semaphore:
            logger.info(
                "Check started: service_id=%s name='%s' url=%s method=%s interval=%ds timeout=%ds",
                srv.id,
                srv.name,
                srv.url,
                srv.http_method,
                srv.check_interval_seconds,
                srv.timeout_seconds,
            )

            try:
                async with self.session_factory() as db:
                    result = await check_service(
                        service=srv,
                        client=self.client,
                        db=db,
                        persist=True,
                    )

                if result.success:
                    logger.info(
                        "Check completed: service_id=%s name='%s' success=true status=%s latency=%.2fms",
                        srv.id,
                        srv.name,
                        result.status_code,
                        result.response_time_ms or 0.0,
                    )
                else:
                    logger.warning(
                        "Check failed: service_id=%s name='%s' success=false error_type=%s error_message='%s' latency=%.2fms",
                        srv.id,
                        srv.name,
                        result.error_type,
                        result.error_message,
                        result.response_time_ms or 0.0,
                    )

            except Exception as exc:
                logger.error(
                    "Unexpected exception during check for service %s: %s",
                    srv.id,
                    exc,
                    exc_info=True,
                )

            finally:
                self._in_flight.discard(srv.id)

    def get_heartbeat(self, stale_threshold_seconds: float = 30.0) -> dict:
        """Evaluate worker heartbeat freshness and activity telemetry."""
        now = time.time()
        seconds_since = (now - self._last_heartbeat) if self._last_heartbeat else None
        worker_alive = bool(
            self._running
            and self._last_heartbeat is not None
            and seconds_since is not None
            and seconds_since <= stale_threshold_seconds
        )
        return {
            "scheduler_running": self._running,
            "worker_alive": worker_alive,
            "last_heartbeat_timestamp": self._last_heartbeat,
            "seconds_since_last_heartbeat": round(seconds_since, 2) if seconds_since is not None else None,
            "ticks_count": self._ticks_count,
            "in_flight_checks": len(self._in_flight),
            "stale_threshold_seconds": stale_threshold_seconds,
        }


# Global singleton scheduler instance
_global_scheduler: Optional[MonitoringScheduler] = None


def get_scheduler(
    session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
    tick_interval: Optional[float] = None,
    max_concurrency: Optional[int] = None,
) -> MonitoringScheduler:
    """Retrieve or create the application's global monitoring scheduler instance."""
    global _global_scheduler
    if _global_scheduler is None:
        _global_scheduler = MonitoringScheduler(
            session_factory=session_factory,
            tick_interval=tick_interval or settings.SCHEDULER_TICK_INTERVAL_SECONDS,
            max_concurrency=max_concurrency or settings.SCHEDULER_MAX_CONCURRENCY,
        )
    return _global_scheduler


def get_scheduler_heartbeat(stale_threshold_seconds: float = 30.0) -> dict:
    """Retrieve heartbeat status from the global scheduler singleton."""
    global _global_scheduler
    if _global_scheduler is None:
        return {
            "scheduler_running": False,
            "worker_alive": False,
            "last_heartbeat_timestamp": None,
            "seconds_since_last_heartbeat": None,
            "ticks_count": 0,
            "in_flight_checks": 0,
            "stale_threshold_seconds": stale_threshold_seconds,
        }
    return _global_scheduler.get_heartbeat(stale_threshold_seconds=stale_threshold_seconds)

