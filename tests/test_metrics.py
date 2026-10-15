import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.checker.runner import check_service
from app.core.metrics import (
    record_check_result,
    record_incident_opened,
    record_incident_resolved,
    record_notification_outcome,
    record_scheduler_tick,
    set_scheduler_running,
    update_service_counts,
)
from app.models.service import Service


@pytest.mark.asyncio
async def test_metrics_endpoint_exposition(client: AsyncClient):
    """Verify that GET /metrics returns HTTP 200 and Prometheus exposition format."""
    response = await client.get("/metrics")
    assert response.status_code == 200
    assert "text/plain" in response.headers.get("content-type", "")

    body = response.text
    # Check that core UTMS metrics are exposed
    assert "utms_monitored_services_total" in body
    assert "utms_checks_total" in body
    assert "utms_checks_success_total" in body
    assert "utms_checks_failed_total" in body
    assert "utms_check_duration_seconds" in body
    assert "utms_active_incidents" in body
    assert "utms_active_incidents_total" in body
    assert "utms_incidents_created_total" in body
    assert "utms_incidents_recovered_total" in body
    assert "utms_notification_failures_total" in body
    assert "utms_notifications_sent_total" in body
    assert "utms_scheduler_running" in body
    assert "utms_scheduler_ticks_total" in body
    assert "utms_api_requests_total" in body
    assert "utms_api_request_duration_seconds" in body


@pytest.mark.asyncio
async def test_api_request_metrics_recorded(client: AsyncClient):
    """Verify that API requests are automatically recorded by PrometheusMiddleware."""
    # Send a request to /health
    health_res = await client.get("/health")
    assert health_res.status_code == 200

    # Scrape /metrics
    metrics_res = await client.get("/metrics")
    assert metrics_res.status_code == 200
    body = metrics_res.text

    # The /health endpoint should be captured in utms_api_requests_total
    assert 'utms_api_requests_total{endpoint="/health",method="GET",status_code="200"}' in body


@pytest.mark.asyncio
async def test_metric_helper_functions_and_check_recording(test_session: AsyncSession):
    """Verify metric helper functions and integration with check execution."""
    # Test helper functions
    update_service_counts(enabled=5, disabled=2)
    set_scheduler_running(True)
    record_scheduler_tick(in_flight_count=1)
    record_incident_opened("TestSvc")
    record_incident_resolved("TestSvc")
    record_notification_outcome("webhook", "INCIDENT_CREATED", True)
    record_notification_outcome("email", "INCIDENT_CREATED", False)
    record_check_result("TestSvc", "GET", True, 45.2, None)
    record_check_result("TestSvc", "GET", False, 120.0, "TIMEOUT")

    # Verify check_service triggers metric updates safely
    service = Service(
        name="Metrics Probe Target",
        url="https://metrics-probe.local",
        http_method="GET",
        check_interval_seconds=30,
        timeout_seconds=5,
        is_active=True,
    )
    test_session.add(service)
    await test_session.commit()
    await test_session.refresh(service)

    # Execute check_service with mock transport
    import httpx

    transport = httpx.MockTransport(lambda req: httpx.Response(200, text="OK"))
    async with httpx.AsyncClient(transport=transport) as mock_client:
        res = await check_service(service, client=mock_client, db=test_session, persist=True)
        assert res.success is True
