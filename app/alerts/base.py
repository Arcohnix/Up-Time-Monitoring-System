from abc import ABC, abstractmethod
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class AlertEventType(str, Enum):
    INCIDENT_CREATED = "incident_created"
    INCIDENT_RESOLVED = "incident_resolved"


class AlertEvent(BaseModel):
    """Structured event payload describing an incident transition."""
    event_type: AlertEventType
    incident_id: int
    service_id: int
    service_name: str
    service_url: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    failure_count: int = 1
    error_type: Optional[str] = None
    error_message: Optional[str] = None
    status_code: Optional[int] = None
    recovery_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Serialize event to a JSON-compatible dictionary."""
        return {
            "event_type": self.event_type.value,
            "incident_id": self.incident_id,
            "service_id": self.service_id,
            "service_name": self.service_name,
            "service_url": self.service_url,
            "timestamp": self.timestamp.isoformat(),
            "failure_count": self.failure_count,
            "error_type": self.error_type,
            "error_message": self.error_message,
            "status_code": self.status_code,
            "recovery_message": self.recovery_message,
        }

    def format_subject(self) -> str:
        """Construct a concise, human-readable subject line for notifications."""
        if self.event_type == AlertEventType.INCIDENT_CREATED:
            return f"[ALERT] Incident #{self.incident_id}: {self.service_name} is DOWN"
        else:
            return f"[RESOLVED] Incident #{self.incident_id}: {self.service_name} has RECOVERED"

    def format_message(self) -> str:
        """Construct a formatted text body for notifications."""
        if self.event_type == AlertEventType.INCIDENT_CREATED:
            return (
                f"ALERT: Service Outage Detected\n"
                f"-------------------------------\n"
                f"Service: {self.service_name}\n"
                f"URL: {self.service_url}\n"
                f"Incident ID: #{self.incident_id}\n"
                f"Consecutive Failures: {self.failure_count}\n"
                f"Status Code: {self.status_code or 'N/A'}\n"
                f"Error Type: {self.error_type or 'N/A'}\n"
                f"Error Details: {self.error_message or 'Unknown error'}\n"
                f"Timestamp: {self.timestamp.isoformat()}\n"
            )
        else:
            return (
                f"RESOLVED: Service Outage Cleared\n"
                f"--------------------------------\n"
                f"Service: {self.service_name}\n"
                f"URL: {self.service_url}\n"
                f"Incident ID: #{self.incident_id}\n"
                f"Status Code: {self.status_code or 'N/A'}\n"
                f"Resolution: {self.recovery_message or 'Service has recovered'}\n"
                f"Resolved At: {self.timestamp.isoformat()}\n"
            )


class BaseNotificationProvider(ABC):
    """Abstract base provider for delivering notification alerts."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique provider identifier."""
        ...

    @property
    @abstractmethod
    def is_enabled(self) -> bool:
        """Whether this provider is currently active and configured."""
        ...

    @abstractmethod
    async def send(self, event: AlertEvent) -> bool:
        """Deliver the alert event. Must return True on success, False on failure.

        Must handle any internal exceptions gracefully and never raise.
        """
        ...
