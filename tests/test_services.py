import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_service_minimal(client: AsyncClient):
    """Verify creating a service with minimal valid fields uses proper defaults."""
    payload = {
        "name": "Production API",
        "url": "https://api.example.com/health",
    }
    response = await client.post("/api/services", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["id"] is not None
    assert data["name"] == "Production API"
    assert data["url"] == "https://api.example.com/health"
    assert data["http_method"] == "GET"
    assert data["check_interval_seconds"] == 60
    assert data["check_interval"] == 60
    assert data["timeout_seconds"] == 10
    assert data["timeout"] == 10
    assert data["expected_status_code"] == 200
    assert data["is_active"] is True
    assert data["enabled"] is True
    assert "created_at" in data
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_create_service_custom_and_aliases(client: AsyncClient):
    """Verify creating a service with custom attributes and aliased field names."""
    payload = {
        "name": "Staging Webhook",
        "url": "https://webhook.staging.example.com/ping",
        "http_method": "post",
        "check_interval": 30,
        "timeout": 5,
        "expected_status_code": 204,
        "enabled": False,
    }
    response = await client.post("/api/services", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["name"] == "Staging Webhook"
    assert data["http_method"] == "POST"
    assert data["check_interval_seconds"] == 30
    assert data["timeout_seconds"] == 5
    assert data["expected_status_code"] == 204
    assert data["is_active"] is False
    assert data["enabled"] is False


@pytest.mark.asyncio
async def test_create_service_validation_failures(client: AsyncClient):
    """Verify various validation failure scenarios return HTTP 422."""
    # 1. Missing required scheme
    res = await client.post("/api/services", json={"name": "Bad URL", "url": "api.example.com"})
    assert res.status_code == 422

    # 2. Unsupported scheme
    res = await client.post("/api/services", json={"name": "Bad Scheme", "url": "ftp://ftp.example.com"})
    assert res.status_code == 422

    # 3. Missing host
    res = await client.post("/api/services", json={"name": "No Host", "url": "https://"})
    assert res.status_code == 422

    # 4. Zero or negative interval
    res = await client.post("/api/services", json={"name": "Zero Interval", "url": "https://example.com", "check_interval": 0})
    assert res.status_code == 422

    # 5. Zero or negative timeout
    res = await client.post("/api/services", json={"name": "Negative Timeout", "url": "https://example.com", "timeout": -5})
    assert res.status_code == 422

    # 6. Timeout greater than interval
    res = await client.post("/api/services", json={"name": "Timeout > Interval", "url": "https://example.com", "check_interval": 10, "timeout": 15})
    assert res.status_code == 422

    # 7. Timeout exceeds maximum allowed 120s
    res = await client.post("/api/services", json={"name": "Excessive Timeout", "url": "https://example.com", "check_interval": 300, "timeout": 150})
    assert res.status_code == 422

    # 8. Invalid HTTP method
    res = await client.post("/api/services", json={"name": "Bad Method", "url": "https://example.com", "http_method": "INVALID"})
    assert res.status_code == 422

    # 9. Expected status code below 100 or above 599
    res = await client.post("/api/services", json={"name": "Code < 100", "url": "https://example.com", "expected_status_code": 99})
    assert res.status_code == 422
    res = await client.post("/api/services", json={"name": "Code > 599", "url": "https://example.com", "expected_status_code": 600})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_retrieve_services_list(client: AsyncClient):
    """Verify retrieving list of services and filtering by active status."""
    # Create two services
    await client.post("/api/services", json={"name": "Active Service", "url": "https://active.com", "is_active": True})
    await client.post("/api/services", json={"name": "Inactive Service", "url": "https://inactive.com", "is_active": False})

    # Retrieve all
    response = await client.get("/api/services")
    assert response.status_code == 200
    items = response.json()
    assert len(items) >= 2

    # Filter active only
    res_active = await client.get("/api/services?is_active=true")
    assert res_active.status_code == 200
    active_items = res_active.json()
    assert all(item["is_active"] is True for item in active_items)

    # Filter inactive only
    res_inactive = await client.get("/api/services?is_active=false")
    assert res_inactive.status_code == 200
    inactive_items = res_inactive.json()
    assert all(item["is_active"] is False for item in inactive_items)


@pytest.mark.asyncio
async def test_retrieve_single_service(client: AsyncClient):
    """Verify retrieving a single service by ID."""
    created = await client.post("/api/services", json={"name": "Target Service", "url": "https://target.com"})
    service_id = created.json()["id"]

    response = await client.get(f"/api/services/{service_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == service_id
    assert data["name"] == "Target Service"

    # Also verify route under /api/v1/services/{id}
    res_v1 = await client.get(f"/api/v1/services/{service_id}")
    assert res_v1.status_code == 200
    assert res_v1.json()["id"] == service_id


@pytest.mark.asyncio
async def test_retrieve_service_not_found(client: AsyncClient):
    """Verify 404 response for nonexistent service ID."""
    response = await client.get("/api/services/999999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_service(client: AsyncClient):
    """Verify updating service configuration."""
    created = await client.post(
        "/api/services",
        json={
            "name": "Original Name",
            "url": "https://original.com",
            "check_interval": 60,
            "timeout": 10,
        },
    )
    service_id = created.json()["id"]

    update_payload = {
        "name": "Updated Name",
        "url": "https://updated.com/health",
        "expected_status_code": 204,
        "check_interval": 45,
        "timeout": 8,
        "is_active": False,
    }
    response = await client.patch(f"/api/services/{service_id}", json=update_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["url"] == "https://updated.com/health"
    assert data["expected_status_code"] == 204
    assert data["check_interval_seconds"] == 45
    assert data["timeout_seconds"] == 8
    assert data["is_active"] is False


@pytest.mark.asyncio
async def test_update_service_cross_field_validation(client: AsyncClient):
    """Verify cross-field validation on partial updates against existing service values."""
    created = await client.post(
        "/api/services",
        json={
            "name": "Interval Test",
            "url": "https://interval-test.com",
            "check_interval": 30,
            "timeout": 10,
        },
    )
    service_id = created.json()["id"]

    # Attempt to set interval lower than existing timeout (10s)
    res1 = await client.patch(f"/api/services/{service_id}", json={"check_interval": 5})
    assert res1.status_code == 422

    # Attempt to set timeout higher than existing interval (30s)
    res2 = await client.patch(f"/api/services/{service_id}", json={"timeout": 35})
    assert res2.status_code == 422


@pytest.mark.asyncio
async def test_update_service_not_found(client: AsyncClient):
    """Verify updating nonexistent service returns 404."""
    response = await client.patch("/api/services/999999", json={"name": "Doesn't Exist"})
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_service(client: AsyncClient):
    """Verify deleting a service returns 204 and service is no longer retrievable."""
    created = await client.post("/api/services", json={"name": "To Delete", "url": "https://todelete.com"})
    service_id = created.json()["id"]

    # Delete
    delete_res = await client.delete(f"/api/services/{service_id}")
    assert delete_res.status_code == 204

    # Verify not found
    get_res = await client.get(f"/api/services/{service_id}")
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_delete_service_not_found(client: AsyncClient):
    """Verify deleting nonexistent service returns 404."""
    response = await client.delete("/api/services/999999")
    assert response.status_code == 404
