from fastapi import APIRouter

from app.api.v1.endpoints import health, services

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(services.router, prefix="/services", tags=["Services"])
