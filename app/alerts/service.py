import asyncio
import logging
from typing import Dict, List, Optional

from app.alerts.base import AlertEvent, BaseNotificationProvider
from app.alerts.providers.email import EmailNotificationProvider
from app.alerts.providers.webhook import WebhookNotificationProvider
from app.core.config import settings as app_settings

logger = logging.getLogger("utms.alerts.service")


class AlertService:
    """Service coordinator responsible for dispatching alerts across all configured notification providers."""

    def __init__(self, providers: Optional[List[BaseNotificationProvider]] = None):
        self._providers: Dict[str, BaseNotificationProvider] = {}
        if providers:
            for provider in providers:
                self.register_provider(provider)

    def register_provider(self, provider: BaseNotificationProvider) -> None:
        """Register a notification provider."""
        self._providers[provider.name] = provider
        logger.debug("Registered notification provider '%s' (enabled=%s)", provider.name, provider.is_enabled)

    def remove_provider(self, name: str) -> Optional[BaseNotificationProvider]:
        """Remove a notification provider by name."""
        return self._providers.pop(name, None)

    def get_provider(self, name: str) -> Optional[BaseNotificationProvider]:
        """Retrieve a registered provider by name."""
        return self._providers.get(name)

    @property
    def providers(self) -> List[BaseNotificationProvider]:
        """List all registered providers."""
        return list(self._providers.values())

    @property
    def enabled_providers(self) -> List[BaseNotificationProvider]:
        """List all currently active and configured providers."""
        return [p for p in self._providers.values() if p.is_enabled]

    async def dispatch(self, event: AlertEvent) -> Dict[str, bool]:
        """Dispatch an alert event to all enabled providers concurrently.

        Guarantees that:
        1. All enabled providers execute concurrently without waiting on each other.
        2. Delivery failures in one provider never prevent or disrupt others.
        3. Any internal error is safely caught and logged without raising exceptions.
        """
        active_providers = self.enabled_providers
        if not active_providers:
            logger.debug(
                "No notification providers enabled; skipped dispatch for event %s (incident #%s)",
                event.event_type.value,
                event.incident_id,
            )
            return {}

        logger.info(
            "Dispatching alert %s for incident #%s (service '%s') to %d provider(s): %s",
            event.event_type.value,
            event.incident_id,
            event.service_name,
            len(active_providers),
            [p.name for p in active_providers],
        )

        async def _safe_send(provider: BaseNotificationProvider) -> bool:
            try:
                success = await provider.send(event)
                try:
                    from app.core.metrics import record_notification_outcome
                    record_notification_outcome(provider.name, event.event_type.value, bool(success))
                except Exception:
                    pass
                return bool(success)
            except Exception as exc:
                logger.error(
                    "Unexpected exception from provider '%s' during alert dispatch: %s",
                    provider.name,
                    exc,
                    exc_info=True,
                )
                try:
                    from app.core.metrics import record_notification_outcome
                    record_notification_outcome(provider.name, event.event_type.value, False)
                except Exception:
                    pass
                return False

        tasks = [_safe_send(provider) for provider in active_providers]
        results = await asyncio.gather(*tasks, return_exceptions=False)

        outcome: Dict[str, bool] = {}
        for provider, success in zip(active_providers, results):
            outcome[provider.name] = bool(success)

        succeeded = [name for name, success in outcome.items() if success]
        failed = [name for name, success in outcome.items() if not success]

        logger.info(
            "Alert dispatch complete for incident #%s: %d succeeded (%s), %d failed (%s)",
            event.incident_id,
            len(succeeded),
            succeeded,
            len(failed),
            failed,
        )

        return outcome


# Global singleton instance
_global_alert_service: Optional[AlertService] = None


def get_alert_service(
    webhook_url: Optional[str] = None,
    webhook_enabled: Optional[bool] = None,
    webhook_timeout: Optional[float] = None,
    email_enabled: Optional[bool] = None,
    smtp_host: Optional[str] = None,
    smtp_port: Optional[int] = None,
    smtp_user: Optional[str] = None,
    smtp_password: Optional[str] = None,
    use_tls: Optional[bool] = None,
    from_address: Optional[str] = None,
    to_addresses: Optional[str] = None,
) -> AlertService:
    """Retrieve or construct the global AlertService instance initialized from environment configuration."""
    global _global_alert_service
    if _global_alert_service is None:
        service = AlertService()

        # Webhook provider setup
        wh_url = webhook_url if webhook_url is not None else app_settings.ALERT_WEBHOOK_URL
        wh_enabled = webhook_enabled if webhook_enabled is not None else app_settings.ALERT_WEBHOOK_ENABLED
        wh_timeout = webhook_timeout if webhook_timeout is not None else app_settings.ALERT_WEBHOOK_TIMEOUT_SECONDS

        webhook_provider = WebhookNotificationProvider(
            url=wh_url,
            enabled=wh_enabled,
            timeout_seconds=wh_timeout,
        )
        service.register_provider(webhook_provider)

        # Email provider setup
        em_enabled = email_enabled if email_enabled is not None else app_settings.ALERT_EMAIL_ENABLED
        em_host = smtp_host if smtp_host is not None else app_settings.ALERT_EMAIL_SMTP_HOST
        em_port = smtp_port if smtp_port is not None else app_settings.ALERT_EMAIL_SMTP_PORT
        em_user = smtp_user if smtp_user is not None else app_settings.ALERT_EMAIL_SMTP_USER
        em_pass = smtp_password if smtp_password is not None else app_settings.ALERT_EMAIL_SMTP_PASSWORD
        em_tls = use_tls if use_tls is not None else app_settings.ALERT_EMAIL_USE_TLS
        em_from = from_address if from_address is not None else app_settings.ALERT_EMAIL_FROM
        em_to = to_addresses if to_addresses is not None else app_settings.ALERT_EMAIL_TO

        email_provider = EmailNotificationProvider(
            smtp_host=em_host,
            smtp_port=em_port,
            smtp_user=em_user,
            smtp_password=em_pass,
            use_tls=em_tls,
            from_address=em_from,
            to_addresses=em_to,
            enabled=em_enabled,
        )
        service.register_provider(email_provider)

        _global_alert_service = service

    return _global_alert_service


def reset_alert_service() -> None:
    """Reset global alert service instance (for testing)."""
    global _global_alert_service
    _global_alert_service = None
