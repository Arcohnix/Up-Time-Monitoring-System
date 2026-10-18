import asyncio
from email.message import EmailMessage
import logging
import smtplib
from typing import Callable, List, Optional, Union

from app.alerts.base import AlertEvent, BaseNotificationProvider

logger = logging.getLogger("utms.alerts.email")


class EmailNotificationProvider(BaseNotificationProvider):
    """Notification provider that delivers alerts via SMTP email."""

    def __init__(
        self,
        smtp_host: Optional[str] = None,
        smtp_port: int = 587,
        smtp_user: Optional[str] = None,
        smtp_password: Optional[str] = None,
        use_tls: bool = True,
        from_address: str = "alerts@utms.local",
        to_addresses: Optional[Union[List[str], str]] = None,
        enabled: bool = True,
        sender_fn: Optional[Callable[[EmailMessage], None]] = None,
    ):
        self._smtp_host = smtp_host.strip() if smtp_host else None
        self._smtp_port = smtp_port
        self._smtp_user = smtp_user.strip() if smtp_user else None
        if smtp_password:
            cleaned_pwd = smtp_password.strip()
            if len(cleaned_pwd.replace(" ", "")) == 16:
                cleaned_pwd = cleaned_pwd.replace(" ", "")
            self._smtp_password = cleaned_pwd
        else:
            self._smtp_password = None
        self._use_tls = use_tls
        self._from_address = from_address.strip() if from_address else "alerts@utms.local"
        self._enabled = enabled
        self._sender_fn = sender_fn

        # Normalize to_addresses to a list of non-empty strings
        if isinstance(to_addresses, str):
            self._to_addresses = [addr.strip() for addr in to_addresses.split(",") if addr.strip()]
        elif isinstance(to_addresses, list):
            self._to_addresses = [addr.strip() for addr in to_addresses if addr.strip()]
        else:
            self._to_addresses = []

    @property
    def name(self) -> str:
        return "email"

    @property
    def is_enabled(self) -> bool:
        return self._enabled and bool(self._smtp_host) and bool(self._to_addresses)

    @property
    def to_addresses(self) -> List[str]:
        return self._to_addresses

    def _send_smtp_sync(self, msg: EmailMessage) -> None:
        """Internal synchronous SMTP sending function executed in a worker thread."""
        with smtplib.SMTP(self._smtp_host, self._smtp_port, timeout=10) as server:  # type: ignore[arg-type]
            if self._use_tls:
                server.starttls()
            if self._smtp_user and self._smtp_password:
                server.login(self._smtp_user, self._smtp_password)
            server.send_message(msg)

    async def send(self, event: AlertEvent) -> bool:
        """Construct and send an email alert asynchronously without blocking the event loop."""
        if not self.is_enabled:
            logger.debug("Email provider is disabled or missing host/recipients; skipping alert.")
            return False

        msg = EmailMessage()
        msg["Subject"] = event.format_subject()
        msg["From"] = self._from_address
        msg["To"] = ", ".join(self._to_addresses)
        msg.set_content(event.format_message())

        logger.info(
            "Sending email alert: host=%s:%d to=%s event_type=%s incident_id=%s",
            self._smtp_host,
            self._smtp_port,
            self._to_addresses,
            event.event_type.value,
            event.incident_id,
        )

        try:
            if self._sender_fn:
                await asyncio.to_thread(self._sender_fn, msg)
            else:
                await asyncio.to_thread(self._send_smtp_sync, msg)

            logger.info(
                "Email alert delivered successfully to %s: subject='%s'",
                self._to_addresses,
                msg["Subject"],
            )
            return True

        except (smtplib.SMTPException, OSError) as exc:
            logger.warning(
                "SMTP error delivering email alert: host=%s to=%s error=%s",
                self._smtp_host,
                self._to_addresses,
                exc,
            )
            return False

        except Exception as exc:
            logger.error(
                "Unexpected error during email delivery: host=%s to=%s error=%s",
                self._smtp_host,
                self._to_addresses,
                exc,
                exc_info=True,
            )
            return False
