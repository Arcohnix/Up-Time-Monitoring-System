import asyncio
import time
from typing import Set
import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.checker.runner import check_service
from app.checker.scheduler import MonitoringScheduler
from app.models.check_result import CheckResultModel
from app.models.service import Service


@pytest.mark.asyncio
async def test_scheduler_startup_and_graceful_shutdown(test_session_factory: async_sessionmaker[AsyncSession]):
    """Verify scheduler starts background loop and cleanly shuts down."""
    transport = httpx.MockTransport(lambda req: httpx.Response(200))
    async with httpx.AsyncClient(transport=transport) as client:
        scheduler = MonitoringScheduler(
            session_factory=test_session_factory,
            client=client,
            tick_interval=0.05,
        )

        assert scheduler.is_running is False
        await scheduler.start()
        assert scheduler.is_running is True

        await asyncio.sleep(0.1)

        await scheduler.stop()
        assert scheduler.is_running is False


@pytest.mark.asyncio
async def test_scheduler_monitors_enabled_services(
    test_session: AsyncSession,
    test_session_factory: async_sessionmaker[AsyncSession],
):
    """Verify enabled services are monitored automatically and disabled services are ignored."""
    s_active = Service(name="Active Svc", url="https://active.com", is_active=True, timeout_seconds=5)
    s_disabled = Service(name="Disabled Svc", url="https://disabled.com", is_active=False, timeout_seconds=5)
    test_session.add_all([s_active, s_disabled])
    await test_session.commit()

    transport = httpx.MockTransport(lambda req: httpx.Response(200))
    async with httpx.AsyncClient(transport=transport) as client:
        scheduler = MonitoringScheduler(
            session_factory=test_session_factory,
            client=client,
            tick_interval=1.0,
        )

        # Execute single tick
        await scheduler.tick()

        # Wait for dispatched check tasks to complete
        if scheduler._active_tasks:
            await asyncio.gather(*list(scheduler._active_tasks))

        # Verify only active service was checked and recorded
        records = (
            await test_session.execute(select(CheckResultModel).order_by(CheckResultModel.id.asc()))
        ).scalars().all()

        assert len(records) == 1
        assert records[0].service_id == s_active.id


@pytest.mark.asyncio
async def test_scheduler_respects_check_interval(
    test_session: AsyncSession,
    test_session_factory: async_sessionmaker[AsyncSession],
):
    """Verify services are checked only when their configured interval has elapsed."""
    s1 = Service(
        name="Interval Svc",
        url="https://interval.com",
        check_interval_seconds=10,
        timeout_seconds=5,
        is_active=True,
    )
    test_session.add(s1)
    await test_session.commit()

    transport = httpx.MockTransport(lambda req: httpx.Response(200))
    async with httpx.AsyncClient(transport=transport) as client:
        scheduler = MonitoringScheduler(
            session_factory=test_session_factory,
            client=client,
            tick_interval=1.0,
        )

        # 1. First tick: should dispatch check
        await scheduler.tick()
        if scheduler._active_tasks:
            await asyncio.gather(*list(scheduler._active_tasks))

        records_1 = (await test_session.execute(select(CheckResultModel))).scalars().all()
        assert len(records_1) == 1

        # 2. Second tick immediately after: elapsed < 10s -> should NOT dispatch
        await scheduler.tick()
        if scheduler._active_tasks:
            await asyncio.gather(*list(scheduler._active_tasks))

        records_2 = (await test_session.execute(select(CheckResultModel))).scalars().all()
        assert len(records_2) == 1  # Still 1, not rechecked!

        # 3. Simulate passage of 11 seconds
        scheduler._last_checked[s1.id] = time.monotonic() - 11.0

        # Third tick: should dispatch again
        await scheduler.tick()
        if scheduler._active_tasks:
            await asyncio.gather(*list(scheduler._active_tasks))

        records_3 = (await test_session.execute(select(CheckResultModel))).scalars().all()
        assert len(records_3) == 2  # Checked second time!


