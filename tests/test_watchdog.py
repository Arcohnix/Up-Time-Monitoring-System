"""Tests for Phase 12 Monitoring System Self-Health and External Watchdog."""

import time
from unittest.mock import patch

import httpx
import pytest
from httpx import AsyncClient

from app.checker.scheduler import MonitoringScheduler
from watchdog.config import WatchdogConfig
from watchdog.watchdog import (
    ExternalWatchdog,
    WatchdogAlertEvent,
    WatchdogAlertEventType,
    WatchdogCheckResult,
    WatchdogState,
)


@pytest.mark.asyncio
async def test_health_heartbeat_unhealthy_when_scheduler_stopped(client: AsyncClient):
    """Verify GET /health/heartbeat returns 503 when the monitoring scheduler is stopped."""
    with patch(
        "app.checker.scheduler.get_scheduler_heartbeat",
        return_value={
            "scheduler_running": False,
            "worker_alive": False,
            "last_heartbeat_timestamp": None,
            "seconds_since_last_heartbeat": None,
            "ticks_count": 0,
            "in_flight_checks": 0,
            "stale_threshold_seconds": 30.0,
        },
    ):
        response = await client.get("/health/heartbeat")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["api_alive"] is True
        assert data["scheduler_running"] is False
        assert data["worker_alive"] is False


@pytest.mark.asyncio
async def test_health_heartbeat_healthy_when_scheduler_running(client: AsyncClient):
    """Verify GET /health/heartbeat returns 200 when scheduler is running and heartbeat is fresh."""
    now = time.time()
    with patch(
        "app.checker.scheduler.get_scheduler_heartbeat",
        return_value={
            "scheduler_running": True,
            "worker_alive": True,
            "last_heartbeat_timestamp": now - 1.5,
            "seconds_since_last_heartbeat": 1.5,
            "ticks_count": 42,
            "in_flight_checks": 2,
            "stale_threshold_seconds": 30.0,
        },
    ):
        response = await client.get("/health/heartbeat")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["api_alive"] is True
        assert data["scheduler_running"] is True
        assert data["worker_alive"] is True
        assert data["ticks_count"] == 42
        assert data["in_flight_checks"] == 2


@pytest.mark.asyncio
async def test_health_heartbeat_unhealthy_when_worker_stale(client: AsyncClient):
    """Verify GET /health/heartbeat returns 503 when worker heartbeat exceeds stale threshold."""
    now = time.time()
    with patch(
        "app.checker.scheduler.get_scheduler_heartbeat",
        return_value={
            "scheduler_running": True,
            "worker_alive": False,  # Heartbeat is older than threshold
            "last_heartbeat_timestamp": now - 65.0,
            "seconds_since_last_heartbeat": 65.0,
            "ticks_count": 10,
            "in_flight_checks": 0,
            "stale_threshold_seconds": 30.0,
        },
    ):
        response = await client.get("/health/heartbeat?stale_threshold=30.0")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["scheduler_running"] is True
        assert data["worker_alive"] is False


@pytest.mark.asyncio
async def test_api_v1_health_heartbeat_endpoint(client: AsyncClient):
    """Verify GET /api/v1/health/heartbeat returns heartbeat telemetry."""
    now = time.time()
    with patch(
        "app.checker.scheduler.get_scheduler_heartbeat",
        return_value={
            "scheduler_running": True,
            "worker_alive": True,
            "last_heartbeat_timestamp": now,
            "seconds_since_last_heartbeat": 0.1,
            "ticks_count": 5,
            "in_flight_checks": 0,
            "stale_threshold_seconds": 30.0,
        },
    ):
        response = await client.get("/api/v1/health/heartbeat")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["api_alive"] is True
        assert data["scheduler_running"] is True
        assert data["worker_alive"] is True


def test_scheduler_get_heartbeat_direct():
    """Verify MonitoringScheduler.get_heartbeat method under various states."""
    scheduler = MonitoringScheduler()
    # Initial state (not running)
    hb = scheduler.get_heartbeat(stale_threshold_seconds=30.0)
    assert hb["scheduler_running"] is False
    assert hb["worker_alive"] is False
    assert hb["last_heartbeat_timestamp"] is None

    # Simulate running with fresh heartbeat
    scheduler._running = True
    scheduler._last_heartbeat = time.time() - 2.0
    scheduler._ticks_count = 10
    hb = scheduler.get_heartbeat(stale_threshold_seconds=30.0)
    assert hb["scheduler_running"] is True
    assert hb["worker_alive"] is True
    assert hb["ticks_count"] == 10
    assert hb["seconds_since_last_heartbeat"] is not None
    assert hb["seconds_since_last_heartbeat"] < 5.0

    # Simulate running with stale heartbeat (worker frozen/crashed)
    scheduler._last_heartbeat = time.time() - 45.0
    hb = scheduler.get_heartbeat(stale_threshold_seconds=30.0)
    assert hb["scheduler_running"] is True
    assert hb["worker_alive"] is False
    assert hb["seconds_since_last_heartbeat"] > 40.0


