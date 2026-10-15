from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from app.incidents.schemas import IncidentResponse


class DashboardServiceItem(BaseModel):
    id: int
    name: str
    url: str
    http_method: str
    check_interval_seconds: int
    timeout_seconds: int
    is_active: bool
    current_state: str
    uptime_percentage: float
    avg_response_time_ms: Optional[float] = None
    total_checks: int
    successful_checks: int
    failed_checks: int
    consecutive_failures: int
    failure_threshold: int
    last_status_code: Optional[int] = None
    last_checked_at: Optional[datetime] = None


class LatencyPoint(BaseModel):
    id: int
    service_id: int
    service_name: Optional[str] = None
    timestamp: datetime
    response_time_ms: Optional[float] = None
    success: bool
    status_code: Optional[int] = None


class DashboardOverview(BaseModel):
    system_status: str
    overall_uptime_percentage: float
    overall_avg_response_time_ms: Optional[float] = None
    total_services: int
    healthy_services: int
    degraded_services: int
    down_services: int
    services: List[DashboardServiceItem]
    recent_response_times: List[LatencyPoint]
    active_incidents: List[IncidentResponse]
