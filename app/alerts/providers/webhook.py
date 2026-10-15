import logging
import time
from typing import Dict, Optional
import httpx

from app.alerts.base import AlertEvent, BaseNotificationProvider

logger = logging.getLogger("utms.alerts.webhook")


class WebhookNotificationProvider(BaseNotificationProvider):
    """Notification provider that delivers alerts via HTTP POST webhooks."""

    def __init__(
        self,
        url: Optional[str] = None,
        enabled: bool = True,
        timeout_seconds: float = 10.0,
        headers: Optional[Dict[str, str]] = None,
        client: Optional[httpx.AsyncClient] = None,
    ):
        self._url = url
        self._enabled = enabled
        self._timeout_seconds = timeout_seconds
        self._headers = headers or {"Content-Type": "application/json", "User-Agent": "UTMS-Alerts/1.0"}
        self._client = client

    @property
    def name(self) -> str:
        return "webhook"

    @property
    def is_enabled(self) -> bool:
        return self._enabled and bool(self._url)

    @property
    def url(self) -> Optional[str]:
        return self._url

    async def send(self, event: AlertEvent) -> bool:
        """Deliver the alert event as a JSON POST request to the webhook URL."""
        if not self.is_enabled:
            logger.debug("Webhook provider is disabled or URL is missing; skipping alert.")
            return False

        payload = event.to_dict()
        start_time = time.perf_counter()
        owns_client = self._client is None

        logger.info(
            "Sending webhook alert: url=%s event_type=%s incident_id=%s service_id=%s",
            self._url,
            event.event_type.value,
            event.incident_id,
            event.service_id,
        )

        try:
            client = self._client or httpx.AsyncClient(timeout=self._timeout_seconds)
            try:
                response = await client.post(
                    self._url,  # type: ignore[arg-type]
                    json=payload,
                    headers=self._headers,
                )
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

                if 200 <= response.status_code < 300:
                    logger.info(
                        "Webhook alert delivered successfully: url=%s status=%s latency=%.2fms",
                        self._url,
                        response.status_code,
                        latency_ms,
                    )
                    return True
                else:
                    logger.warning(
                        "Webhook alert failed with HTTP %s: url=%s response_preview=%.120s latency=%.2fms",
                        response.status_code,
                        self._url,
                        response.text,
                        latency_ms,
                    )
                    return False
            finally:
                if owns_client:
                    await client.aclose()

        except httpx.TimeoutException as exc:
            logger.warning(
                "Webhook alert timed out after %.1fs: url=%s error=%s",
                self._timeout_seconds,
                self._url,
                exc,
            )
            return False

        except (httpx.ConnectError, httpx.NetworkError) as exc:
            logger.warning(
                "Webhook alert network connection failed: url=%s error=%s",
                self._url,
                exc,
            )
            return False

        except Exception as exc:
            logger.error(
                "Unexpected error during webhook delivery: url=%s error=%s",
                self._url,
                exc,
                exc_info=True,
            )
            return False