@pytest.mark.asyncio
async def test_scheduler_prevents_overlapping_checks(
    test_session: AsyncSession,
    test_session_factory: async_sessionmaker[AsyncSession],
):
    """Verify overlapping checks on the same service are prevented while one is in-flight."""
    s_slow = Service(
        name="Slow Svc",
        url="https://slow.com",
        check_interval_seconds=1,
        timeout_seconds=5,
        is_active=True,
    )
    test_session.add(s_slow)
    await test_session.commit()

    # Simulate slow endpoint taking 0.2s
    async def slow_handler(req: httpx.Request) -> httpx.Response:
        await asyncio.sleep(0.2)
        return httpx.Response(200)

    transport = httpx.MockTransport(slow_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        scheduler = MonitoringScheduler(
            session_factory=test_session_factory,
            client=client,
            tick_interval=0.05,
        )

        # First tick starts check
        await scheduler.tick()
        assert s_slow.id in scheduler._in_flight
        assert len(scheduler._active_tasks) == 1

        # Advance last_checked time to make it seemingly due
        scheduler._last_checked[s_slow.id] = time.monotonic() - 2.0

        # Second tick while first is still in-flight
        await scheduler.tick()
        # Must still have only 1 task in flight!
        assert len(scheduler._active_tasks) == 1

        # Wait for task to finish
        await asyncio.gather(*list(scheduler._active_tasks))
        assert s_slow.id not in scheduler._in_flight


@pytest.mark.asyncio
async def test_scheduler_slow_endpoint_does_not_block_others(
    test_session: AsyncSession,
    test_session_factory: async_sessionmaker[AsyncSession],
):
    """Verify a slow endpoint executes concurrently without delaying checks of other endpoints."""
    s_fast1 = Service(name="Fast 1", url="https://fast1.com", is_active=True, timeout_seconds=5)
    s_slow = Service(name="Slow", url="https://slow.com", is_active=True, timeout_seconds=5)
    s_fast2 = Service(name="Fast 2", url="https://fast2.com", is_active=True, timeout_seconds=5)
    test_session.add_all([s_fast1, s_slow, s_fast2])
    await test_session.commit()

    fast_completed: Set[str] = set()

    async def mock_handler(req: httpx.Request) -> httpx.Response:
        if "slow" in str(req.url):
            await asyncio.sleep(0.25)
            return httpx.Response(200)
        fast_completed.add(str(req.url))
        return httpx.Response(200)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        scheduler = MonitoringScheduler(
            session_factory=test_session_factory,
            client=client,
            tick_interval=1.0,
        )

        # Dispatch all 3 checks
        await scheduler.tick()
        assert len(scheduler._active_tasks) == 3

        # Yield control briefly (0.05s) - fast checks should complete, slow should still be running
        await asyncio.sleep(0.05)
        assert len(fast_completed) == 2  # Both fast services completed!

        # Wait for slow task to conclude
        await asyncio.gather(*list(scheduler._active_tasks))


@pytest.mark.asyncio
async def test_scheduler_failed_endpoint_does_not_crash(
    test_session: AsyncSession,
    test_session_factory: async_sessionmaker[AsyncSession],
):
    """Verify failing endpoints are recorded safely without crashing the scheduler."""
    s_broken = Service(name="Broken", url="https://broken.com", is_active=True, timeout_seconds=5)
    s_ok = Service(name="Healthy", url="https://healthy.com", is_active=True, timeout_seconds=5)
    test_session.add_all([s_broken, s_ok])
    await test_session.commit()

    def handler(req: httpx.Request) -> httpx.Response:
        if "broken" in str(req.url):
            raise httpx.ConnectError("Connection refused", request=req)
        return httpx.Response(200)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        scheduler = MonitoringScheduler(
            session_factory=test_session_factory,
            client=client,
        )

        await scheduler.tick()
        await asyncio.gather(*list(scheduler._active_tasks))

        records = (
            await test_session.execute(select(CheckResultModel).order_by(CheckResultModel.id.asc()))
        ).scalars().all()

        assert len(records) == 2
        broken_rec = next(r for r in records if r.service_id == s_broken.id)
        ok_rec = next(r for r in records if r.service_id == s_ok.id)

        assert broken_rec.success is False
        assert broken_rec.error_type == "CONNECTION_ERROR"
        assert ok_rec.success is True


@pytest.mark.asyncio
async def test_scheduler_handles_tick_db_error_safely():
    """Verify database exceptions during service discovery do not raise or crash."""
    from unittest.mock import MagicMock

    mock_factory = MagicMock()
    mock_factory.side_effect = RuntimeError("Database connection unreachable")

    scheduler = MonitoringScheduler(session_factory=mock_factory)
    # Must not raise
    await scheduler.tick()
