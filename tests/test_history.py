from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock
import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.checker.runner import check_all_enabled_services, check_service
from app.models.check_result import CheckResultModel
from app.models.service import Service


@pytest.mark.asyncio
async def test_check_service_persists_to_database(test_session: AsyncSession):
    """Verify that completed checks are stored in PostgreSQL/database."""
    # Create service
    service = Service(
        name="DB Persistence Test",
        url="https://persist-test.com/health",
        http_method="GET",
        check_interval_seconds=60,
        timeout_seconds=5,
        expected_status_code=200,
        is_active=True,
    )
    test_session.add(service)
    await test_session.commit()
    await test_session.refresh(service)

    # Execute check with mock HTTP client
    transport = httpx.MockTransport(lambda req: httpx.Response(200, json={"status": "ok"}))
    async with httpx.AsyncClient(transport=transport) as client:
        result = await check_service(
            service=service,
            client=client,
            db=test_session,
            persist=True,
        )

        assert result.id is not None
        assert result.success is True
        assert result.status_code == 200

        # Verify record exists in check_results table
        db_record = await test_session.get(CheckResultModel, result.id)
        assert db_record is not None
        assert db_record.service_id == service.id
        assert db_record.success is True
        assert db_record.status_code == 200
        assert db_record.response_time_ms is not None
        assert db_record.checked_at is not None


@pytest.mark.asyncio
async def test_db_persistence_failure_handled_safely():
    """Verify that database persistence failure is caught and does not crash the monitoring process."""
    service = Service(
        id=42,
        name="DB Failure Test",
        url="https://safe-test.com/ping",
        timeout_seconds=5,
    )

    # Create mock session where commit throws an exception
    mock_db = AsyncMock(spec=AsyncSession)
    mock_db.commit.side_effect = RuntimeError("Database disk full / connection dropped")

    transport = httpx.MockTransport(lambda req: httpx.Response(200))
    async with httpx.AsyncClient(transport=transport) as client:
        # Must NOT raise exception despite database failure
        result = await check_service(
            service=service,
            client=client,
            db=mock_db,
            persist=True,
        )

        assert result.success is True
        assert result.status_code == 200
        assert result.service_id == 42
        mock_db.rollback.assert_awaited()


@pytest.mark.asyncio
async def test_check_all_persists_every_result(test_session: AsyncSession):
    """Verify check_all_enabled_services persists every check and isolates failures."""
    s1 = Service(name="S1", url="https://s1.com", is_active=True, timeout_seconds=5)
    s2 = Service(name="S2", url="https://s2.com", is_active=True, timeout_seconds=5)
    test_session.add_all([s1, s2])
    await test_session.commit()

    transport = httpx.MockTransport(lambda req: httpx.Response(200))
    async with httpx.AsyncClient(transport=transport) as client:
        results = await check_all_enabled_services(
            db=test_session,
            client=client,
            persist=True,
        )

        assert len(results) == 2
        assert all(r.id is not None for r in results)

        records = (
            await test_session.execute(select(CheckResultModel).order_by(CheckResultModel.id.asc()))
        ).scalars().all()
        assert len(records) == 2


