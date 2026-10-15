from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.service import ServiceCreate, ServiceResponse, ServiceUpdate
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
