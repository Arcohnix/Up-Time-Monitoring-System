import asyncio
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import List
import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.alerts.base import AlertEvent, AlertEventType, BaseNotificationProvider
from app.alerts.providers.email import EmailNotificationProvider
from app.alerts.providers.webhook import WebhookNotificationProvider
from app.alerts.service import AlertService, get_alert_service, reset_alert_service
from app.checker.schemas import CheckResult
from app.incidents.manager import process_check_result
from app.incidents.schemas import IncidentStatus, ServiceState
from app.models.service import Service


# ---------------------------------------------------------------------------
# Test Fixtures & Helpers
# ---------------------------------------------------------------------------

class MockProvider(BaseNotificationProvider):
    """In-memory mock provider for capturing dispatched alert events."""

    def __init__(self, name: str = "mock", enabled: bool = True, should_succeed: bool = True, raise_exc: bool = False):
        self._name = name
        self._enabled = enabled
        self._should_succeed = should_succeed
        self._raise_exc = raise_exc
        self.sent_events: List[AlertEvent] = []

    @property
    def name(self) -> str:
        return self._name

    @property
    def is_enabled(self) -> bool:
        return self._enabled

    async def send(self, event: AlertEvent) -> bool:
        if self._raise_exc:
            raise RuntimeError(f"Simulated crash in provider {self._name}")
        self.sent_events.append(event)
        return self._should_succeed


def make_sample_event(event_type: AlertEventType = AlertEventType.INCIDENT_CREATED) -> AlertEvent:
    return AlertEvent(
        event_type=event_type,
        incident_id=42,
        service_id=1,
        service_name="Test Service",
        service_url="https://api.test.com/health",
        timestamp=datetime.now(timezone.utc),
        failure_count=3,
        error_type="TIMEOUT" if event_type == AlertEventType.INCIDENT_CREATED else None,
        error_message="Connection timed out" if event_type == AlertEventType.INCIDENT_CREATED else None,
        status_code=504 if event_type == AlertEventType.INCIDENT_CREATED else 200,
        recovery_message="Recovered in 45ms" if event_type == AlertEventType.INCIDENT_RESOLVED else None,
    )


# ---------------------------------------------------------------------------
# 1. AlertEvent Unit Tests
# ---------------------------------------------------------------------------

def test_alert_event_serialization_and_formatting():
    event = make_sample_event(AlertEventType.INCIDENT_CREATED)
    d = event.to_dict()

    assert d["event_type"] == "incident_created"
    assert d["incident_id"] == 42
    assert d["service_id"] == 1
    assert d["service_name"] == "Test Service"
    assert d["service_url"] == "https://api.test.com/health"
    assert d["failure_count"] == 3
    assert d["error_type"] == "TIMEOUT"
    assert d["error_message"] == "Connection timed out"

    subject = event.format_subject()
    assert "[ALERT]" in subject
    assert "Incident #42" in subject
    assert "Test Service is DOWN" in subject

    msg = event.format_message()
    assert "ALERT: Service Outage Detected" in msg
    assert "https://api.test.com/health" in msg
    assert "TIMEOUT" in msg

    # Recovery event formatting
    resolved_event = make_sample_event(AlertEventType.INCIDENT_RESOLVED)
    assert "[RESOLVED]" in resolved_event.format_subject()
    assert "has RECOVERED" in resolved_event.format_subject()
    assert "RESOLVED: Service Outage Cleared" in resolved_event.format_message()


# ---------------------------------------------------------------------------
# 2. WebhookNotificationProvider Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_webhook_provider_success():
    event = make_sample_event()
    posted_payload = None

    def handler(request: httpx.Request):
        nonlocal posted_payload
        import json
        posted_payload = json.loads(request.read())
        return httpx.Response(200, json={"status": "received"})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = WebhookNotificationProvider(
            url="https://webhook.site/test-alert",
            enabled=True,
            client=client,
        )
        assert provider.name == "webhook"
        assert provider.is_enabled is True

        success = await provider.send(event)
        assert success is True
        assert posted_payload is not None
        assert posted_payload["event_type"] == "incident_created"
        assert posted_payload["incident_id"] == 42


@pytest.mark.asyncio
async def test_webhook_provider_non_2xx_handled_safely():
    event = make_sample_event()
    transport = httpx.MockTransport(lambda req: httpx.Response(500, text="Internal Server Error"))
    async with httpx.AsyncClient(transport=transport) as client:
        provider = WebhookNotificationProvider(
            url="https://webhook.site/test-alert",
            enabled=True,
            client=client,
        )
        success = await provider.send(event)
        assert success is False  # Must return False, not raise!


