from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ErrorType(str, Enum):
    """Categorized error types for probe failures."""
    TIMEOUT = "TIMEOUT"
    CONNECTION_ERROR = "CONNECTION_ERROR"
    HTTP_STATUS = "HTTP_STATUS"
    UNEXPECTED_ERROR = "UNEXPECTED_ERROR"


class CheckResult(BaseModel):
    """Structured result produced by a single health check execution."""
    model_config = ConfigDict(from_attributes=True)

    service_id: int = Field(..., description="ID of the monitored service")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp when check was executed",
    )
    success: bool = Field(..., description="Whether the check succeeded")
    status_code: Optional[int] = Field(None, description="HTTP status code received")
    response_time_ms: Optional[float] = Field(None, description="Response latency in milliseconds")
    error_type: Optional[str] = Field(None, description="Error category if check failed")
    error_message: Optional[str] = Field(None, description="Detailed error explanation")
