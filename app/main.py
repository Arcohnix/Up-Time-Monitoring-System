import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import engine
from app.schemas.health import HealthResponse
from app.services.health import check_database_connectivity

# Configure structured logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("utms")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager for startup and shutdown routines."""
    logger.info("Starting %s v%s in %s mode", settings.PROJECT_NAME, settings.VERSION, settings.ENVIRONMENT)

    scheduler = None
    if settings.ENABLE_SCHEDULER:
        from app.checker.scheduler import get_scheduler
        scheduler = get_scheduler()
        await scheduler.start()

    try:
        yield
    finally:
        if scheduler is not None:
            await scheduler.stop()
        logger.info("Shutting down %s, releasing database connections...", settings.PROJECT_NAME)
        await engine.dispose()
        logger.info("Cleanup complete.")


def create_application() -> FastAPI:
    """FastAPI application factory."""
    application = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # Cross-Origin Resource Sharing (CORS)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Direct root health endpoint for top-level liveness/readiness probes: GET /health
    @application.get(
        "/health",
        response_model=HealthResponse,
        tags=["Health"],
        summary="Root Health Check",
        description="Indicates that the API itself is running and reports database connectivity.",
    )
    async def root_health(
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

    # Mount API routes
    application.include_router(api_router, prefix=settings.API_V1_STR)
    from app.api.v1.endpoints import dashboard as dashboard_endpoint
    from app.api.v1.endpoints import incidents as incidents_endpoint
    from app.api.v1.endpoints import services as services_endpoint
    application.include_router(services_endpoint.router, prefix="/api/services", tags=["Services"])
    application.include_router(incidents_endpoint.router, prefix="/api/incidents", tags=["Incidents"])
    application.include_router(dashboard_endpoint.router, prefix="/api/dashboard", tags=["Dashboard"])

    # Optionally serve compiled React SPA if built
    import os
    frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
    if os.path.exists(frontend_dist):
        from fastapi.staticfiles import StaticFiles
        application.mount("/dashboard", StaticFiles(directory=frontend_dist, html=True), name="dashboard")

    return application


app = create_application()
