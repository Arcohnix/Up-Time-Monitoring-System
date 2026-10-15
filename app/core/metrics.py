"""Prometheus metrics registry and helper instrumentation functions for UTMS."""

import time
from typing import Optional

from prometheus_client import Counter, Gauge, Histogram

# ------------------------------------------------------------------------------
# 1. Monitored Services Metrics
# ------------------------------------------------------------------------------
utms_monitored_services_total = Gauge(
    "utms_monitored_services_total",
    "Number of monitored services grouped by administrative status",
    ["status"],  # "enabled", "disabled"
)

# ------------------------------------------------------------------------------
# 2. Check Execution & Reliability Metrics
# ------------------------------------------------------------------------------
utms_checks_total = Counter(
    "utms_checks_total",
    "Total number of HTTP monitoring checks performed",
    ["service_name", "method", "status"],  # status="success" or "failed"
)

utms_checks_success_total = Counter(
    "utms_checks_success_total",
    "Total number of successful health checks",
    ["service_name"],
)

utms_checks_failed_total = Counter(
    "utms_checks_failed_total",
    "Total number of failed health checks",
    ["service_name", "error_type"],
)

utms_check_duration_seconds = Histogram(
    "utms_check_duration_seconds",
    "Duration of HTTP health check requests in seconds",
    ["service_name"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

# ------------------------------------------------------------------------------
# 3. Incident Lifecycle Metrics
# ------------------------------------------------------------------------------
utms_active_incidents = Gauge(
    "utms_active_incidents",
    "Indicator of active/open incident per service (1=active, 0=none)",
    ["service_name"],
)

utms_active_incidents_total = Gauge(
    "utms_active_incidents_total",
    "Total count of open incidents currently active across all services",
)

utms_incidents_created_total = Counter(
    "utms_incidents_created_total",
    "Total number of incidents created due to consecutive check failures",
    ["service_name"],
)

utms_incidents_recovered_total = Counter(
    "utms_incidents_recovered_total",
    "Total number of incidents resolved upon service recovery",
    ["service_name"],
)

# ------------------------------------------------------------------------------
# 4. Alerting & Notification Metrics
# ------------------------------------------------------------------------------
utms_notifications_sent_total = Counter(
    "utms_notifications_sent_total",
    "Total notifications successfully delivered",
    ["provider", "event_type"],
)

utms_notification_failures_total = Counter(
    "utms_notification_failures_total",
    "Total notification delivery attempts that failed",
    ["provider", "event_type"],
)

# ------------------------------------------------------------------------------
# 5. Monitoring Worker Health & Scheduler Metrics
# ------------------------------------------------------------------------------
utms_scheduler_running = Gauge(
    "utms_scheduler_running",
    "Health status of the monitoring scheduler worker (1=running, 0=stopped)",
)

utms_scheduler_ticks_total = Counter(
    "utms_scheduler_ticks_total",
    "Total evaluation ticks executed by the scheduler loop",
)

utms_scheduler_last_tick_timestamp_seconds = Gauge(
    "utms_scheduler_last_tick_timestamp_seconds",
    "Unix timestamp of the most recent scheduler evaluation tick",
)

utms_scheduler_in_flight_checks = Gauge(
    "utms_scheduler_in_flight_checks",
    "Number of concurrent health checks currently executing in flight",
)

# ------------------------------------------------------------------------------
# 6. HTTP API Request Metrics
# ------------------------------------------------------------------------------
utms_api_requests_total = Counter(
    "utms_api_requests_total",
    "Total HTTP API requests processed by the backend",
    ["method", "endpoint", "status_code"],
)

utms_api_request_duration_seconds = Histogram(
    "utms_api_request_duration_seconds",
    "HTTP API request duration in seconds",
    ["method", "endpoint"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
)


# ------------------------------------------------------------------------------
# Instrumentation Helper Functions
# ------------------------------------------------------------------------------
def record_check_result(
    service_name: str,
    method: str,
    success: bool,
    response_time_ms: Optional[float],
    error_type: Optional[str],
) -> None:
    """Record all metrics associated with an individual monitoring check."""
    status_label = "success" if success else "failed"
    safe_name = service_name or "unknown"
    safe_method = (method or "GET").upper()

    utms_checks_total.labels(service_name=safe_name, method=safe_method, status=status_label).inc()

    if response_time_ms is not None:
        duration_s = max(0.0, response_time_ms / 1000.0)
        utms_check_duration_seconds.labels(service_name=safe_name).observe(duration_s)

    if success:
        utms_checks_success_total.labels(service_name=safe_name).inc()
    else:
        err_label = error_type or "unknown_error"
        utms_checks_failed_total.labels(service_name=safe_name, error_type=err_label).inc()


def record_incident_opened(service_name: str) -> None:
    """Record an incident opening."""
    safe_name = service_name or "unknown"
    utms_active_incidents.labels(service_name=safe_name).set(1)
    utms_incidents_created_total.labels(service_name=safe_name).inc()
    utms_active_incidents_total.inc()


def record_incident_resolved(service_name: str) -> None:
    """Record an incident recovery."""
    safe_name = service_name or "unknown"
    utms_active_incidents.labels(service_name=safe_name).set(0)
    utms_incidents_recovered_total.labels(service_name=safe_name).inc()
    utms_active_incidents_total.dec()


def record_notification_outcome(provider: str, event_type: str, success: bool) -> None:
    """Record notification delivery success or failure."""
    p_label = provider or "unknown"
    e_label = event_type or "unknown"
    if success:
        utms_notifications_sent_total.labels(provider=p_label, event_type=e_label).inc()
    else:
        utms_notification_failures_total.labels(provider=p_label, event_type=e_label).inc()


def update_service_counts(enabled: int, disabled: int) -> None:
    """Update active service gauge counts."""
    utms_monitored_services_total.labels(status="enabled").set(enabled)
    utms_monitored_services_total.labels(status="disabled").set(disabled)


def record_scheduler_tick(in_flight_count: int = 0) -> None:
    """Record an executed scheduler tick and in-flight count."""
    utms_scheduler_ticks_total.inc()
    utms_scheduler_last_tick_timestamp_seconds.set(time.time())
    utms_scheduler_in_flight_checks.set(in_flight_count)


def set_scheduler_running(running: bool) -> None:
    """Set the scheduler running state."""
    utms_scheduler_running.set(1 if running else 0)


def record_api_request(method: str, endpoint: str, status_code: int, duration_seconds: float) -> None:
    """Record HTTP API request counter and latency histogram."""
    safe_method = method.upper()
    utms_api_requests_total.labels(
        method=safe_method,
        endpoint=endpoint,
        status_code=str(status_code),
    ).inc()
    utms_api_request_duration_seconds.labels(
        method=safe_method,
        endpoint=endpoint,
    ).observe(duration_seconds)
