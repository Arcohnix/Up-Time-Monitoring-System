# arcohnixx/utms-backend

> **Short Description:** FastAPI backend and automated health check scheduler for the Uptime Monitoring System (UTMS).

[![Docker Image](https://img.shields.io/badge/docker-arcohnixx%2Futms--backend-blue.svg?logo=docker)](https://hub.docker.com/r/arcohnixx/utms-backend)
[![GitHub Repository](https://img.shields.io/badge/GitHub-Arcohnix%2FUp--Time--Monitoring--System-black?logo=github)](https://github.com/Arcohnix/Up-Time-Monitoring-System)
[![Python Version](https://img.shields.io/badge/python-3.13--slim-blue?logo=python)](https://www.python.org/)

---

## Overview

`arcohnixx/utms-backend` is the core application engine of the **Uptime Monitoring System (UTMS)**. It combines a high-performance asynchronous REST API built with FastAPI with an integrated background monitoring scheduler running on `asyncio`.

The backend is responsible for maintaining service definitions, executing scheduled health check probes, detecting latency spikes and network failures, managing the full incident lifecycle, dispatching notifications (SMTP email and Webhooks), and exporting Prometheus metrics.

---

## Architectural Role

Within the UTMS distributed architecture, `utms-backend` serves as the central control plane and execution engine:

```
                          ┌───────────────────────────┐
                          │   arcohnixx/utms-frontend │ (Port 80)
                          └─────────────┬─────────────┘
                                        │ REST API & Probes (/api/*, /health)
                                        ▼
┌──────────────────────────┐    ┌───────────────────────────┐    ┌───────────────────────────┐
│ arcohnixx/utms-watchdog  ├───►│  arcohnixx/utms-backend   ├───►│    PostgreSQL Database    │ (Port 5432)
└──────────────────────────┘    └─────────────┬─────────────┘    └───────────────────────────┘
   (Polls /health/heartbeat)                  │
                                              ├─────────────────► Monitored Targets (HTTP/S)
                                              ├─────────────────► Prometheus /metrics (Port 9090)
                                              └─────────────────► Alert Channels (Email & Webhook)
```

1. **API Server (`FastAPI` + `Uvicorn`)**: Serves RESTful endpoints for monitored services, health check execution histories, incident records, and real-time dashboard aggregates.
2. **Monitoring Scheduler (`asyncio`)**: Runs alongside the API within the same process lifespan, continuously dispatching non-blocking HTTP probes across configured monitored targets with bounded concurrency.
3. **State Engine**: Transitions services between `OPERATIONAL`, `DEGRADED`, and `DOWN` states based on configurable failure thresholds and latency ceilings, automatically opening and resolving incident records.
4. **Alert Dispatcher**: Dispatches structured email (SMTP) and HTTP webhook alerts on status degradation, service outage, and recovery events.
5. **Telemetry Exporter**: Exposes real-time application and monitoring metrics for Prometheus scraping at `/metrics`.

---

## Technology Stack

- **Runtime:** Python 3.13-slim (Debian-based minimal base image)
- **Web Framework:** FastAPI 0.115+ / Starlette / Uvicorn (ASGI)
- **Database Engine:** PostgreSQL 15+ via SQLAlchemy 2.0 (asyncio) & `asyncpg`
- **Schema & Migrations:** Alembic (automated execution on startup via entrypoint)
- **HTTP Client:** HTTPX (async client with connection pooling)
- **Data Validation:** Pydantic v2
- **Metrics:** `prometheus-client`
- **Security:** Runs as an unprivileged, non-root user (`appuser:1000`)

---

## Features Actually Implemented

- **Asynchronous Service Probing:** Non-blocking HTTP and HTTPS status checks with latency profiling, configurable timeout handling, and SSL verification.
- **Incident Lifecycle Management:** Tracks consecutive failures before escalating to `DOWN`; automatically triggers recovery routines and resolves incidents when targets return to healthy thresholds.
- **Automated Database Migrations:** Integrated `docker-entrypoint.sh` automatically checks PostgreSQL readiness and runs `alembic upgrade head` before launching the Uvicorn ASGI server.
- **Multi-Channel Alerting:**
  - **SMTP Email:** Delivers formatted outage and recovery alert emails via standard or TLS-encrypted SMTP relays.
  - **HTTP Webhooks:** Delivers JSON alert payloads to custom webhook endpoints or chat bridges.
- **Worker Heartbeat Tracking:** Exposes `/health/heartbeat` tracking scheduler loop frequency, ticks count, in-flight checks, and stale worker thresholds.
- **Prometheus Instrumentation:** Custom middleware records request counters, route latencies, check counts, and monitoring outcomes at `/metrics`.
- **OpenAPI / Swagger UI:** Native documentation rendered at `/docs` and `/redoc`.

---

## Exposed Ports & Health Endpoints

- **Exposed Port:** `8000`

### Health Probes

| Endpoint | Method | Purpose | Response |
| :--- | :--- | :--- | :--- |
| `/health` | `GET` | Container liveness and PostgreSQL connectivity check. | HTTP 200 `{"status": "healthy", "database": "connected", ...}` |
| `/health/heartbeat` | `GET` | Verification of scheduler loop and worker activity. Used by `utms-watchdog`. | HTTP 200 when alive; HTTP 503 if scheduler is stopped or worker heartbeat is stale. |
| `/metrics` | `GET` | Prometheus scrape target exposing standard HTTP and monitoring metrics. | `text/plain; version=0.0.4` |

---

## Environment Variables

All parameters can be configured through environment variables passed to the container:

### Application & Database Settings

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `PROJECT_NAME` | String | `Uptime Monitoring System` | Display title for OpenAPI and notification headers. |
| `ENVIRONMENT` | String | `production` | Deployment environment identifier (`production`, `development`). |
| `DEBUG` | Boolean | `false` | Enables verbose debug logging and expanded error traces. |
| `API_V1_STR` | String | `/api/v1` | Base prefix path for version 1 API endpoints. |
| `POSTGRES_SERVER` | String | `localhost` | Hostname or container name of the PostgreSQL server. |
| `POSTGRES_PORT` | Integer | `5432` | Port number of the PostgreSQL server. |
| `POSTGRES_USER` | String | `postgres` | Username for database authentication. |
| `POSTGRES_PASSWORD` | String | `postgres` | Password for database authentication. |
| `POSTGRES_DB` | String | `utms` | Target PostgreSQL database name. |
| `DATABASE_URL` | String | *None* | Optional full connection string override (e.g. `postgresql+asyncpg://...`). |
| `DB_POOL_SIZE` | Integer | `5` | SQLAlchemy async connection pool size. |
| `DB_MAX_OVERFLOW` | Integer | `10` | Maximum overflow connections allowed in the pool. |
| `DB_POOL_TIMEOUT` | Integer | `30` | Connection acquisition timeout in seconds. |

### Scheduler & Monitoring Settings

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `ENABLE_SCHEDULER` | Boolean | `true` | Enables or disables the in-process background monitoring scheduler. |
| `SCHEDULER_TICK_INTERVAL_SECONDS` | Float | `1.0` | Interval between scheduler dispatch evaluations in seconds. |
| `SCHEDULER_MAX_CONCURRENCY` | Integer | `50` | Maximum number of concurrent async HTTP probes executing in parallel. |

### Alerting Settings

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `ALERT_WEBHOOK_ENABLED` | Boolean | `false` | Set to `true` to dispatch outbound webhook alerts on incident changes. |
| `ALERT_WEBHOOK_URL` | String | *Empty* | HTTP/HTTPS destination URL for JSON incident payloads. |
| `ALERT_WEBHOOK_TIMEOUT_SECONDS` | Float | `10.0` | Webhook HTTP request timeout in seconds. |
| `ALERT_EMAIL_ENABLED` | Boolean | `false` | Set to `true` to deliver incident alerts via email. |
| `ALERT_EMAIL_SMTP_HOST` | String | *Empty* | SMTP server host (e.g., `smtp.gmail.com`, `mail.example.com`). |
| `ALERT_EMAIL_SMTP_PORT` | Integer | `587` | SMTP port (typically `587` for STARTTLS or `465` for SSL). |
| `ALERT_EMAIL_SMTP_USER` | String | *Empty* | SMTP authentication username. |
| `ALERT_EMAIL_SMTP_PASSWORD` | String | *Empty* | SMTP authentication password or application password. |
| `ALERT_EMAIL_USE_TLS` | Boolean | `true` | Enables STARTTLS encryption for SMTP delivery. |
| `ALERT_EMAIL_FROM` | String | `alerts@utms.local` | `From` email header address. |
| `ALERT_EMAIL_TO` | String | *Empty* | Destination email address for alert delivery. |

---

## Running with Docker Compose (Recommended)

The backend is typically deployed alongside PostgreSQL, the frontend dashboard, and the watchdog using `docker-compose.yml`:

```yaml
services:
  backend:
    image: arcohnixx/utms-backend:latest
    container_name: utms_backend
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - POSTGRES_SERVER=postgres
      - POSTGRES_PORT=5432
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=utms
      - ENABLE_SCHEDULER=true
      - SCHEDULER_TICK_INTERVAL_SECONDS=1.0
      - SCHEDULER_MAX_CONCURRENCY=50
      - ALERT_EMAIL_ENABLED=false
      - ALERT_WEBHOOK_ENABLED=false
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s
    networks:
      - utms_network

networks:
  utms_network:
    name: utms_network
    driver: bridge
```

Start the service:

```bash
docker compose up -d backend
```

---

## Running Standalone

To run the container independently, ensure a reachable PostgreSQL database exists and connect the container to the same network:

```bash
# 1. Create a bridge network if not already present
docker network create utms_network

# 2. Run the backend container
docker run -d \
  --name utms_backend \
  --network utms_network \
  -p 8000:8000 \
  -e POSTGRES_SERVER=postgres \
  -e POSTGRES_PORT=5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=utms \
  -e ENABLE_SCHEDULER=true \
  --restart unless-stopped \
  arcohnixx/utms-backend:latest
```

The container will automatically wait for PostgreSQL connectivity, run database schema migrations with Alembic, and start the Uvicorn server on `0.0.0.0:8000`.

---

## Example API Usage

Once the backend is healthy, you can interact with the REST API directly:

### 1. Verify Health Status
```bash
curl -s http://localhost:8000/health | jq .
```
Expected response:
```json
{
  "status": "healthy",
  "app": "Uptime Monitoring System",
  "environment": "production",
  "version": "0.1.0",
  "database": "connected"
}
```

### 2. Register a New Monitored Service
```bash
curl -X POST http://localhost:8000/api/services \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Gateway",
    "url": "https://httpbin.org/status/200",
    "check_interval_seconds": 30,
    "timeout_seconds": 5.0,
    "expected_status_code": 200,
    "degraded_threshold_ms": 500.0,
    "consecutive_threshold": 3,
    "is_active": true
  }' | jq .
```

### 3. Retrieve Dashboard Aggregates
```bash
curl -s http://localhost:8000/api/dashboard | jq .
```

### 4. Fetch Prometheus Metrics
```bash
curl -s http://localhost:8000/metrics | grep utms_
```

---

## Available Image Tags

- `arcohnixx/utms-backend:latest` — Current stable build from the `main` branch.

---

## Relationship to Other UTMS Components

- **`arcohnixx/utms-frontend`**: Web interface built with React 19 and served by Nginx. Proxies all browser API requests (`/api/*`) and health probes (`/health`) to this backend container on port `8000`.
- **`arcohnixx/utms-watchdog`**: External companion daemon solving the "Who watches the watcher?" problem. It continuously probes `http://backend:8000/health/heartbeat` to verify that both the API and the background monitoring scheduler are actively ticking.

---

## Troubleshooting

### Container stuck waiting for PostgreSQL
- **Symptoms:** Container logs repeatedly output `Waiting for PostgreSQL to accept connections...`.
- **Cause:** The database container is still initializing or the `POSTGRES_SERVER` hostname / port cannot be resolved across the Docker network.
- **Resolution:** Verify both containers belong to the same Docker network and that the database container passes its own health check (`pg_isready`).

### Migration failures on boot
- **Symptoms:** Container exits with Alembic migration errors.
- **Cause:** Schema changes conflict with existing database tables or user lacks permission to create tables.
- **Resolution:** Check logs using `docker logs utms_backend`. Ensure the PostgreSQL user has full privileges on the target database (`POSTGRES_DB`).

### Worker Heartbeat Reports 503 Unhealthy
- **Symptoms:** `GET /health/heartbeat` returns HTTP 503 and `arcohnixx/utms-watchdog` logs an alert.
- **Cause:** The background scheduler task encountered an unhandled exception or `ENABLE_SCHEDULER` is set to `false`.
- **Resolution:** Check `docker logs utms_backend` for scheduler exceptions and verify `ENABLE_SCHEDULER=true`.

---

## Source & References

- **GitHub Repository:** [Up-Time-Monitoring-System](https://github.com/Arcohnix/Up-Time-Monitoring-System)
- **Issue Tracker:** [GitHub Issues](https://github.com/Arcohnix/Up-Time-Monitoring-System/issues)