@pytest.mark.asyncio
async def test_get_service_checks_endpoint_filtering_and_pagination(client: AsyncClient, test_session: AsyncSession):
    """Verify GET /api/services/{id}/checks filtering by status, time range, and pagination."""
    # Create service
    created = await client.post("/api/services", json={"name": "History API Target", "url": "https://history.com"})
    service_id = created.json()["id"]

    now = datetime.now(timezone.utc)

    # Insert 6 check records directly: 4 successful, 2 failed
    for i in range(6):
        record = CheckResultModel(
            service_id=service_id,
            checked_at=now - timedelta(minutes=i * 10),
            success=(i % 3 != 0),  # i=0,3 False; i=1,2,4,5 True (4 true, 2 false)
            status_code=200 if (i % 3 != 0) else 500,
            response_time_ms=25.0 + i,
        )
        test_session.add(record)
    await test_session.commit()

    # 1. Retrieve all checks (default limit 100)
    res_all = await client.get(f"/api/services/{service_id}/checks")
    assert res_all.status_code == 200
    all_data = res_all.json()
    assert len(all_data) == 6

    # 2. Filter by success=true
    res_succ = await client.get(f"/api/services/{service_id}/checks?success=true")
    assert res_succ.status_code == 200
    succ_data = res_succ.json()
    assert len(succ_data) == 4
    assert all(item["success"] is True for item in succ_data)

    # 3. Filter by success=false
    res_fail = await client.get(f"/api/services/{service_id}/checks?success=false")
    assert res_fail.status_code == 200
    fail_data = res_fail.json()
    assert len(fail_data) == 2
    assert all(item["success"] is False for item in fail_data)

    # 4. Pagination: limit=2, skip=2
    res_page = await client.get(f"/api/services/{service_id}/checks?skip=2&limit=2")
    assert res_page.status_code == 200
    page_data = res_page.json()
    assert len(page_data) == 2

    # 5. Time range filtering
    start_filter = (now - timedelta(minutes=25)).isoformat()
    res_time = await client.get(
        f"/api/services/{service_id}/checks",
        params={"start_time": start_filter},
    )
    assert res_time.status_code == 200
    time_data = res_time.json()
    # Should include i=0 (0m), i=1 (10m), i=2 (20m)
    assert len(time_data) == 3


@pytest.mark.asyncio
async def test_get_service_summary_calculation(client: AsyncClient, test_session: AsyncSession):
    """Verify calculation of uptime percentage, average latency, and check counts."""
    # Create service
    created = await client.post("/api/services", json={"name": "Summary Target", "url": "https://summary.com"})
    service_id = created.json()["id"]

    now = datetime.now(timezone.utc)

    # Insert 8 successful checks (latencies 10, 20, 30, 40, 50, 60, 70, 80 -> avg = 45.0ms)
    for latency in [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0]:
        rec = CheckResultModel(
            service_id=service_id,
            checked_at=now - timedelta(minutes=5),
            success=True,
            status_code=200,
            response_time_ms=latency,
        )
        test_session.add(rec)

    # Insert 2 failed checks
    for _ in range(2):
        rec = CheckResultModel(
            service_id=service_id,
            checked_at=now - timedelta(minutes=2),
            success=False,
            status_code=500,
            response_time_ms=None,
            error_type="HTTP_STATUS",
            error_message="Server error",
        )
        test_session.add(rec)

    await test_session.commit()

    # Request summary
    response = await client.get(f"/api/services/{service_id}/summary")
    assert response.status_code == 200

    data = response.json()
    assert data["service_id"] == service_id
    assert data["service_name"] == "Summary Target"
    assert data["total_checks"] == 10
    assert data["successful_checks"] == 8
    assert data["failed_checks"] == 2
    assert data["uptime_percentage"] == 80.0
    assert data["avg_response_time_ms"] == 45.0

    # Also test with ?hours=1 shortcut
    res_hours = await client.get(f"/api/services/{service_id}/summary?hours=1")
    assert res_hours.status_code == 200
    assert res_hours.json()["total_checks"] == 10


@pytest.mark.asyncio
async def test_get_service_summary_empty_service(client: AsyncClient):
    """Verify summary for newly registered service with zero checks."""
    created = await client.post("/api/services", json={"name": "Empty Svc", "url": "https://empty.com"})
    service_id = created.json()["id"]

    response = await client.get(f"/api/services/{service_id}/summary")
    assert response.status_code == 200

    data = response.json()
    assert data["total_checks"] == 0
    assert data["successful_checks"] == 0
    assert data["failed_checks"] == 0
    assert data["uptime_percentage"] == 0.0
    assert data["avg_response_time_ms"] is None


@pytest.mark.asyncio
async def test_checks_and_summary_not_found(client: AsyncClient):
    """Verify 404 response when querying nonexistent service."""
    res_checks = await client.get("/api/services/999999/checks")
    assert res_checks.status_code == 404

    res_summary = await client.get("/api/services/999999/summary")
    assert res_summary.status_code == 404
