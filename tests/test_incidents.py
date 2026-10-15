import asyncio
from datetime import datetime, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.checker.schemas import CheckResult
from app.incidents.manager import get_active_incident, process_check_result
from app.incidents.schemas import IncidentStatus, ServiceState
from app.models.incident import IncidentModel
from app.models.service import Service


def make_check_result(service_id: int, success: bool, status_code: int = 200, error_type: str = None, error_message: str = None) -> CheckResult:
    return CheckResult(
        service_id=service_id,
        checked_at=datetime.now(timezone.utc),
        success=success,
        status_code=status_code if success else (status_code or 500),
        response_time_ms=50.0,
        error_type=error_type if not success else None,
        error_message=error_message if not success else None,
    )


@pytest.mark.asyncio
async def test_transient_failure_does_not_create_incident(test_session: AsyncSession):
    """Edge Case: 1 temporary failure changes state to FAILING but does not open an incident."""
    service = Service(name="Transient Test", url="https://transient.com", failure_threshold=3)
    test_session.add(service)
    await test_session.commit()

    # Failure 1
    fail_1 = make_check_result(service.id, success=False, error_type="HTTP_STATUS", error_message="500 Internal Error")
    res1 = await process_check_result(test_session, service, fail_1)

    assert res1 is None
    assert service.consecutive_failures == 1
    assert service.current_state == ServiceState.FAILING.value

    # Verify no incident in DB
    active = await get_active_incident(test_session, service.id)
    assert active is None

    # Immediate success: recovers to HEALTHY
    succ_1 = make_check_result(service.id, success=True, status_code=200)
    res2 = await process_check_result(test_session, service, succ_1)

    assert res2 is None
    assert service.consecutive_failures == 0
    assert service.current_state == ServiceState.HEALTHY.value


@pytest.mark.asyncio
async def test_consecutive_failure_threshold_creates_incident(test_session: AsyncSession):
    """Edge Case: 3 consecutive failures transitions state to DOWN and creates an active incident."""
    service = Service(name="Threshold Test", url="https://threshold.com", failure_threshold=3)
    test_session.add(service)
    await test_session.commit()

    # Failure 1
    await process_check_result(test_session, service, make_check_result(service.id, success=False, error_type="TIMEOUT", error_message="Timeout 1"))
    assert service.consecutive_failures == 1
    assert service.current_state == ServiceState.FAILING.value

    # Failure 2
    await process_check_result(test_session, service, make_check_result(service.id, success=False, error_type="TIMEOUT", error_message="Timeout 2"))
    assert service.consecutive_failures == 2
    assert service.current_state == ServiceState.FAILING.value
    assert await get_active_incident(test_session, service.id) is None

    # Failure 3 (Threshold reached!)
    inc = await process_check_result(test_session, service, make_check_result(service.id, success=False, error_type="TIMEOUT", error_message="Timeout 3"))

    assert inc is not None
    assert inc.status == IncidentStatus.OPEN.value
    assert inc.failure_count == 3
    assert inc.last_error_type == "TIMEOUT"
    assert inc.last_error_message == "Timeout 3"
    assert inc.started_at is not None
    assert inc.resolved_at is None
    assert service.current_state == ServiceState.DOWN.value


@pytest.mark.asyncio
async def test_continued_failures_update_existing_incident_without_duplicates(test_session: AsyncSession):
    """Edge Case: Continued failures (4, 5...) update failure count; no duplicate incidents are opened."""
    service = Service(name="No Duplicates Test", url="https://nodup.com", failure_threshold=3)
    test_session.add(service)
    await test_session.commit()

    # Failures 1, 2, 3 -> Incident created
    for i in range(1, 4):
        await process_check_result(test_session, service, make_check_result(service.id, success=False, error_message=f"Error {i}"))

    active_inc = await get_active_incident(test_session, service.id)
    assert active_inc is not None
    initial_id = active_inc.id

    # Failures 4 and 5
    for i in range(4, 6):
        updated_inc = await process_check_result(
            test_session,
            service,
            make_check_result(service.id, success=False, error_message=f"Error {i}"),
        )
        assert updated_inc.id == initial_id
        assert updated_inc.failure_count == i
        assert updated_inc.last_error_message == f"Error {i}"

    # Verify database strictly contains 1 incident for this service
    all_incidents = (
        await test_session.execute(select(IncidentModel).where(IncidentModel.service_id == service.id))
    ).scalars().all()
    assert len(all_incidents) == 1


