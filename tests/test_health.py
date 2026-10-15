import pytest
from httpx import AsyncClient
from unittest.mock import patch


@pytest.mark.asyncio
async def test_root_health_endpoint(client: AsyncClient):
    """Verify that GET /health returns HTTP 200 and indicates API and DB status."""
    response = await client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["app"] == "Uptime Monitoring System"
    assert data["database"] == "connected"
    assert "version" in data
    assert "environment" in data


@pytest.mark.asyncio
async def test_root_health_skip_db(client: AsyncClient):
    """Verify that GET /health?check_db=false skips database verification."""
    response = await client.get("/health?check_db=false")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] is None


@pytest.mark.asyncio
async def test_api_v1_health_endpoint(client: AsyncClient):
    """Verify that GET /api/v1/health returns HTTP 200."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"


@pytest.mark.asyncio
async def test_api_v1_health_db_endpoint(client: AsyncClient):
    """Verify that GET /api/v1/health/db returns reachable status."""
    response = await client.get("/api/v1/health/db")
    assert response.status_code == 200

    data = response.json()
    assert data["database"] == "connected"
    assert data["reachable"] is True


@pytest.mark.asyncio
async def test_health_degraded_when_db_fails(client: AsyncClient):
    """Verify that when database is unreachable, health endpoint reports degraded."""
    with patch(
        "app.api.v1.endpoints.health.check_database_connectivity",
        return_value=False,
    ), patch(
        "app.main.check_database_connectivity",
        return_value=False,
    ):
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["database"] == "unreachable"
