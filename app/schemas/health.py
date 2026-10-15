from typing import Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(..., description="Overall service status (e.g., healthy, degraded)")
    app: str = Field(..., description="Application name")
    environment: str = Field(..., description="Current running environment")
    version: str = Field(..., description="Application version")
    database: Optional[str] = Field(None, description="Database connection status (connected, unreachable)")
