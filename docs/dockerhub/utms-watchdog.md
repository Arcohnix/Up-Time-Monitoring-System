# arcohnixx/utms-watchdog

> **Short Description:** Decoupled external watchdog daemon monitoring UTMS API availability and worker scheduler health.

[![Docker Image](https://img.shields.io/badge/docker-arcohnixx%2Futms--watchdog-blue.svg?logo=docker)](https://hub.docker.com/r/arcohnixx/utms-watchdog)
[![GitHub Repository](https://img.shields.io/badge/GitHub-Arcohnix%2FUp--Time--Monitoring--System-black?logo=github)](https://github.com/Arcohnix/Up-Time-Monitoring-System)
[![Python Version](https://img.shields.io/badge/python-3.13--slim-blue?logo=python)](https://www.python.org/)

---

## Overview

`arcohnixx/utms-watchdog` is a decoupled, external self-health monitoring daemon designed for the **Uptime Monitoring System (UTMS)**.

A monitoring system cannot reliably report on its own total failure. If the monitoring worker deadlocks, crashes, runs out of memory (OOM), or experiences network partition, its internal alerting routines fail along with it.

`utms-watchdog` solves the classic **"Who watches the watcher?"** reliability problem by running as a completely separate process or external container. It continuously evaluates both the responsiveness of the UTMS API and the health of its background checking scheduler, dispatching emergency webhook notifications when the monitoring infrastructure itself goes offline.

---

## Architectural Role

```
┌────────────────────────────────────────────────────────┐
│               arcohnixx/utms-watchdog                  │
│                                                        │
│  Independent Polling Daemon (asyncio + httpx)          │
│  - Evaluates /health/heartbeat every 5.0s              │
│  - Tracks consecutive failure state machine            │
│  - Deduplicates outage notifications                   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           │ Probes GET /health/heartbeat
                           ▼
┌────────────────────────────────────────────────────────┐
│               arcohnixx/utms-backend                   │
│                                                        │
│  ├── FastAPI REST API (api_alive)                      │
│  ├── In-Memory Async Scheduler (scheduler_running)     │
│  └── Worker Heartbeat Clock (worker_alive)             │
└────────────────────────────────────────────────────────┘
                           │
       (If backend crashes, hangs, or halts ticks)
                           ▼
┌────────────────────────────────────────────────────────┐
│               Out-of-Band Notification                 │
│                                                        │
│  Dispatches Webhook POST to External Incident Channel: │
│  - Opsgenie, PagerDuty, Slack, Discord, or Webhook     │
└────────────────────────────────────────────────────────┘
```

---

## How It Works

At every evaluation interval (default: `5.0s`), the watchdog sends an HTTP GET request to the target backend's dedicated heartbeat endpoint:

```http
GET /health/heartbeat?stale_threshold=30.0
```

The watchdog inspects the response and validates three distinct operational layers:

1. **`api_alive` (HTTP Layer):** Verifies that the API server is online, accepting socket connections, and responding within the timeout threshold (`WATCHDOG_TIMEOUT_SECONDS`).
2. **`scheduler_running` (Task Layer):** Verifies that the background monitoring scheduler loop has not been cancelled, stopped, or exited prematurely.
3. **`worker_alive` (Liveness Layer):** Verifies that the worker thread or coroutine has published a heartbeat timestamp within the last `WATCHDOG_HEARTBEAT_STALE_THRESHOLD_SECONDS` (default: `30.0s`). If background checks are blocked (e.g., event loop deadlock, long synchronous blocking calls), the heartbeat becomes stale and triggers an alert.

---

## Outage & Recovery State Machine

The watchdog maintains an internal state machine to prevent flapping and eliminate duplicate alert spam:

- **State Transition to `DOWN`:** Occurs only when consecutive probe failures reach or exceed `WATCHDOG_FAILURE_THRESHOLD` (default: `2`). Upon transition, an alert event (`MONITORING_SYSTEM_DOWN`) is emitted.
- **Deduplication:** While the system remains in the `DOWN` state across subsequent probe failures, no repeat alerts are fired.
- **State Transition to `HEALTHY`:** When a failed system produces a successful probe response, the state immediately transitions back to `HEALTHY`, consecutive failures are reset to `0`, and a recovery event (`MONITORING_SYSTEM_RECOVERED`) is emitted.

---

## Webhook Alert Format

When an outage or recovery transition occurs and `WATCHDOG_ALERT_WEBHOOK_URL` is configured, the watchdog sends an HTTP POST request with a JSON payload:

### Outage Event (`MONITORING_SYSTEM_DOWN`)
```json
{
  "source": "UTMS_WATCHDOG",
  "alert": {
    "event_type": "MONITORING_SYSTEM_DOWN",
    "target_url": "http://backend:8000",
    "timestamp": 1729243120.45,
    "consecutive_failures": 2,
    "error_message": "Monitoring worker heartbeat is stale (34.2s ago; worker may be frozen or crashed)",
    "details": {
      "status": "unhealthy",
      "api_alive": true,
      "scheduler_running": true,
      "worker_alive": false,
      "seconds_since_last_heartbeat": 34.2,
      "ticks_count": 1420,
      "in_flight_checks": 0
    }
  }
}
```

### Recovery Event (`MONITORING_SYSTEM_RECOVERED`)
```json
{
  "source": "UTMS_WATCHDOG",
  "alert": {
    "event_type": "MONITORING_SYSTEM_RECOVERED",
    "target_url": "http://backend:8000",
    "timestamp": 1729243180.12,
    "consecutive_failures": 0,
    "error_message": "Monitoring service restored and responsive",
    "details": {
      "status": "healthy",
      "api_alive": true,
      "scheduler_running": true,
      "worker_alive": true,
      "seconds_since_last_heartbeat": 0.8,
      "ticks_count": 1450,
      "in_flight_checks": 2
    }
  }
}
```

---

## Technology Stack

- **Runtime:** Python 3.13-slim
- **Asynchronous Engine:** `asyncio` loop with POSIX signal handlers (`SIGINT`, `SIGTERM`)
- **HTTP Client:** HTTPX async client with configurable connection timeouts
- **Security:** Runs as an unprivileged, non-root user (`appuser:1000`)
- **Container Footprint:** Lightweight image sharing the Python base layer with the backend

---

## Environment Variables

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `WATCHDOG_TARGET_URL` | String | `http://localhost:8000` | Target base URL of the UTMS backend instance to monitor. In Docker Compose, set to `http://backend:8000`. |
| `WATCHDOG_CHECK_INTERVAL_SECONDS` | Float | `5.0` | Frequency in seconds between consecutive health probe evaluations. |
| `WATCHDOG_TIMEOUT_SECONDS` | Float | `5.0` | Maximum time in seconds to wait for a probe response before marking it as timed out. |
| `WATCHDOG_FAILURE_THRESHOLD` | Integer | `2` | Number of consecutive failed checks required before declaring the monitoring system `DOWN`. |
| `WATCHDOG_HEARTBEAT_STALE_THRESHOLD_SECONDS` | Float | `30.0` | Maximum elapsed seconds since the worker's last registered tick before declaring the scheduler dead. |
| `WATCHDOG_ALERT_WEBHOOK_URL` | String | *Empty* | Destination HTTP/HTTPS webhook URL for `MONITORING_SYSTEM_DOWN` and `MONITORING_SYSTEM_RECOVERED` alerts. |

---

## Running with Docker Compose (Recommended)

In `docker-compose.yml`, the watchdog service executes the standalone module entrypoint:

```yaml
services:
  watchdog:
    image: arcohnixx/utms-watchdog:latest
    container_name: utms_watchdog
    command: ["python", "-m", "watchdog.main"]
    restart: unless-stopped
    environment:
      - WATCHDOG_TARGET_URL=http://backend:8000
      - WATCHDOG_CHECK_INTERVAL_SECONDS=5.0
      - WATCHDOG_TIMEOUT_SECONDS=5.0
      - WATCHDOG_FAILURE_THRESHOLD=2
      - WATCHDOG_HEARTBEAT_STALE_THRESHOLD_SECONDS=30.0
      - WATCHDOG_ALERT_WEBHOOK_URL=https://alerts.example.com/webhook/utms
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - utms_network

networks:
  utms_network:
    name: utms_network
    driver: bridge
```

Start the service:

```bash
docker compose up -d watchdog
```

Check the watchdog logs:

```bash
docker logs -f utms_watchdog
```

---

## Running Standalone

You can deploy the watchdog on a completely separate server or VM to monitor a remote UTMS instance over HTTPS:

```bash
docker run -d \
  --name utms_watchdog \
  --restart unless-stopped \
  -e WATCHDOG_TARGET_URL="https://status.yourdomain.com" \
  -e WATCHDOG_CHECK_INTERVAL_SECONDS="10.0" \
  -e WATCHDOG_TIMEOUT_SECONDS="5.0" \
  -e WATCHDOG_FAILURE_THRESHOLD="3" \
  -e WATCHDOG_HEARTBEAT_STALE_THRESHOLD_SECONDS="45.0" \
  -e WATCHDOG_ALERT_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL" \
  arcohnixx/utms-watchdog:latest \
  python -m watchdog.main
```

---

## Example Log Output

When healthy:
```text
2026-10-18 09:30:00 [INFO] [WATCHDOG] Starting External Watchdog: target=http://backend:8000, interval=5.0s, threshold=2, stale_threshold=30.0s
```

When an outage is detected:
```text
2026-10-18 09:32:15 [WARNING] [WATCHDOG] WATCHDOG: Health probe failed (1/2): Connection timed out after 5.0s (monitoring service unresponsive)
2026-10-18 09:32:20 [WARNING] [WATCHDOG] WATCHDOG: Health probe failed (2/2): Connection timed out after 5.0s (monitoring service unresponsive)
2026-10-18 09:32:20 [CRITICAL] [WATCHDOG] WATCHDOG CRITICAL: Monitoring system at http://backend:8000 is DOWN! (consecutive_failures=2, reason=Connection timed out after 5.0s (monitoring service unresponsive))
2026-10-18 09:32:21 [INFO] [WATCHDOG] WATCHDOG: Dispatched alert MONITORING_SYSTEM_DOWN to webhook https://alerts.example.com/webhook/utms (HTTP 200)
```

When the service recovers:
```text
2026-10-18 09:33:05 [INFO] [WATCHDOG] WATCHDOG: Monitoring service has recovered at http://backend:8000 after 2 consecutive failures.
2026-10-18 09:33:05 [INFO] [WATCHDOG] WATCHDOG: Dispatched alert MONITORING_SYSTEM_RECOVERED to webhook https://alerts.example.com/webhook/utms (HTTP 200)
```

---

## Available Image Tags

- `arcohnixx/utms-watchdog:latest` — Current stable build from the `main` branch.

---

## Relationship to Other UTMS Components

- **`arcohnixx/utms-backend`**: Target of the watchdog's probes. The backend must expose `/health/heartbeat` for the watchdog to verify that the monitoring worker and database connectivity remain active.
- **`arcohnixx/utms-frontend`**: While the frontend displays uptime data for human operators, the watchdog acts as an automated out-of-band fail-safe that guarantees alerting if the frontend and backend go dark simultaneously.

---

## Troubleshooting

### Watchdog repeatedly reports connection errors
- **Symptoms:** Logs display `Connection failed to http://backend:8000: ConnectError`.
- **Cause:** The watchdog cannot reach the backend URL over the network.
- **Resolution:** Verify DNS resolution and container networking. In Docker Compose, ensure both `backend` and `watchdog` share `utms_network` and `WATCHDOG_TARGET_URL=http://backend:8000`.

### Stale heartbeat false positives under heavy check load
- **Symptoms:** The API responds, but the watchdog declares an outage with `Monitoring worker heartbeat is stale`.
- **Cause:** The scheduler queue has saturated available async concurrency or checks are blocking the event loop.
- **Resolution:** Increase `WATCHDOG_HEARTBEAT_STALE_THRESHOLD_SECONDS` (e.g. from `30.0` to `60.0`) or increase `SCHEDULER_MAX_CONCURRENCY` on the backend.

### Webhook alerts fail to deliver
- **Symptoms:** Logs display `Failed to deliver alert webhook: ConnectError` or non-2xx HTTP codes.
- **Cause:** The webhook receiver URL is invalid, behind a firewall, or returning an HTTP error.
- **Resolution:** Test the webhook endpoint manually with `curl -X POST -H "Content-Type: application/json" -d '{"test": true}' <URL>`.

---

## Source & References

- **GitHub Repository:** [Up-Time-Monitoring-System](https://github.com/Arcohnix/Up-Time-Monitoring-System)
- **Issue Tracker:** [GitHub Issues](https://github.com/Arcohnix/Up-Time-Monitoring-System/issues)