@pytest.mark.asyncio
async def test_recovery_after_incident(test_session: AsyncSession):
    """Edge Case: Successful check after an open incident resolves it and resets consecutive failures."""
    service = Service(name="Recovery Test", url="https://recovery.com", failure_threshold=3)
    test_session.add(service)
    await test_session.commit()

    # Trigger 3 failures -> Open incident
    for i in range(3):
        await process_check_result(test_session, service, make_check_result(service.id, success=False))

    active = await get_active_incident(test_session, service.id)
    assert active is not None
    assert active.status == IncidentStatus.OPEN.value

    # Next check succeeds!
    succ_result = make_check_result(service.id, success=True, status_code=200)
    resolved_inc = await process_check_result(test_session, service, succ_result)

    assert resolved_inc is not None
    assert resolved_inc.id == active.id
    assert resolved_inc.status == IncidentStatus.RESOLVED.value
    assert resolved_inc.resolved_at is not None
    assert "recovered" in resolved_inc.recovery_message.lower()

    # Service state is restored to HEALTHY
    assert service.current_state == ServiceState.HEALTHY.value
    assert service.consecutive_failures == 0

    # No active incidents remain open
    assert await get_active_incident(test_session, service.id) is None


@pytest.mark.asyncio
async def test_failure_again_after_recovery_creates_new_incident(test_session: AsyncSession):
    """Edge Case: Failing again after recovery begins a fresh count and creates a second incident."""
    service = Service(name="Recycle Test", url="https://recycle.com", failure_threshold=3)
    test_session.add(service)
    await test_session.commit()

    # Cycle 1: 3 failures -> Incident 1 opened
    for _ in range(3):
        await process_check_result(test_session, service, make_check_result(service.id, success=False))
    inc1 = await get_active_incident(test_session, service.id)

    # Cycle 1: Recovery -> Incident 1 resolved
    await process_check_result(test_session, service, make_check_result(service.id, success=True))

    # Cycle 2: 3 failures again -> Incident 2 opened
    for _ in range(3):
        await process_check_result(test_session, service, make_check_result(service.id, success=False))
    inc2 = await get_active_incident(test_session, service.id)

    assert inc2 is not None
    assert inc2.id != inc1.id
    assert inc2.status == IncidentStatus.OPEN.value

    # Verify total incidents = 2 (1 resolved, 1 open)
    all_incidents = (
        await test_session.execute(select(IncidentModel).where(IncidentModel.service_id == service.id))
    ).scalars().all()
    assert len(all_incidents) == 2


@pytest.mark.asyncio
async def test_custom_failure_threshold(test_session: AsyncSession):
    """Verify service with custom threshold=2 opens incident on 2nd failure."""
    service = Service(name="Custom Threshold", url="https://custom.com", failure_threshold=2)
    test_session.add(service)
    await test_session.commit()

    # 1st failure: below threshold 2
    res1 = await process_check_result(test_session, service, make_check_result(service.id, success=False))
    assert res1 is None
    assert service.consecutive_failures == 1

    # 2nd failure: reaches custom threshold 2 -> Incident created!
    res2 = await process_check_result(test_session, service, make_check_result(service.id, success=False))
    assert res2 is not None
    assert res2.failure_count == 2
    assert service.current_state == ServiceState.DOWN.value


