from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.checker.runner import check_all_enabled_services, check_service
from app.checker.schemas import CheckResult, ServiceSummary
from app.schemas.service import ServiceCreate, ServiceResponse, ServiceUpdate
from app.services.checks import get_service_checks, get_service_summary
from app.services.service_manager import (
    create_service,
    delete_service,
    get_service_by_id,
    get_services,
    update_service,
)

router = APIRouter()


@router.post(
    "",
    response_model=ServiceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new monitored service",
    description="Registers an HTTP/HTTPS endpoint to be monitored with specific intervals, timeouts, and expected codes.",
)
async def create_new_service(
    service_in: ServiceCreate,
    db: AsyncSession = Depends(get_db),
) -> ServiceResponse:
    service = await create_service(db=db, service_in=service_in)
    return ServiceResponse.model_validate(service)


@router.get(
    "",
    response_model=List[ServiceResponse],
    summary="List all monitored services",
    description="Returns a paginated list of registered services with optional active/inactive status filter.",
)
async def list_services(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Max records to return"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db),
) -> List[ServiceResponse]:
    services = await get_services(db=db, skip=skip, limit=limit, is_active=is_active)
    return [ServiceResponse.model_validate(s) for s in services]


@router.post(
    "/check-all",
    response_model=List[CheckResult],
    summary="Manually trigger health checks for all enabled services",
    description="Executes concurrent health checks on all active services and returns their structured results.",
)
async def check_all_services_endpoint(
    persist: bool = Query(True, description="Whether to store check results in the database"),
    concurrency: int = Query(10, ge=1, le=100, description="Max concurrent checks"),
    db: AsyncSession = Depends(get_db),
) -> List[CheckResult]:
    return await check_all_enabled_services(
        db=db,
        persist=persist,
        max_concurrency=concurrency,
    )


@router.get(
    "/{id}",
    response_model=ServiceResponse,
    summary="Get service details",
    description="Retrieves a single monitored service by its ID.",
)
async def get_service(
    id: int,
    db: AsyncSession = Depends(get_db),
) -> ServiceResponse:
    service = await get_service_by_id(db=db, service_id=id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with id {id} not found",
        )
    return ServiceResponse.model_validate(service)


@router.post(
    "/{id}/check",
    response_model=CheckResult,
    summary="Manually trigger a health check for a specific service",
    description="Executes a live health check for the specified service and returns the structured result.",
)
async def check_single_service_endpoint(
    id: int,
    persist: bool = Query(True, description="Whether to store check result in the database"),
    db: AsyncSession = Depends(get_db),
) -> CheckResult:
    service = await get_service_by_id(db=db, service_id=id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with id {id} not found",
        )
    return await check_service(service=service, db=db, persist=persist)


@router.get(
    "/{id}/checks",
    response_model=List[CheckResult],
    summary="Get historical check results for a service",
    description="Retrieves historical health checks with filtering for time range, status, and pagination.",
)
async def get_service_check_history(
    id: int,
    start_time: Optional[datetime] = Query(None, description="Filter checks from this timestamp"),
    end_time: Optional[datetime] = Query(None, description="Filter checks up to this timestamp"),
    success: Optional[bool] = Query(None, description="Filter by check outcome (true=success, false=failed)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Max records to return"),
    db: AsyncSession = Depends(get_db),
) -> List[CheckResult]:
    service = await get_service_by_id(db=db, service_id=id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with id {id} not found",
        )
    records = await get_service_checks(
        db=db,
        service_id=id,
        start_time=start_time,
        end_time=end_time,
        success=success,
        skip=skip,
        limit=limit,
    )
    return [CheckResult.model_validate(r) for r in records]


@router.get(
    "/{id}/summary",
    response_model=ServiceSummary,
    summary="Get uptime and latency summary for a service",
    description="Returns aggregated metrics including uptime percentage, average response latency, and check counts.",
)
async def get_service_health_summary(
    id: int,
    start_time: Optional[datetime] = Query(None, description="Start timestamp of evaluation window"),
    end_time: Optional[datetime] = Query(None, description="End timestamp of evaluation window"),
    hours: Optional[int] = Query(None, ge=1, le=8760, description="Shortcut to evaluate last N hours"),
    db: AsyncSession = Depends(get_db),
) -> ServiceSummary:
    service = await get_service_by_id(db=db, service_id=id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with id {id} not found",
        )

    eval_start = start_time
    eval_end = end_time

    if hours is not None and eval_start is None:
        eval_start = datetime.now(timezone.utc) - timedelta(hours=hours)

    return await get_service_summary(
        db=db,
        service=service,
        start_time=eval_start,
        end_time=eval_end,
    )


@router.patch(
    "/{id}",
    response_model=ServiceResponse,
    summary="Update a monitored service",
    description="Applies partial updates to a service's configuration.",
)
async def patch_service(
    id: int,
    service_update: ServiceUpdate,
    db: AsyncSession = Depends(get_db),
) -> ServiceResponse:
    service = await get_service_by_id(db=db, service_id=id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with id {id} not found",
        )
    try:
        updated = await update_service(db=db, service=service, service_update=service_update)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        )
    return ServiceResponse.model_validate(updated)


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a monitored service",
    description="Removes a service from monitoring.",
)
async def remove_service(
    id: int,
    db: AsyncSession = Depends(get_db),
) -> Response:
    service = await get_service_by_id(db=db, service_id=id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with id {id} not found",
        )
    await delete_service(db=db, service=service)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
