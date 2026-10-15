import asyncio
import time
from typing import Dict
import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.checker.runner import check_all_enabled_services, check_service
from app.checker.schemas import ErrorType
from app.models.check_result import CheckResultModel
from app.models.service import Service


def create_mock_transport(url_responses: Dict[str, any]) -> httpx.MockTransport:
    """Helper to produce a mock transport with mapped behaviors per URL keyword."""
    async def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        for keyword, outcome in url_responses.items():
            if keyword in url_str:
                if isinstance(outcome, Exception):
                    raise outcome
                if callable(outcome):
                    return await outcome(request)
                return outcome
        return httpx.Response(200, json={"status": "default_ok"})

    return httpx.MockTransport(handler)


@pytest.mark.asyncio
async def test_check_service_success():
    """Demonstrate that successful endpoint checks work and measure response time."""
    transport = create_mock_transport({
        "api.example.com": httpx.Response(200, json={"status": "healthy"}),
    })
    async with httpx.AsyncClient(transport=transport) as client:
        service = Service(
            id=1,
            name="API Gateway",
            url="https://api.example.com/health",
            http_method="GET",
            check_interval_seconds=60,
            timeout_seconds=5,
            expected_status_code=200,
            is_active=True,
        )

        result = await check_service(service, client=client)

        assert result.service_id == 1
        assert result.success is True
        assert result.status_code == 200
        assert result.response_time_ms is not None
        assert result.response_time_ms >= 0
        assert result.error_type is None
        assert result.error_message is None


@pytest.mark.asyncio
async def test_check_service_non_2xx_detected():
    """Demonstrate that non-2xx status codes (and mismatches with expected code) are detected."""
    transport = create_mock_transport({
        "server-error": httpx.Response(500, text="Internal Server Error"),
        "not-found": httpx.Response(404, text="Not Found"),
    })
    async with httpx.AsyncClient(transport=transport) as client:
        # Test 500 error
        service_500 = Service(
            id=2,
            name="Broken Service",
            url="https://example.com/server-error",
            expected_status_code=200,
            timeout_seconds=5,
        )
        res_500 = await check_service(service_500, client=client)
        assert res_500.success is False
        assert res_500.status_code == 500
        assert res_500.error_type == ErrorType.HTTP_STATUS.value
        assert "500" in res_500.error_message

        # Test 404 error
        service_404 = Service(
            id=3,
            name="Missing Route",
            url="https://example.com/not-found",
            expected_status_code=200,
            timeout_seconds=5,
        )
        res_404 = await check_service(service_404, client=client)
        assert res_404.success is False
        assert res_404.status_code == 404
        assert res_404.error_type == ErrorType.HTTP_STATUS.value
        assert "404" in res_404.error_message


@pytest.mark.asyncio
async def test_check_service_timeout_handled():
    """Demonstrate that request timeouts are gracefully captured and recorded."""
    transport = create_mock_transport({
        "timeout": httpx.ReadTimeout("The read operation timed out", request=None),
    })
    async with httpx.AsyncClient(transport=transport) as client:
        service = Service(
            id=4,
            name="Slow Service",
            url="https://example.com/timeout",
            timeout_seconds=2,
            expected_status_code=200,
        )

        result = await check_service(service, client=client)

        assert result.success is False
        assert result.status_code is None
        assert result.error_type == ErrorType.TIMEOUT.value
        assert "timed out" in result.error_message.lower()
        assert result.response_time_ms is not None


@pytest.mark.asyncio
async def test_check_service_connection_error_handled():
    """Demonstrate that connection errors (DNS, refused connection) are handled safely."""
    transport = create_mock_transport({
        "connection-fail": httpx.ConnectError("Failed to establish a connection", request=None),
    })
    async with httpx.AsyncClient(transport=transport) as client:
        service = Service(
            id=5,
            name="Unreachable Host",
            url="https://example.com/connection-fail",
            timeout_seconds=5,
            expected_status_code=200,
        )

        result = await check_service(service, client=client)

        assert result.success is False
        assert result.status_code is None
        assert result.error_type == ErrorType.CONNECTION_ERROR.value
        assert "connection failed" in result.error_message.lower()


