const BASE_URL = import.meta.env.VITE_API_URL || '';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!res.ok) {
      let errorMessage = `HTTP ${res.status} ${res.statusText}`;
      try {
        const errorData = await res.json();
        if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string'
            ? errorData.detail
            : JSON.stringify(errorData.detail);
        }
      } catch {
        // Fallback to status text
      }
      throw new Error(errorMessage);
    }

    // 204 No Content
    if (res.status === 204) return null;
    return await res.json();
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Network error: Unable to connect to monitoring API');
    }
    throw err;
  }
}

/**
 * System Health
 */
export async function getSystemHealth() {
  return request('/health');
}

/**
 * Dashboard Overview Aggregation
 */
export async function getDashboardOverview() {
  return request('/api/dashboard');
}

/**
 * Services CRUD
 */
export async function getServices() {
  return request('/api/services');
}

export async function getService(id) {
  return request(`/api/services/${id}`);
}

export async function createService(data) {
  return request('/api/services', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateService(id, data) {
  return request(`/api/services/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteService(id) {
  return request(`/api/services/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Service Checks & Summary
 */
export async function triggerServiceCheck(id) {
  return request(`/api/services/${id}/check`, {
    method: 'POST',
  });
}

export async function triggerCheckAll() {
  return request('/api/services/check-all', {
    method: 'POST',
  });
}

export async function getServiceChecks(id, { limit = 50, skip = 0, success = null } = {}) {
  const params = new URLSearchParams({ limit: String(limit), skip: String(skip) });
  if (success !== null) params.append('success', String(success));
  return request(`/api/services/${id}/checks?${params.toString()}`);
}

export async function getServiceSummary(id) {
  return request(`/api/services/${id}/summary`);
}

/**
 * Incidents
 */
export async function getIncidents({ status = null, serviceId = null, limit = 50 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.append('status', status);
  if (serviceId) params.append('service_id', String(serviceId));
  return request(`/api/incidents?${params.toString()}`);
}

export async function getServiceIncidents(serviceId) {
  return request(`/api/services/${serviceId}/incidents`);
}