@pytest.mark.asyncio
async def test_watchdog_probe_once_success():
    """Verify external watchdog probe detects an operational monitoring system."""
    config = WatchdogConfig(target_url="http://test-server:8000")
    watchdog = ExternalWatchdog(config=config)

    def mock_handler(request: httpx.Request):
        assert request.url.path == "/health/heartbeat"
        return httpx.Response(
            status_code=200,
            json={
                "status": "healthy",
                "api_alive": True,
                "scheduler_running": True,
                "worker_alive": True,
                "seconds_since_last_heartbeat": 1.2,
                "ticks_count": 100,
            },
        )

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        result = await watchdog.probe_once(client=client)

    assert result.success is True
    assert result.status_code == 200
    assert result.api_alive is True
    assert result.scheduler_running is True
    assert result.worker_alive is True
    assert result.error_message is None


@pytest.mark.asyncio
async def test_watchdog_probe_once_http_503_unhealthy():
    """Verify watchdog probe detects 503 response when monitoring worker heartbeat fails."""
    config = WatchdogConfig(target_url="http://test-server:8000")
    watchdog = ExternalWatchdog(config=config)

    def mock_handler(request: httpx.Request):
        return httpx.Response(
            status_code=503,
            json={
                "status": "unhealthy",
                "api_alive": True,
                "scheduler_running": False,
                "worker_alive": False,
            },
        )

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        result = await watchdog.probe_once(client=client)

    assert result.success is False
    assert result.status_code == 503
    assert result.scheduler_running is False
    assert result.worker_alive is False
    assert "503" in (result.error_message or "")


@pytest.mark.asyncio
async def test_watchdog_probe_once_timeout():
    """Verify watchdog probe handles connection timeout when monitoring service is unresponsive."""
    config = WatchdogConfig(target_url="http://test-server:8000", timeout_seconds=1.0)
    watchdog = ExternalWatchdog(config=config)

    def mock_handler(request: httpx.Request):
        raise httpx.TimeoutException("Connection timed out after 1.0s")

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        result = await watchdog.probe_once(client=client)

    assert result.success is False
    assert result.status_code is None
    assert result.api_alive is False
    assert "timed out" in (result.error_message or "")


@pytest.mark.asyncio
async def test_watchdog_probe_once_connection_error():
    """Verify watchdog probe handles connection error when monitoring service process crashed."""
    config = WatchdogConfig(target_url="http://test-server:8000")
    watchdog = ExternalWatchdog(config=config)

    def mock_handler(request: httpx.Request):
        raise httpx.ConnectError("Connection refused")

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        result = await watchdog.probe_once(client=client)

    assert result.success is False
    assert result.status_code is None
    assert result.api_alive is False
    assert "Connection failed" in (result.error_message or "")


def test_watchdog_evaluate_threshold_and_deduplication():
    """Verify state transitions, consecutive failure gating, and alert deduplication."""
    config = WatchdogConfig(failure_threshold=2)
    watchdog = ExternalWatchdog(config=config)
    assert watchdog.state == WatchdogState.HEALTHY

    # Probe 1: Failure 1 of 2 -> Does not reach threshold; returns None
    fail_1 = WatchdogCheckResult(
        success=False,
        status_code=503,
        response_time_ms=10.0,
        api_alive=True,
        scheduler_running=False,
        worker_alive=False,
        error_message="Scheduler stopped",
    )
    alert = watchdog.evaluate(fail_1)
    assert alert is None
    assert watchdog.consecutive_failures == 1
    assert watchdog.state == WatchdogState.HEALTHY

    # Probe 2: Failure 2 of 2 -> Reaches threshold; transitions to DOWN and emits alert
    fail_2 = WatchdogCheckResult(
        success=False,
        status_code=None,
        response_time_ms=5000.0,
        api_alive=False,
        scheduler_running=False,
        worker_alive=False,
        error_message="Connection timed out",
    )
    alert = watchdog.evaluate(fail_2)
    assert alert is not None
    assert alert.event_type == WatchdogAlertEventType.MONITORING_SYSTEM_DOWN.value
    assert alert.consecutive_failures == 2
    assert watchdog.state == WatchdogState.DOWN

    # Probe 3: Failure 3 (continued outage) -> System is already DOWN; does NOT spam alert (deduplication)
    alert = watchdog.evaluate(fail_2)
    assert alert is None
    assert watchdog.consecutive_failures == 3
    assert watchdog.state == WatchdogState.DOWN

    # Probe 4: Success after outage -> Transitions to HEALTHY and emits RECOVERED alert
    success_res = WatchdogCheckResult(
        success=True,
        status_code=200,
        response_time_ms=15.0,
        api_alive=True,
        scheduler_running=True,
        worker_alive=True,
    )
    alert = watchdog.evaluate(success_res)
    assert alert is not None
    assert alert.event_type == WatchdogAlertEventType.MONITORING_SYSTEM_RECOVERED.value
    assert alert.consecutive_failures == 3  # Recorded the outage duration in failures
    assert watchdog.consecutive_failures == 0
    assert watchdog.state == WatchdogState.HEALTHY

    # Probe 5: Continued healthy -> Stays HEALTHY, returns None
    alert = watchdog.evaluate(success_res)
    assert alert is None
    assert watchdog.state == WatchdogState.HEALTHY


