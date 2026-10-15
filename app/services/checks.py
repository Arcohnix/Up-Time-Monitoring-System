import logging
from datetime import datetime
from typing import List, Optional

from sqlalchemy import case, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.checker.schemas import ServiceSummary
from app.models.check_result import CheckResultModel
from app.models.service import Service

logger = logging.getLogger(__name__)


async def get_service_checks(
    db: AsyncSession,
    service_id: int,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    success: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[CheckResultModel]:
    """Retrieve historical health check records for a service with filtering and pagination."""
    statement = (
        select(CheckResultModel)
        .where(CheckResultModel.service_id == service_id)
        .order_by(desc(CheckResultModel.checked_at))
        .offset(skip)
        .limit(limit)
    )

    if start_time is not None:
        statement = statement.where(CheckResultModel.checked_at >= start_time)
    if end_time is not None:
        statement = statement.where(CheckResultModel.checked_at <= end_time)
    if success is not None:
        statement = statement.where(CheckResultModel.success.is_(success))

    result = await db.execute(statement)
    return list(result.scalars().all())


async def get_service_summary(
    db: AsyncSession,
    service: Service,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> ServiceSummary:
    """Calculate aggregated uptime percentage, average latency, and check counts for a service."""
    stmt = (
        select(
            func.count(CheckResultModel.id).label("total_checks"),
            func.sum(case((CheckResultModel.success.is_(True), 1), else_=0)).label("successful_checks"),
            func.sum(case((CheckResultModel.success.is_(False), 1), else_=0)).label("failed_checks"),
            func.avg(
                case(
                    (CheckResultModel.success.is_(True), CheckResultModel.response_time_ms),
                    else_=None,
                )
            ).label("avg_response_time"),
        )
        .where(CheckResultModel.service_id == service.id)
    )

    if start_time is not None:
        stmt = stmt.where(CheckResultModel.checked_at >= start_time)
    if end_time is not None:
        stmt = stmt.where(CheckResultModel.checked_at <= end_time)

    row = (await db.execute(stmt)).one()

    total_checks = int(row.total_checks or 0)
    successful_checks = int(row.successful_checks or 0)
    failed_checks = int(row.failed_checks or 0)

    avg_response_time = (
        round(float(row.avg_response_time), 2)
        if row.avg_response_time is not None
        else None
    )

    uptime_percentage = (
        round((successful_checks / total_checks) * 100.0, 2)
        if total_checks > 0
        else 0.0
    )

    return ServiceSummary(
        service_id=service.id,
        service_name=service.name,
        uptime_percentage=uptime_percentage,
        avg_response_time_ms=avg_response_time,
        total_checks=total_checks,
        successful_checks=successful_checks,
        failed_checks=failed_checks,
        start_time=start_time,
        end_time=end_time,
    )
