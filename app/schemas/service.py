from datetime import datetime
from typing import Optional
from urllib.parse import urlparse
from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    computed_field,
    field_validator,
    model_validator,
)

VALID_HTTP_METHODS = {"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"}


def validate_http_url(v: str) -> str:
    url_str = str(v).strip()
    parsed = urlparse(url_str)
    if parsed.scheme.lower() not in ("http", "https"):
        raise ValueError("URL scheme must be http or https")
    if not parsed.netloc:
        raise ValueError("URL must include a valid host or domain")
    return url_str


class ServiceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Service display name")
    url: str = Field(..., max_length=2048, description="Target HTTP/HTTPS URL")
    http_method: str = Field(default="GET", description="HTTP method for health checks")
    check_interval_seconds: int = Field(
        default=60,
        gt=0,
        validation_alias=AliasChoices("check_interval_seconds", "check_interval"),
        description="Check interval in seconds (positive integer)",
    )
    timeout_seconds: int = Field(
        default=10,
        gt=0,
        validation_alias=AliasChoices("timeout_seconds", "timeout"),
        description="Timeout in seconds (positive integer, max 120s)",
    )
    expected_status_code: int = Field(
        default=200,
        ge=100,
        le=599,
        description="Expected HTTP status code (100-599)",
    )
    is_active: bool = Field(
        default=True,
        validation_alias=AliasChoices("is_active", "is_enabled", "enabled"),
        description="Whether active monitoring is enabled",
    )

    @field_validator("url")
    @classmethod
    def check_url(cls, v: str) -> str:
        return validate_http_url(v)

    @field_validator("http_method")
    @classmethod
    def check_http_method(cls, v: str) -> str:
        method = v.strip().upper()
        if method not in VALID_HTTP_METHODS:
            raise ValueError(f"HTTP method must be one of: {', '.join(sorted(VALID_HTTP_METHODS))}")
        return method

    @model_validator(mode="after")
    def validate_timeout_and_interval(self) -> "ServiceBase":
        if self.timeout_seconds > self.check_interval_seconds:
            raise ValueError("Timeout cannot exceed the check interval")
        if self.timeout_seconds > 120:
            raise ValueError("Timeout cannot exceed 120 seconds")
        return self


class ServiceCreate(ServiceBase):
    """Schema for registering a new monitored service."""
    pass


class ServiceUpdate(BaseModel):
    """Schema for updating an existing monitored service."""
    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    url: Optional[str] = Field(None, max_length=2048)
    http_method: Optional[str] = None
    check_interval_seconds: Optional[int] = Field(
        None,
        gt=0,
        validation_alias=AliasChoices("check_interval_seconds", "check_interval"),
    )
    timeout_seconds: Optional[int] = Field(
        None,
        gt=0,
        validation_alias=AliasChoices("timeout_seconds", "timeout"),
    )
    expected_status_code: Optional[int] = Field(None, ge=100, le=599)
    is_active: Optional[bool] = Field(
        None,
        validation_alias=AliasChoices("is_active", "is_enabled", "enabled"),
    )

    @field_validator("url")
    @classmethod
    def check_url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_http_url(v)
        return v

    @field_validator("http_method")
    @classmethod
    def check_http_method(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            method = v.strip().upper()
            if method not in VALID_HTTP_METHODS:
                raise ValueError(f"HTTP method must be one of: {', '.join(sorted(VALID_HTTP_METHODS))}")
            return method
        return v

    @model_validator(mode="after")
    def validate_timeout_and_interval(self) -> "ServiceUpdate":
        if self.timeout_seconds is not None and self.timeout_seconds > 120:
            raise ValueError("Timeout cannot exceed 120 seconds")
        if self.timeout_seconds is not None and self.check_interval_seconds is not None:
            if self.timeout_seconds > self.check_interval_seconds:
                raise ValueError("Timeout cannot exceed the check interval")
        return self


class ServiceResponse(BaseModel):
    """Schema for monitored service representation in API responses."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    name: str
    url: str
    http_method: str
    check_interval_seconds: int
    timeout_seconds: int
    expected_status_code: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def enabled(self) -> bool:
        return self.is_active

    @computed_field
    @property
    def check_interval(self) -> int:
        return self.check_interval_seconds

    @computed_field
    @property
    def timeout(self) -> int:
        return self.timeout_seconds