@pytest.mark.asyncio
async def test_watchdog_dispatch_alert_webhook():
    """Verify watchdog dispatches outage alerts to external webhook and invokes callbacks."""
    captured_webhooks = []

    def webhook_handler(request: httpx.Request):
        import json
        captured_webhooks.append(json.loads(request.content))
        return httpx.Response(status_code=200, json={"status": "received"})

    callback_alerts = []

    def alert_callback(event: WatchdogAlertEvent):
        callback_alerts.append(event)

    config = WatchdogConfig(
        target_url="http://test-server:8000",
        alert_webhook_url="http://external-alerts.example.com/watchdog-notify",
    )
    watchdog = ExternalWatchdog(config=config, alert_callback=alert_callback)

    alert_event = WatchdogAlertEvent(
        event_type=WatchdogAlertEventType.MONITORING_SYSTEM_DOWN.value,
        target_url="http://test-server:8000",
        timestamp=time.time(),
        consecutive_failures=2,
        error_message="Process terminated",
    )

    transport = httpx.MockTransport(webhook_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        await watchdog.dispatch_alert(alert_event, client=client)

    # Verify callback invoked
    assert len(callback_alerts) == 1
    assert callback_alerts[0].event_type == WatchdogAlertEventType.MONITORING_SYSTEM_DOWN.value

    # Verify webhook payload sent
    assert len(captured_webhooks) == 1
    assert captured_webhooks[0]["source"] == "UTMS_WATCHDOG"
    assert captured_webhooks[0]["alert"]["event_type"] == WatchdogAlertEventType.MONITORING_SYSTEM_DOWN.value
    assert captured_webhooks[0]["alert"]["consecutive_failures"] == 2


@pytest.mark.asyncio
async def test_watchdog_dispatch_alert_failure_isolated():
    """Verify failing webhook delivery does not raise an exception or crash watchdog."""
    config = WatchdogConfig(
        target_url="http://test-server:8000",
        alert_webhook_url="http://broken-webhook.example.com/post",
    )
    watchdog = ExternalWatchdog(config=config)

    def failing_handler(request: httpx.Request):
        return httpx.Response(status_code=500, text="Internal Server Error")

    transport = httpx.MockTransport(failing_handler)
    alert_event = WatchdogAlertEvent(
        event_type=WatchdogAlertEventType.MONITORING_SYSTEM_DOWN.value,
        target_url="http://test-server:8000",
        timestamp=time.time(),
        consecutive_failures=2,
        error_message="Down",
    )

    async with httpx.AsyncClient(transport=transport) as client:
        # Should not raise exception
        await watchdog.dispatch_alert(alert_event, client=client)


@pytest.mark.asyncio
async def test_watchdog_tick_integration():
    """Verify watchdog tick executes probe, evaluates state, and returns result and alert."""
    config = WatchdogConfig(target_url="http://test-server:8000", failure_threshold=1)
    watchdog = ExternalWatchdog(config=config)

    def mock_handler(request: httpx.Request):
        raise httpx.ConnectError("Service dead")

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        result, alert = await watchdog.tick(client=client)

    assert result.success is False
    assert alert is not None
    assert alert.event_type == WatchdogAlertEventType.MONITORING_SYSTEM_DOWN.value
    assert watchdog.state == WatchdogState.DOWN
