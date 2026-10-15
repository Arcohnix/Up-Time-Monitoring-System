import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import Match

from app.api.deps import get_db
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.metrics import record_api_request
from app.db.session import engine
from app.schemas.health import HealthResponse
from app.services.health import check_database_connectivity

# Configure structured logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("utms")


class PrometheusMiddleware(BaseHTTPMiddleware):
    """ASGI middleware to capture request count and latency histograms."""

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/metrics":
            return await call_next(request)

        start_time = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start_time

        # Match route template to avoid unbounded cardinality
        endpoint = "unmatched"
        for route in request.app.routes:
            match, _ = route.matches(request.scope)
            if match == Match.FULL:
                endpoint = getattr(route, "path", request.url.path)
                break

        record_api_request(
            method=request.method,
            endpoint=endpoint,
            status_code=response.status_code,
            duration_seconds=duration,
        )
        return response


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

    # Observability: Prometheus Request Instrumentation Middleware
    application.add_middleware(PrometheusMiddleware)

    # Cross-Origin Resource Sharing (CORS)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Prometheus scrape endpoint: GET /metrics
    @application.get(
        "/metrics",
        tags=["Observability"],
        summary="Prometheus Metrics Scrape Endpoint",
        description="Exposes application and monitoring metrics in Prometheus format.",
    )
    def metrics() -> Response:
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

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

    # Monitoring worker heartbeat and self-health probe: GET /health/heartbeat
    @application.get(
        "/health/heartbeat",
        tags=["Health"],
        summary="Monitoring Worker Heartbeat & Self-Health",
        description="Verifies API responsiveness, background scheduler status, and worker heartbeat freshness.",
    )
    def worker_heartbeat(
        response: Response,
        stale_threshold: float = Query(30.0, description="Max acceptable seconds since last heartbeat"),
    ) -> dict:
        from app.checker.scheduler import get_scheduler_heartbeat

        hb = get_scheduler_heartbeat(stale_threshold_seconds=stale_threshold)
        api_alive = True
        scheduler_running = hb["scheduler_running"]
        worker_alive = hb["worker_alive"]

        is_healthy = api_alive and scheduler_running and worker_alive
        if not is_healthy:
            response.status_code = 503

        return {
            "status": "healthy" if is_healthy else "unhealthy",
            "api_alive": api_alive,
            "scheduler_running": scheduler_running,
            "worker_alive": worker_alive,
            "last_heartbeat_timestamp": hb["last_heartbeat_timestamp"],
            "seconds_since_last_heartbeat": hb["seconds_since_last_heartbeat"],
            "ticks_count": hb["ticks_count"],
            "in_flight_checks": hb["in_flight_checks"],
            "stale_threshold_seconds": stale_threshold,
        }

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
