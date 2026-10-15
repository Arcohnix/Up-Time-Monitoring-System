import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import List, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.checker.schemas import CheckResult, ErrorType
from app.models.check_result import CheckResultModel
from app.models.service import Service

logger = logging.getLogger(__name__)


async def check_service(
    service: Service,
    client: Optional[httpx.AsyncClient] = None,
    db: Optional[AsyncSession] = None,
    persist: bool = True,
) -> CheckResult:
    """Perform an isolated, asynchronous HTTP health check on a single service.

    Guarantees that:
    1. Network errors, timeouts, and unexpected exceptions are captured into a structured CheckResult.
    2. Completed checks are safely persisted to the database if a session is provided.
    3. Storage/database failures never crash or disrupt the monitoring process.
    """
    should_close_client = False
    if client is None:
        client = httpx.AsyncClient()
        should_close_client = True

    start_time = time.perf_counter()
    checked_at = datetime.now(timezone.utc)
    method = (service.http_method or "GET").upper()
    timeout = httpx.Timeout(service.timeout_seconds)

    try:
        response = await client.request(
            method=method,
            url=service.url,
            timeout=timeout,
            follow_redirects=True,
        )
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        status_code = response.status_code

        # Evaluate success condition against expected status code
        if service.expected_status_code:
            is_success = (status_code == service.expected_status_code)
        else:
            is_success = (200 <= status_code < 300)

        error_type = None
        error_message = None
        if not is_success:
            error_type = ErrorType.HTTP_STATUS.value
            error_message = (
                f"Received status code {status_code}, expected {service.expected_status_code}"
            )

        result = CheckResult(
            service_id=service.id,
            checked_at=checked_at,
            success=is_success,
            status_code=status_code,
            response_time_ms=elapsed_ms,
            error_type=error_type,
            error_message=error_message,
        )

    except httpx.TimeoutException as exc:
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.debug("Timeout checking service %s (%s): %s", service.id, service.url, exc)
        result = CheckResult(
            service_id=service.id,
            checked_at=checked_at,
            success=False,
            status_code=None,
            response_time_ms=elapsed_ms,
            error_type=ErrorType.TIMEOUT.value,
            error_message=f"Request timed out after {service.timeout_seconds}s ({type(exc).__name__})",
        )

    except (httpx.ConnectError, httpx.NetworkError) as exc:
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.debug("Network error checking service %s (%s): %s", service.id, service.url, exc)
        result = CheckResult(
            service_id=service.id,
            checked_at=checked_at,
            success=False,
            status_code=None,
            response_time_ms=elapsed_ms,
            error_type=ErrorType.CONNECTION_ERROR.value,
            error_message=f"Connection failed: {str(exc) or type(exc).__name__}",
        )

    except Exception as exc:
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.error(
            "Unexpected error checking service %s (%s): %s",
            service.id,
            service.url,
            exc,
            exc_info=True,
        )
        result = CheckResult(
            service_id=service.id,
            checked_at=checked_at,
            success=False,
            status_code=None,
            response_time_ms=elapsed_ms,
            error_type=ErrorType.UNEXPECTED_ERROR.value,
            error_message=f"Unexpected error: {type(exc).__name__}: {str(exc)}",
        )

    finally:
        if should_close_client:
            await client.aclose()

    # Safely persist check result to database if session is provided
    if persist and db is not None:
        try:
            db_record = CheckResultModel(
                service_id=result.service_id,
                checked_at=result.checked_at,
                success=result.success,
                status_code=result.status_code,
                response_time_ms=result.response_time_ms,
                error_type=result.error_type,
                error_message=result.error_message,
            )
            db.add(db_record)
            await db.commit()
            result.id = db_record.id

            # Evaluate state transitions and incident detection/recovery
            try:
                from app.incidents.manager import process_check_result
                await process_check_result(db=db, service=service, result=result)
            except Exception as inc_exc:
                logger.error(
                    "Incident evaluation error for service %s: %s",
                    service.id,
                    inc_exc,
                    exc_info=True,
                )
        except Exception as db_exc:
            logger.error(
                "Database error: Failed to persist check result for service %s: %s",
                result.service_id,
                db_exc,
                exc_info=True,
            )
            try:
                await db.rollback()
            except Exception:
                pass

    return result


async def check_all_enabled_services(
    db: AsyncSession,
    client: Optional[httpx.AsyncClient] = None,
    persist: bool = True,
    max_concurrency: int = 10,
) -> List[CheckResult]:
    """Select all enabled services from the database and check them concurrently.

    Guarantees that:
    1. Checks execute concurrently bounded by a semaphore.
    2. Slow or failing checks never interrupt other probes.
    3. Every completed check is safely persisted without aborting on individual database errors.
    """
    statement = select(Service).where(Service.is_active.is_(True))
    exec_result = await db.execute(statement)
    enabled_services = list(exec_result.scalars().all())

    if not enabled_services:
        return []

    should_close_client = False
    active_client = client
    if active_client is None:
        active_client = httpx.AsyncClient()
        should_close_client = True

    semaphore = asyncio.Semaphore(max_concurrency)

    async def _bound_check(srv: Service) -> CheckResult:
        async with semaphore:
            return await check_service(
                service=srv,
                client=active_client,
                db=None,  # Handled safely below
                persist=False,
            )

    try:
        tasks = [_bound_check(srv) for srv in enabled_services]
        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

        results: List[CheckResult] = []
        for srv, res in zip(enabled_services, raw_results):
            if isinstance(res, Exception):
                logger.error("Service %s check failed with exception: %s", srv.id, res)
                results.append(
                    CheckResult(
                        service_id=srv.id,
                        checked_at=datetime.now(timezone.utc),
                        success=False,
                        status_code=None,
                        response_time_ms=None,
                        error_type=ErrorType.UNEXPECTED_ERROR.value,
                        error_message=f"Task error: {type(res).__name__}: {str(res)}",
                    )
                )
            else:
                results.append(res)

        # Safely persist completed checks and evaluate incidents
        if persist:
            for srv, r in zip(enabled_services, results):
                try:
                    db_record = CheckResultModel(
                        service_id=r.service_id,
                        checked_at=r.checked_at,
                        success=r.success,
                        status_code=r.status_code,
                        response_time_ms=r.response_time_ms,
                        error_type=r.error_type,
                        error_message=r.error_message,
                    )
                    db.add(db_record)
                    await db.commit()
                    r.id = db_record.id

                    # Evaluate state transitions and incident detection/recovery
                    try:
                        from app.incidents.manager import process_check_result
                        await process_check_result(db=db, service=srv, result=r)
                    except Exception as inc_exc:
                        logger.error(
                            "Incident evaluation error for service %s: %s",
                            srv.id,
                            inc_exc,
                            exc_info=True,
                        )

                except Exception as db_exc:
                    logger.error(
                        "Database error: Failed to persist check result for service %s: %s",
                        r.service_id,
                        db_exc,
                        exc_info=True,
                    )
                    try:
                        await db.rollback()
                    except Exception:
                        pass

        return results

    finally:
        if should_close_client:
            await active_client.aclose()