@pytest.mark.asyncio
async def test_incidents_api_endpoints(client: AsyncClient, test_session: AsyncSession):
    """Verify GET /api/incidents, GET /api/incidents/{id}, and GET /api/services/{id}/incidents."""
    # Register 2 services
    s1_res = await client.post("/api/services", json={"name": "Inc API 1", "url": "https://inc1.com", "failure_threshold": 2})
    s2_res = await client.post("/api/services", json={"name": "Inc API 2", "url": "https://inc2.com", "failure_threshold": 2})
    s1_id = s1_res.json()["id"]
    s2_id = s2_res.json()["id"]

    s1 = await test_session.get(Service, s1_id)
    s2 = await test_session.get(Service, s2_id)

    # Open incident for S1, then resolve it
    for _ in range(2):
        await process_check_result(test_session, s1, make_check_result(s1_id, success=False))
    await process_check_result(test_session, s1, make_check_result(s1_id, success=True))

    # Open incident for S2 (remains OPEN)
    for _ in range(2):
        await process_check_result(test_session, s2, make_check_result(s2_id, success=False))

    # 1. GET /api/incidents (all)
    all_res = await client.get("/api/incidents")
    assert all_res.status_code == 200
    all_inc = all_res.json()
    assert len(all_inc) == 2

    # 2. Filter by status=OPEN
    open_res = await client.get("/api/incidents?status=OPEN")
    assert open_res.status_code == 200
    open_inc = open_res.json()
    assert len(open_inc) == 1
    assert open_inc[0]["service_id"] == s2_id
    s2_inc_id = open_inc[0]["id"]

    # 3. Filter by status=RESOLVED
    resolved_res = await client.get("/api/incidents?status=RESOLVED")
    assert resolved_res.status_code == 200
    resolved_inc = resolved_res.json()
    assert len(resolved_inc) == 1
    assert resolved_inc[0]["service_id"] == s1_id

    # 4. GET /api/incidents/{id}
    single_res = await client.get(f"/api/incidents/{s2_inc_id}")
    assert single_res.status_code == 200
    assert single_res.json()["id"] == s2_inc_id

    # 5. GET /api/incidents/999999 -> 404
    not_found_res = await client.get("/api/incidents/999999")
    assert not_found_res.status_code == 404

    # 6. GET /api/services/{id}/incidents
    s1_inc_res = await client.get(f"/api/services/{s1_id}/incidents")
    assert s1_inc_res.status_code == 200
    assert len(s1_inc_res.json()) == 1
    assert s1_inc_res.json()[0]["service_id"] == s1_id


@pytest.mark.asyncio
async def test_scheduler_restart_preserves_incident_state(
    test_session: AsyncSession,
    test_session_factory,
):
    """Verify that restarting the scheduler preserves active incidents without duplicate creation."""
    from app.checker.scheduler import MonitoringScheduler

    # Create service that already has an OPEN incident
    service = Service(
        name="Restart Svc",
        url="https://restart.com",
        is_active=True,
        failure_threshold=3,
        consecutive_failures=3,
        current_state=ServiceState.DOWN.value,
        timeout_seconds=5,
    )
    test_session.add(service)
    await test_session.commit()

    service_id = service.id
    incident = IncidentModel(
        service_id=service_id,
        status=IncidentStatus.OPEN.value,
        failure_count=3,
        last_error_type="TIMEOUT",
        last_error_message="Initial timeout",
    )
    test_session.add(incident)
    await test_session.commit()
    initial_inc_id = incident.id

    # Simulate scheduler restart by instantiating a new scheduler
    import httpx
    # Handler returns another failure
    transport = httpx.MockTransport(lambda req: httpx.Response(500, text="Still down"))
    async with httpx.AsyncClient(transport=transport) as client:
        new_scheduler = MonitoringScheduler(
            session_factory=test_session_factory,
            client=client,
        )

        # Trigger tick on restarted scheduler
        await new_scheduler.tick()
        if new_scheduler._active_tasks:
            await asyncio.gather(*list(new_scheduler._active_tasks))

        # Verify: failure count incremented on the SAME incident; NO duplicate incident created!
        test_session.expire_all()
        active_inc = await get_active_incident(test_session, service_id)
        assert active_inc.id == initial_inc_id
        assert active_inc.failure_count == 4

        all_incidents = (
            await test_session.execute(select(IncidentModel).where(IncidentModel.service_id == service_id))
        ).scalars().all()
        assert len(all_incidents) == 1
