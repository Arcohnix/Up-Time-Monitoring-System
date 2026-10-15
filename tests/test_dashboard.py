from datetime import datetime, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.incidents.schemas import IncidentStatus, ServiceState
from app.models.check_result import CheckResultModel
from app.models.incident import IncidentModel
from app.models.service import Service


@pytest.mark.asyncio
async def test_dashboard_empty_database(client: AsyncClient):
    """Test dashboard endpoint when no services or checks exist."""
    response = await client.get("/api/dashboard")
    assert response.status_code == 200
    data = response.json()

    assert data["system_status"] == "SYSTEM ONLINE"
    assert data["overall_uptime_percentage"] == 100.0
    assert data["overall_avg_response_time_ms"] is None
    assert data["total_services"] == 0
    assert data["healthy_services"] == 0
    assert data["degraded_services"] == 0
    assert data["down_services"] == 0
    assert data["services"] == []
    assert data["recent_response_times"] == []
    assert data["active_incidents"] == []


@pytest.mark.asyncio
async def test_dashboard_aggregated_metrics_and_services(
    client: AsyncClient,
    test_session: AsyncSession,
):
    """Test dashboard endpoint with multiple services, check history, and active incident."""
    now = datetime.now(timezone.utc)

    # 1. Create Service 1: API Gateway (Healthy)
    s1 = Service(
        name="API Gateway",
        url="https://api.gateway.internal/health",
        http_method="GET",
        check_interval_seconds=30,
        timeout_seconds=5,
        is_active=True,
        current_state=ServiceState.HEALTHY.value,
        consecutive_failures=0,
        failure_threshold=3,
    )
    test_session.add(s1)

    # 2. Create Service 2: Auth API (Down)
    s2 = Service(
        name="Auth API",
        url="https://auth.internal/health",
        http_method="GET",
        check_interval_seconds=15,
        timeout_seconds=5,
        is_active=True,
        current_state=ServiceState.DOWN.value,
        consecutive_failures=3,
        failure_threshold=3,
    )
    test_session.add(s2)
    await test_session.commit()

    # Add Check Results for Service 1 (both successful, 40ms and 60ms -> avg 50ms, 100% uptime)
    c1 = CheckResultModel(service_id=s1.id, checked_at=now, success=True, status_code=200, response_time_ms=40.0)
    c2 = CheckResultModel(service_id=s1.id, checked_at=now, success=True, status_code=200, response_time_ms=60.0)
    test_session.add_all([c1, c2])

    # Add Check Result for Service 2 (failure, 0% uptime)
    c3 = CheckResultModel(service_id=s2.id, checked_at=now, success=False, status_code=500, response_time_ms=10.0, error_type="HTTP_STATUS")
    test_session.add(c3)

    # Add active incident for Service 2
    inc = IncidentModel(
        service_id=s2.id,
        status=IncidentStatus.OPEN.value,
        started_at=now,
        failure_count=3,
        last_error_type="HTTP_STATUS",
        last_error_message="500 Internal Server Error",
    )
    test_session.add(inc)
    await test_session.commit()

    # Query GET /api/dashboard
    response = await client.get("/api/dashboard")
    assert response.status_code == 200
    data = response.json()

    assert data["total_services"] == 2
    assert data["healthy_services"] == 1
    assert data["down_services"] == 1
    assert data["system_status"] == "PARTIAL OUTAGE"

    # Overall: 2 successful out of 3 total = 66.67%
    assert data["overall_uptime_percentage"] == 66.67
    # Overall latency: (40 + 60) / 2 = 50.0ms
    assert data["overall_avg_response_time_ms"] == 50.0

    # Service 1 assertions
    s1_data = next(s for s in data["services"] if s["id"] == s1.id)
    assert s1_data["name"] == "API Gateway"
    assert s1_data["uptime_percentage"] == 100.0
    assert s1_data["avg_response_time_ms"] == 50.0
    assert s1_data["current_state"] == "HEALTHY"
    assert s1_data["total_checks"] == 2

    # Service 2 assertions
    s2_data = next(s for s in data["services"] if s["id"] == s2.id)
    assert s2_data["name"] == "Auth API"
    assert s2_data["uptime_percentage"] == 0.0
    assert s2_data["current_state"] == "DOWN"
    assert s2_data["total_checks"] == 1

    # Incidents assertion
    assert len(data["active_incidents"]) == 1
    assert data["active_incidents"][0]["service_id"] == s2.id
    assert data["active_incidents"][0]["status"] == "OPEN"

    # Recent response times assertion
    assert len(data["recent_response_times"]) == 3

    # Also test /api/v1/dashboard
    v1_response = await client.get("/api/v1/dashboard")
    assert v1_response.status_code == 200
    assert v1_response.json()["total_services"] == 2
