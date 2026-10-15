from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import settings
from app.schemas.health import HealthResponse
from app.services.health import check_database_connectivity

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Application Health Status",
    description="Returns the status of the API application and its database connectivity.",
)
async def get_health(
    check_db: bool = Query(
        True,
        description="Whether to perform a live database connectivity check",
    ),
    db: AsyncSession = Depends(get_db),
) -> HealthResponse:
    database_status = None
    overall_status = "healthy"

    if check_db:
        db_connected = await check_database_connectivity(db)
        database_status = "connected" if db_connected else "unreachable"
        if not db_connected:
            overall_status = "degraded"

    return HealthResponse(
        status=overall_status,
        app=settings.PROJECT_NAME,
        environment=settings.ENVIRONMENT,
        version=settings.VERSION,
        database=database_status,
    )


@router.get(
    "/health/db",
    summary="Database Connectivity Check",
    description="Explicitly tests database connection reachability.",
)
async def check_db_health(
    db: AsyncSession = Depends(get_db),
) -> dict:
    is_connected = await check_database_connectivity(db)
    return {
        "database": "connected" if is_connected else "unreachable",
        "reachable": is_connected,
    }


@router.get(
    "/health/heartbeat",
    summary="Monitoring Worker Heartbeat Status",
    description="Explicitly tests background scheduler activity and worker heartbeat freshness.",
)
async def check_heartbeat(
    stale_threshold: float = Query(30.0, description="Max acceptable seconds since last heartbeat"),
) -> dict:
    from app.checker.scheduler import get_scheduler_heartbeat

    hb = get_scheduler_heartbeat(stale_threshold_seconds=stale_threshold)
    is_healthy = hb["scheduler_running"] and hb["worker_alive"]
    return {
        "status": "healthy" if is_healthy else "unhealthy",
        "api_alive": True,
        **hb,
    }
