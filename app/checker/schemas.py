from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, computed_field


class ErrorType(str, Enum):
    """Categorized error types for probe failures."""
    TIMEOUT = "TIMEOUT"
    CONNECTION_ERROR = "CONNECTION_ERROR"
    HTTP_STATUS = "HTTP_STATUS"
    UNEXPECTED_ERROR = "UNEXPECTED_ERROR"


class CheckResult(BaseModel):
    """Structured result produced by a single health check execution."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: Optional[int] = Field(None, description="Check result ID if persisted in storage")
    service_id: int = Field(..., description="ID of the monitored service")
    checked_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        validation_alias=AliasChoices("checked_at", "timestamp"),
        description="Timestamp when check was executed",
    )
    success: bool = Field(..., description="Whether the check succeeded")
    status_code: Optional[int] = Field(None, description="HTTP status code received")
    response_time_ms: Optional[float] = Field(None, description="Response latency in milliseconds")
    error_type: Optional[str] = Field(None, description="Error category if check failed")
    error_message: Optional[str] = Field(None, description="Detailed error explanation")

    @computed_field
    @property
    def timestamp(self) -> datetime:
        """Backwards compatibility alias for checked_at."""
        return self.checked_at


class ServiceSummary(BaseModel):
    """Aggregated health, uptime, and latency summary for a monitored service."""
    model_config = ConfigDict(from_attributes=True)

    service_id: int = Field(..., description="ID of the monitored service")
    service_name: str = Field(..., description="Name of the monitored service")
    uptime_percentage: float = Field(..., description="Percentage of successful checks (0.0 to 100.0)")
    avg_response_time_ms: Optional[float] = Field(None, description="Average response time in ms for successful checks")
    total_checks: int = Field(..., description="Total number of checks in evaluation window")
    successful_checks: int = Field(..., description="Number of successful checks")
    failed_checks: int = Field(..., description="Number of failed checks")
    start_time: Optional[datetime] = Field(None, description="Start timestamp of evaluation window")
    end_time: Optional[datetime] = Field(None, description="End timestamp of evaluation window")
