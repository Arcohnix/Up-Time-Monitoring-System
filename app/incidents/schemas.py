from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class IncidentStatus(str, Enum):
    """Lifecycle status of an incident."""
    OPEN = "OPEN"
    RESOLVED = "RESOLVED"


class ServiceState(str, Enum):
    """Operational health state of a monitored service."""
    HEALTHY = "HEALTHY"
    FAILING = "FAILING"  # Experiencing failures below threshold (DEGRADED)
    DOWN = "DOWN"        # Reached failure threshold, active incident open
    RECOVERED = "RECOVERED"


class IncidentResponse(BaseModel):
    """Detailed representation of an incident record."""
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="Unique incident ID")
    service_id: int = Field(..., description="ID of the impacted service")
    status: str = Field(..., description="Incident status (OPEN, RESOLVED)")
    started_at: datetime = Field(..., description="Timestamp when outage/incident began")
    resolved_at: Optional[datetime] = Field(None, description="Timestamp when service recovered")
    failure_count: int = Field(..., description="Consecutive failure count recorded for incident")
    last_error_type: Optional[str] = Field(None, description="Error classification from last failure")
    last_error_message: Optional[str] = Field(None, description="Error details from last failure")
    last_status_code: Optional[int] = Field(None, description="HTTP status code from last failure")
    last_failed_at: Optional[datetime] = Field(None, description="Timestamp of most recent failure")
    recovery_message: Optional[str] = Field(None, description="Recovery explanation upon resolution")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime = Field(..., description="Record update timestamp")