@pytest.mark.asyncio
async def test_webhook_provider_timeout_handled_safely():
    event = make_sample_event()

    def timeout_handler(request: httpx.Request):
        raise httpx.ReadTimeout("Socket timed out", request=request)

    transport = httpx.MockTransport(timeout_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = WebhookNotificationProvider(
            url="https://webhook.site/timeout",
            enabled=True,
            timeout_seconds=0.1,
            client=client,
        )
        success = await provider.send(event)
        assert success is False


@pytest.mark.asyncio
async def test_webhook_provider_connection_error_handled_safely():
    event = make_sample_event()

    def conn_err_handler(request: httpx.Request):
        raise httpx.ConnectError("Failed to establish DNS connection", request=request)

    transport = httpx.MockTransport(conn_err_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = WebhookNotificationProvider(
            url="https://webhook.site/conn-err",
            enabled=True,
            client=client,
        )
        success = await provider.send(event)
        assert success is False


@pytest.mark.asyncio
async def test_webhook_provider_disabled_or_empty_url():
    event = make_sample_event()

    # Disabled
    p_disabled = WebhookNotificationProvider(url="https://webhook.site/test", enabled=False)
    assert p_disabled.is_enabled is False
    assert await p_disabled.send(event) is False

    # Empty URL
    p_no_url = WebhookNotificationProvider(url=None, enabled=True)
    assert p_no_url.is_enabled is False
    assert await p_no_url.send(event) is False


# ---------------------------------------------------------------------------
# 3. EmailNotificationProvider Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_email_provider_success():
    event = make_sample_event(AlertEventType.INCIDENT_CREATED)
    captured_message: List[EmailMessage] = []

    def mock_sender(msg: EmailMessage):
        captured_message.append(msg)

    provider = EmailNotificationProvider(
        smtp_host="smtp.example.com",
        smtp_port=587,
        from_address="alerts@utms.local",
        to_addresses="ops@company.com, dev@company.com",
        enabled=True,
        sender_fn=mock_sender,
    )

    assert provider.name == "email"
    assert provider.is_enabled is True
    assert provider.to_addresses == ["ops@company.com", "dev@company.com"]

    success = await provider.send(event)
    assert success is True
    assert len(captured_message) == 1

    msg = captured_message[0]
    assert "[ALERT] Incident #42" in msg["Subject"]
    assert msg["From"] == "alerts@utms.local"
    assert msg["To"] == "ops@company.com, dev@company.com"
    assert "ALERT: Service Outage Detected" in msg.get_content()


@pytest.mark.asyncio
async def test_email_provider_error_handled_safely():
    event = make_sample_event()

    def crashing_sender(msg: EmailMessage):
        import smtplib
        raise smtplib.SMTPConnectError(421, b"Connection refused")

    provider = EmailNotificationProvider(
        smtp_host="smtp.failing.com",
        to_addresses="ops@company.com",
        enabled=True,
        sender_fn=crashing_sender,
    )

    success = await provider.send(event)
    assert success is False  # Must return False, not crash!


@pytest.mark.asyncio
async def test_email_provider_disabled():
    event = make_sample_event()

    p_disabled = EmailNotificationProvider(
        smtp_host="smtp.example.com",
        to_addresses="ops@company.com",
        enabled=False,
    )
    assert p_disabled.is_enabled is False
    assert await p_disabled.send(event) is False

    p_no_host = EmailNotificationProvider(
        smtp_host=None,
        to_addresses="ops@company.com",
        enabled=True,
    )
    assert p_no_host.is_enabled is False
    assert await p_no_host.send(event) is False


# ---------------------------------------------------------------------------
# 4. AlertService Coordinator & Fault Isolation Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_alert_service_concurrent_dispatch():
    p1 = MockProvider(name="webhook", enabled=True, should_succeed=True)
    p2 = MockProvider(name="email", enabled=True, should_succeed=True)
    p_disabled = MockProvider(name="sms", enabled=False, should_succeed=True)

    service = AlertService(providers=[p1, p2, p_disabled])
    assert len(service.providers) == 3
    assert len(service.enabled_providers) == 2

    event = make_sample_event()
    results = await service.dispatch(event)

    assert results == {"webhook": True, "email": True}
    assert len(p1.sent_events) == 1
    assert len(p2.sent_events) == 1
    assert len(p_disabled.sent_events) == 0


@pytest.mark.asyncio
async def test_alert_service_fault_isolation():
    """Verify that a crashing or failing provider does not impact others or raise exceptions."""
    p_good = MockProvider(name="good", enabled=True, should_succeed=True)
    p_fail = MockProvider(name="fail", enabled=True, should_succeed=False)
    p_crash = MockProvider(name="crash", enabled=True, raise_exc=True)

    service = AlertService(providers=[p_good, p_fail, p_crash])
    event = make_sample_event()

    results = await service.dispatch(event)

    assert results["good"] is True
    assert results["fail"] is False
    assert results["crash"] is False


@pytest.mark.asyncio
async def test_alert_service_empty_dispatch():
    service = AlertService()
    event = make_sample_event()
    results = await service.dispatch(event)
    assert results == {}


# ---------------------------------------------------------------------------
# 5. Incident Detection & Notification Integration Tests
# ---------------------------------------------------------------------------

def make_result(service_id: int, success: bool, status_code: int = 200, error_type: str = None, error_message: str = None) -> CheckResult:
    return CheckResult(
        service_id=service_id,
        checked_at=datetime.now(timezone.utc),
        success=success,
        status_code=status_code if success else (status_code or 500),
        response_time_ms=35.0,
        error_type=error_type if not success else None,
        error_message=error_message if not success else None,
    )


@pytest.mark.asyncio
async def test_incident_lifecycle_alerting_deduplication(test_session: AsyncSession):
    """Verify notification dispatch during incident lifecycle:
    1. Transient failures (< threshold): NO alert.
    2. Reaching threshold (DOWN): EXACTLY 1 INCIDENT_CREATED alert.
    3. Continued failures while DOWN: ZERO duplicate alerts!
    4. Recovery (HEALTHY): EXACTLY 1 INCIDENT_RESOLVED alert.
    5. Continued successes: ZERO duplicate alerts.
    """
    mock_provider = MockProvider(name="test_provider", enabled=True)
    alert_svc = AlertService(providers=[mock_provider])

    service = Service(
        name="Lifecycle Svc",
        url="https://lifecycle.test.com",
        is_active=True,
        failure_threshold=3,
        consecutive_failures=0,
        current_state=ServiceState.HEALTHY.value,
    )
    test_session.add(service)
    await test_session.commit()

    # Step 1: Failure 1 (1/3) -> State FAILING, NO alert
    r1 = make_result(service.id, success=False, error_type="HTTP_STATUS", error_message="503 Service Unavailable")
    await process_check_result(test_session, service, r1, alert_service=alert_svc)
    assert len(mock_provider.sent_events) == 0
    assert service.current_state == ServiceState.FAILING.value

    # Step 2: Failure 2 (2/3) -> State FAILING, NO alert
    r2 = make_result(service.id, success=False, error_type="TIMEOUT", error_message="Timeout")
    await process_check_result(test_session, service, r2, alert_service=alert_svc)
    assert len(mock_provider.sent_events) == 0
    assert service.current_state == ServiceState.FAILING.value

    # Step 3: Failure 3 (3/3) -> Threshold crossed! State DOWN, EXACTLY 1 INCIDENT_CREATED alert!
    r3 = make_result(service.id, success=False, error_type="HTTP_STATUS", error_message="500 Internal Error")
    incident = await process_check_result(test_session, service, r3, alert_service=alert_svc)
    assert incident is not None
    assert service.current_state == ServiceState.DOWN.value
    assert len(mock_provider.sent_events) == 1
    assert mock_provider.sent_events[0].event_type == AlertEventType.INCIDENT_CREATED
    assert mock_provider.sent_events[0].incident_id == incident.id
    assert mock_provider.sent_events[0].failure_count == 3

    # Step 4: Failure 4 & 5 (ongoing while DOWN) -> ZERO duplicate alerts!
    r4 = make_result(service.id, success=False, error_type="TIMEOUT", error_message="Still timing out")
    await process_check_result(test_session, service, r4, alert_service=alert_svc)
    r5 = make_result(service.id, success=False, error_type="TIMEOUT", error_message="Still timing out")
    await process_check_result(test_session, service, r5, alert_service=alert_svc)
    assert len(mock_provider.sent_events) == 1  # Still exactly 1 alert, no duplicate!

    # Step 5: Success -> Incident RESOLVED! State HEALTHY, EXACTLY 1 INCIDENT_RESOLVED alert!
    rec = make_result(service.id, success=True, status_code=200)
    resolved_inc = await process_check_result(test_session, service, rec, alert_service=alert_svc)
    assert resolved_inc is not None
    assert resolved_inc.status == IncidentStatus.RESOLVED.value
    assert service.current_state == ServiceState.HEALTHY.value
    assert len(mock_provider.sent_events) == 2
    assert mock_provider.sent_events[1].event_type == AlertEventType.INCIDENT_RESOLVED
    assert mock_provider.sent_events[1].incident_id == incident.id

    # Step 6: Subsequent success -> ZERO additional alerts
    rec2 = make_result(service.id, success=True, status_code=200)
    await process_check_result(test_session, service, rec2, alert_service=alert_svc)
    assert len(mock_provider.sent_events) == 2  # No new alert


@pytest.mark.asyncio
async def test_alert_delivery_failure_does_not_crash_monitoring(test_session: AsyncSession):
    """Verify that a failing/crashing notification delivery does NOT crash the monitoring worker or state update."""
    crashing_provider = MockProvider(name="crashing", enabled=True, raise_exc=True)
    alert_svc = AlertService(providers=[crashing_provider])

    service = Service(
        name="Resilience Svc",
        url="https://resilience.test.com",
        is_active=True,
        failure_threshold=1,  # immediate incident
        consecutive_failures=0,
    )
    test_session.add(service)
    await test_session.commit()

    # Trigger failure that creates incident and triggers crashing notification
    fail_res = make_result(service.id, success=False, error_type="TIMEOUT", error_message="Timeout")
    incident = await process_check_result(test_session, service, fail_res, alert_service=alert_svc)

    # State update and incident persistence must succeed despite alert failure!
    assert incident is not None
    assert incident.status == IncidentStatus.OPEN.value
    assert service.current_state == ServiceState.DOWN.value
