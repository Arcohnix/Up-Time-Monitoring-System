from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.service import Service
from app.schemas.service import ServiceCreate, ServiceUpdate


async def create_service(db: AsyncSession, service_in: ServiceCreate) -> Service:
    """Persist a new monitored service entity."""
    db_service = Service(
        name=service_in.name,
        url=service_in.url,
        http_method=service_in.http_method,
        check_interval_seconds=service_in.check_interval_seconds,
        timeout_seconds=service_in.timeout_seconds,
        expected_status_code=service_in.expected_status_code,
        is_active=service_in.is_active,
    )
    db.add(db_service)
    await db.commit()
    await db.refresh(db_service)
    return db_service


async def get_service_by_id(db: AsyncSession, service_id: int) -> Optional[Service]:
    """Retrieve a single service by primary key."""
    statement = select(Service).where(Service.id == service_id)
    result = await db.execute(statement)
    return result.scalar_one_or_none()


async def get_services(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
) -> List[Service]:
    """Retrieve a list of monitored services with optional filtering and pagination."""
    statement = select(Service).order_by(Service.id.asc()).offset(skip).limit(limit)
    if is_active is not None:
        statement = statement.where(Service.is_active == is_active)

    result = await db.execute(statement)
    return list(result.scalars().all())


async def update_service(
    db: AsyncSession,
    service: Service,
    service_update: ServiceUpdate,
) -> Service:
    """Apply partial updates to an existing service with cross-field constraint validation."""
    update_data = service_update.model_dump(exclude_unset=True)

    # Cross-field validation between incoming and existing values
    target_interval = update_data.get("check_interval_seconds", service.check_interval_seconds)
    target_timeout = update_data.get("timeout_seconds", service.timeout_seconds)

    if target_timeout > target_interval:
        raise ValueError("Timeout cannot exceed the check interval")

    for field, value in update_data.items():
        setattr(service, field, value)

    await db.commit()
    await db.refresh(service)
    return service


async def delete_service(db: AsyncSession, service: Service) -> None:
    """Delete a monitored service."""
    await db.delete(service)
    await db.commit()
