const BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Fetch dashboard aggregated overview metrics
 */
export async function fetchDashboard() {
  const res = await fetch(`${BASE_URL}/api/dashboard`);
  if (!res.ok) {
    throw new Error(`Failed to fetch dashboard data: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Register a new monitored service
 */
export async function createService(serviceData) {
  const res = await fetch(`${BASE_URL}/api/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serviceData),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to create service: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Delete a monitored service
 */
export async function deleteService(id) {
  const res = await fetch(`${BASE_URL}/api/services/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to delete service: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Manually trigger health check for a specific service
 */
export async function triggerServiceCheck(id) {
  const res = await fetch(`${BASE_URL}/api/services/${id}/check`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Health check probe failed: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Manually trigger concurrent health checks on all active services
 */
export async function triggerCheckAll() {
  const res = await fetch(`${BASE_URL}/api/services/check-all`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Check all failed: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch check history for a specific service
 */
export async function fetchServiceChecks(id, limit = 30) {
  const res = await fetch(`${BASE_URL}/api/services/${id}/checks?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch service history: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch incidents list
 */
export async function fetchIncidents(limit = 20) {
  const res = await fetch(`${BASE_URL}/api/incidents?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch incidents: HTTP ${res.status}`);
  }
  return res.json();
}
