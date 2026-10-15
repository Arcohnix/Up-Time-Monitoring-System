from fastapi import APIRouter

from app.api.v1.endpoints import dashboard, health, incidents, services

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(services.router, prefix="/services", tags=["Services"])
api_router.include_router(incidents.router, prefix="/incidents", tags=["Incidents"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