@pytest.mark.asyncio
async def test_check_service_unexpected_exception_safety():
    """Demonstrate that unexpected exceptions do not crash the checker."""
    transport = create_mock_transport({
        "crash": RuntimeError("Simulated internal runtime fault"),
    })
    async with httpx.AsyncClient(transport=transport) as client:
        service = Service(
            id=6,
            name="Faulty Service",
            url="https://example.com/crash",
            timeout_seconds=5,
        )

        result = await check_service(service, client=client)

        assert result.success is False
        assert result.error_type == ErrorType.UNEXPECTED_ERROR.value
        assert "RuntimeError" in result.error_message


@pytest.mark.asyncio
async def test_check_multiple_services_concurrently(test_session: AsyncSession):
    """Demonstrate that multiple services are checked concurrently rather than sequentially."""
    sleep_delay = 0.08
    service_count = 5

    async def delayed_handler(request: httpx.Request) -> httpx.Response:
        await asyncio.sleep(sleep_delay)
        return httpx.Response(200, json={"ok": True})

    transport = httpx.MockTransport(delayed_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        # Populate test database with enabled services
        for i in range(1, service_count + 1):
            service = Service(
                name=f"Service {i}",
                url=f"https://service-{i}.example.com/health",
                check_interval_seconds=60,
                timeout_seconds=5,
                expected_status_code=200,
                is_active=True,
            )
            test_session.add(service)
        await test_session.commit()

        start_time = time.perf_counter()
        results = await check_all_enabled_services(
            db=test_session,
            client=client,
            max_concurrency=service_count,
        )
        total_duration = time.perf_counter() - start_time

        assert len(results) == service_count
        assert all(r.success is True for r in results)

        # If executed sequentially: 5 * 0.08s = 0.40s.
        # Concurrently: should finish in approximately 0.08s - 0.25s.
        assert total_duration < 0.35, f"Expected concurrent execution, took {total_duration:.2f}s"


@pytest.mark.asyncio
async def test_failing_endpoint_does_not_block_peers(test_session: AsyncSession):
    """Demonstrate that slow or failing endpoints do not prevent healthy endpoints from completing."""
    async def mixed_handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        if "healthy" in url_str:
            return httpx.Response(200, json={"status": "ok"})
        elif "timeout" in url_str:
            # Simulate artificial delay followed by timeout
            await asyncio.sleep(0.05)
            raise httpx.ReadTimeout("Endpoint timed out", request=request)
        elif "connection-error" in url_str:
            raise httpx.ConnectError("Connection refused", request=request)
        elif "server-error" in url_str:
            return httpx.Response(500, text="Internal Error")
        return httpx.Response(200)

    transport = httpx.MockTransport(mixed_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        # Add 4 enabled services with different outcomes + 1 disabled service
        s1 = Service(name="Healthy 1", url="https://healthy-1.com", is_active=True, timeout_seconds=5)
        s2 = Service(name="Timeout Svc", url="https://timeout.com", is_active=True, timeout_seconds=5)
        s3 = Service(name="Conn Error Svc", url="https://connection-error.com", is_active=True, timeout_seconds=5)
        s4 = Service(name="Healthy 2", url="https://healthy-2.com", is_active=True, timeout_seconds=5)
        s5 = Service(name="Disabled Svc", url="https://disabled.com", is_active=False, timeout_seconds=5)

        test_session.add_all([s1, s2, s3, s4, s5])
        await test_session.commit()

        results = await check_all_enabled_services(
            db=test_session,
            client=client,
            persist=True,
            max_concurrency=4,
        )

        # Only 4 active services should have been checked
        assert len(results) == 4

        results_by_id = {r.service_id: r for r in results}

        # S1 (Healthy 1) succeeded
        assert results_by_id[s1.id].success is True
        assert results_by_id[s1.id].status_code == 200

        # S2 (Timeout) failed with TIMEOUT
        assert results_by_id[s2.id].success is False
        assert results_by_id[s2.id].error_type == ErrorType.TIMEOUT.value

        # S3 (Connection error) failed with CONNECTION_ERROR
        assert results_by_id[s3.id].success is False
        assert results_by_id[s3.id].error_type == ErrorType.CONNECTION_ERROR.value

        # S4 (Healthy 2) succeeded despite S2 and S3 failing!
        assert results_by_id[s4.id].success is True
        assert results_by_id[s4.id].status_code == 200

        # Verify results were persisted to check_results table
        db_records_stmt = select(CheckResultModel).order_by(CheckResultModel.service_id.asc())
        records = (await test_session.execute(db_records_stmt)).scalars().all()
        assert len(records) == 4
