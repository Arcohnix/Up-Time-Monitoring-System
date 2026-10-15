# Uptime Monitoring System (UTMS)

A production-grade, distributed-ready health and availability monitoring platform built with Python, FastAPI, SQLAlchemy, Alembic, and PostgreSQL.

---

## Phase 1: Backend Foundation

Phase 1 establishes a clean, decoupled, production-ready backend architecture:
- **FastAPI ASGI Application**: Application factory pattern, structured logging, CORS, and graceful lifespan management.
- **SQLAlchemy 2.0 (Async)**: Modern asynchronous engine and sessionmaker (`asyncpg`) with connection pooling and pre-ping health checks.
- **Alembic Migrations**: Fully configured async migration pipeline.
- **Pydantic v2 Settings**: Environment-driven typed configuration via `.env`.
- **Health & Readiness Endpoints**: Liveness and database reachability verification.
- **Pytest Suite**: Async tests using in-memory SQLite fixtures and mocked error conditions.
- **Docker Compose**: Containerized environment for PostgreSQL and the API.

---

## Project Structure

```
UTMS/
├── .github/                 # GitHub configurations & automation
│   └── workflows/
│       └── ci.yml           # CI Pipeline (Backend, Frontend, Docker validation)
├── ARCHITECTURE.md          # System architecture and incremental phase roadmap
├── README.md                # Project setup and documentation
├── Dockerfile               # Production FastAPI backend container definition
├── docker-entrypoint.sh     # Backend entrypoint (db readiness check + auto-migrations)
├── docker-compose.yml       # Production-ready compose configuration (5 services)
├── requirements.txt         # Core production dependencies
├── requirements-dev.txt     # Development and testing dependencies
├── pytest.ini               # Pytest configuration
├── pyproject.toml           # Python tool configurations (Ruff linter)
├── alembic.ini              # Alembic configuration
├── .env.example             # Environment variable template
├── .gitignore               # Ignored files for git
├── .dockerignore            # Docker build ignore rules
├── alembic/                 # Database migration scripts
│   ├── env.py               # Async migration runner connected to Base metadata
│   ├── script.py.mako       # Migration template
│   └── versions/            # Migration version files
├── app/                     # Application source tree
│   ├── main.py              # Application entrypoint & root endpoints
│   ├── api/                 # API routing & dependencies
│   │   ├── deps.py          # FastAPI dependency providers (e.g., db sessions)
│   │   └── v1/
│   │       ├── router.py    # API v1 aggregated router
│   │       └── endpoints/   # Health, services, checks, incidents, dashboard endpoints
│   ├── core/
│   │   ├── config.py        # Pydantic BaseSettings and URL normalization
│   │   └── metrics.py       # Prometheus metrics definitions and instrumentation helpers
│   ├── db/
│   │   ├── base.py          # SQLAlchemy DeclarativeBase
│   │   └── session.py       # Async engine and session factory
│   ├── models/              # SQLAlchemy ORM models (Service, CheckResult, Incident)
│   ├── schemas/             # Pydantic request/response schemas
│   └── services/            # Domain services (checker, history, scheduler, alerts, incident_manager)
├── frontend/                # React 19 + Vite + Tailwind CSS SPA
│   ├── Dockerfile           # Multi-stage production container build (Node + Nginx)
│   ├── nginx.conf           # Reverse proxy, security headers, SPA fallback
│   ├── src/                 # React components and dashboard views
│   └── package.json         # Frontend dependencies and scripts
├── prometheus/              # Prometheus configuration
│   └── prometheus.yml       # Scrape configuration for UTMS backend
├── grafana/                 # Grafana automated provisioning
│   └── provisioning/
│       ├── datasources/     # Auto-provisioned Prometheus datasource
│       └── dashboards/      # Auto-provisioned SRE dashboards & JSON models
└── tests/                   # Automated test suite (69 async tests)
```

---

## Production-Oriented Docker Setup (Phase 9)

UTMS is fully containerized across three production-ready services defined in `docker-compose.yml`:

```
┌────────────────────────────────────────────────────────┐
│                   Docker Host Network                  │
│                                                        │
│   Frontend Port: 3000            Backend Port: 8000   │
│          ▲                              ▲              │
└──────────┼──────────────────────────────┼──────────────┘
           │                              │
┌──────────┼──────────────────────────────┼──────────────┐
│          ▼                              ▼              │
│   ┌───────────────┐     /api/, /health ┌───────────────┐
│   │ utms_frontend │───────────────────▶│ utms_backend  │
│   │ (Nginx 1.27)  │                    │ (FastAPI App) │
│   └───────────────┘                    └───────┬───────┘
│      React 19 SPA                              │
│      Health: /nginx-health                     │ TCP: 5432
│                                                ▼
│                                        ┌───────────────┐
│                                        │ utms_postgres │
│                                        │ (PG 16 Alpine)│
│                                        └───────────────┘
│                                           Data Volume:
│                                        utms_postgres_data
│                                                        │
│          Bridge Network: utms_network                  │
└────────────────────────────────────────────────────────┘
```

### Services Overview:
1. **`postgres` (`postgres:16-alpine`)**:
   - Stores services, monitoring history, and incident records.
   - Persistent volume: `utms_postgres_data`.
   - Healthcheck: Probes `pg_isready -U postgres -d utms` every 5 seconds.
2. **`backend` (Python 3.13-slim)**:
   - Runs FastAPI ASGI application with embedded continuous asyncio monitoring scheduler.
   - Non-root user (`appuser:1000`) for container security.
   - Self-migrating entrypoint (`docker-entrypoint.sh`): waits for PostgreSQL socket readiness, runs `alembic upgrade head`, then executes the server.
   - Graceful shutdown via `SIGTERM` with a 30-second `stop_grace_period` ensuring in-flight monitoring probes finish.
   - Healthcheck: Probes `http://localhost:8000/health` every 10 seconds.
3. **`frontend` (Node 22 build stage + Nginx 1.27 Alpine runtime)**:
   - Multi-stage build compiles React 19 + Vite + Tailwind CSS SPA.
   - Nginx reverse-proxies `/api/` and `/health` to `http://backend:8000/` over internal Docker network.
   - Client-side routing fallback (`try_files $uri $uri/ /index.html;`), gzip compression, and security headers.
   - Healthcheck: Probes `http://127.0.0.1/nginx-health` every 10 seconds.
   - Graceful shutdown via `SIGQUIT`.

---

### Startup & Operation

#### 1. Configuration:
Copy the environment template and customize settings as desired:
```bash
cp .env.example .env
```
Key configurable variables:
- `BACKEND_PORT`: Port exposed on host for the API (default: `8000`).
- `FRONTEND_PORT`: Port exposed on host for the Web Dashboard (default: `3000`).
- `POSTGRES_PORT`: Port exposed on host for PostgreSQL (default: `5432`).
- `ENABLE_SCHEDULER`: Run the continuous monitoring engine (`true` / `false`).
- `ALERT_WEBHOOK_ENABLED`, `ALERT_EMAIL_ENABLED`: Configure incident notifications.

#### 2. Development Startup:
Start the entire stack in the background with automatic dependency ordering:
```bash
docker compose up -d
```
All services wait for their dependencies to report healthy (`postgres` -> `backend` -> `frontend`).

#### 3. Production-Style Build & Startup:
Force a clean rebuild of the multi-stage images:
```bash
docker compose up -d --build
```

#### 4. Checking Container Status & Health:
```bash
docker compose ps
```
Output:
```
NAME            IMAGE                COMMAND                  SERVICE    STATUS                    PORTS
utms_backend    utms-backend         "/usr/local/bin/dock…"   backend    Up (healthy)              0.0.0.0:8000->8000/tcp
utms_frontend   utms-frontend        "/docker-entrypoint.…"   frontend   Up (healthy)              0.0.0.0:3000->80/tcp
utms_postgres   postgres:16-alpine   "docker-entrypoint.s…"   postgres   Up (healthy)              0.0.0.0:5432->5432/tcp
```

#### 5. Stopping Containers:
To gracefully stop all services:
```bash
docker compose down
```
To stop and wipe database volumes (for fresh test runs):
```bash
docker compose down -v
```

---

### Database Migrations in Docker

Alembic migrations are executed **automatically on container startup** via `docker-entrypoint.sh`. If you need to manually inspect or run migrations:

- **Check current database revision:**
  ```bash
  docker compose exec backend alembic current
  ```
- **Apply migrations manually:**
  ```bash
  docker compose exec backend alembic upgrade head
  ```
- **Generate a new migration:**
  ```bash
  docker compose exec backend alembic revision --autogenerate -m "describe_migration"
  ```

---

### Viewing Logs & Diagnostics

- **Stream all logs in real-time:**
  ```bash
  docker compose logs -f
  ```
- **Inspect backend & scheduler logs:**
  ```bash
  docker compose logs -f backend
  ```
- **Inspect frontend Nginx access/error logs:**
  ```bash
  docker compose logs -f frontend
  ```
- **Inspect PostgreSQL database logs:**
  ```bash
  docker compose logs -f postgres
  ```

---

### Troubleshooting

- **Port Conflicts (`Address already in use`):**
  If ports 8000, 3000, or 5432 are already occupied on your host, edit `.env`:
  ```ini
  BACKEND_PORT=8080
  FRONTEND_PORT=3001
  POSTGRES_PORT=5433
  ```
  Then run `docker compose up -d`.
- **Database Connection Retries:**
  On first boot, PostgreSQL may take a few seconds to initialize its storage cluster. `docker-entrypoint.sh` in the backend uses an active socket polling loop to wait until PostgreSQL is accepting TCP connections before attempting `alembic upgrade head`.
- **Rebuilding after code changes:**
  If you modify frontend or backend code, rebuild the containers using:
  ```bash
  docker compose up -d --build
  ```

---

## Local Development (Without Docker)

### 1. Prerequisites
- Python 3.11 or higher
- PostgreSQL (or run only PostgreSQL in Docker: `docker compose up -d postgres`)

### 2. Setup Virtual Environment
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
```

### 3. Environment Configuration
Copy the sample environment file:
```bash
cp .env.example .env
```
Ensure `POSTGRES_SERVER`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` match your local PostgreSQL server.

### 4. Run Database Migrations
```bash
alembic upgrade head
```

### 5. Start the API Server
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Health Check & Verification

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/health` | `GET` | Root health check verifying API liveness and DB connectivity |
| `/api/v1/health` | `GET` | API v1 health check endpoint |
| `/api/v1/health/db` | `GET` | Explicit database connection check (`SELECT 1`) |
| `/api/services` | `POST` | Register a new monitored service |
| `/api/services` | `GET` | List all monitored services (with query filtering) |
| `/api/services/{id}` | `GET` | Retrieve single service configuration |
| `/api/services/{id}` | `PATCH` | Partially update a service |
| `/api/services/{id}` | `DELETE` | Remove a monitored service |
| `/api/services/{id}/check` | `POST` | Manually trigger health check on a specific service |
| `/api/services/check-all` | `POST` | Manually trigger concurrent health checks on all active services |
| `/api/services/{id}/checks` | `GET` | Historical check results with time range, status, and pagination filters |
| `/api/services/{id}/summary` | `GET` | Aggregated service summary (uptime %, avg response time, total/success/failed counts) |
| `/api/incidents` | `GET` | List recorded incidents (filterable by `service_id` and `status`: `OPEN`/`RESOLVED`) |
| `/api/incidents/{id}` | `GET` | Retrieve specific incident details |
| `/api/services/{id}/incidents` | `GET` | List all incidents for a specific monitored service |
| `/api/dashboard` | `GET` | Aggregated dashboard overview metrics, service cards, active incidents, and latency history |
| `/docs` | `GET` | Interactive OpenAPI documentation (Swagger UI) |
| `/redoc` | `GET` | ReDoc API documentation |

Sample response from `GET /health`:
```json
{
  "status": "healthy",
  "app": "Uptime Monitoring System",
  "environment": "development",
  "version": "0.1.0",
  "database": "connected"
}
```

---

## Alerting & Notifications (Phase 7)

UTMS includes a decoupled, asynchronous notification engine with support for pluggable providers.

### Supported Providers:
1. **Webhook (`WebhookNotificationProvider`)**: Asynchronous HTTP `POST` delivering JSON incident payloads to configured endpoints via `httpx`.
2. **Email (`EmailNotificationProvider`)**: SMTP email alerts with structured outage and recovery details sent asynchronously.

### Noise & Deduplication Rules:
- **Incident Creation**: Exactly **one** failure notification is emitted when a service exceeds its consecutive failure threshold and transitions to `DOWN`.
- **Ongoing Outage**: Subsequent failures while the incident is active do **not** generate duplicate notifications.
- **Incident Recovery**: Exactly **one** recovery notification is emitted when the first successful check restores the service to `HEALTHY`.
- **Fault Isolation**: Notification delivery failures never interrupt or crash monitoring probes or database writes.

### Configuration (`.env`):
```ini
# Webhook Alerting
ALERT_WEBHOOK_ENABLED=true
ALERT_WEBHOOK_URL="https://hooks.slack.com/services/... or https://your-domain.com/webhook"
ALERT_WEBHOOK_TIMEOUT_SECONDS=10.0

# Email Alerting
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_SMTP_HOST="smtp.mailgun.org"
ALERT_EMAIL_SMTP_PORT=587
ALERT_EMAIL_SMTP_USER="postmaster@your-domain.com"
ALERT_EMAIL_SMTP_PASSWORD="secretpassword"
ALERT_EMAIL_USE_TLS=true
ALERT_EMAIL_FROM="alerts@utms.local"
ALERT_EMAIL_TO="ops-team@your-domain.com"
```

---

## Frontend Dashboard SPA (Phase 8)

UTMS provides a React + Vite Single-Page Application (SPA) located in `frontend/` featuring:
- **System Overview Banner**: Live `SYSTEM ONLINE` / `DEGRADED` / `MAJOR OUTAGE` status indicator.
- **Top Metric Cards**: Aggregated uptime percentage, overall average latency, and monitored service counts.
- **Interactive Services Table**: Real-time status indicators (Healthy, Degraded, Down, Disabled), uptime %, average latency, quick manual check trigger, and deletion.
- **Response Time Chart**: Visualizing latency trends across probes with interactive tooltips.
- **Active Incidents Alerting**: Surfacing ongoing outages with failure counts and error reasons.
- **Service Registration**: In-app modal dialog to register new monitored endpoints.

### Running the Frontend in Development:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173). API requests to `/api` and `/health` are automatically proxied to `http://localhost:8000`.

### Building for Production:
```bash
cd frontend
npm run build
```
Once built, the FastAPI backend will automatically serve the dashboard application at `http://localhost:8000/dashboard/`.

---

## Running Automated Tests

Run the full test suite with pytest:
```bash
pytest
```

To run with coverage reporting:
```bash
pytest --verbose
```

---

## Continuous Integration Pipeline (Phase 10)

UTMS features an automated, production-grade Continuous Integration (CI) pipeline configured via GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

### Trigger Conditions:
- **Pull Requests**: Automatically triggers on any pull request targeting `main`.
- **Pushes**: Automatically triggers on direct commits or merges to `main`.

### Pipeline Architecture:
The workflow is structured into decoupled, concurrent and dependent jobs for fast feedback, clear failure isolation, and resource efficiency:

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│     Backend Tests & Lint        │       │     Frontend Lint & Build       │
│                                 │       │                                 │
│  - Python 3.13 + pip cache      │       │  - Node.js 22 + npm cache       │
│  - pip install dev dependencies │       │  - npm ci                       │
│  - ruff check .                 │       │  - npm run lint (oxlint)        │
│  - pytest --verbose (82 tests)  │       │  - npm run build (Vite)         │
└────────────────┬────────────────┘       └────────────────┬────────────────┘
                 │                                         │
                 └───────────────────┬─────────────────────┘
                                     │
                                     ▼
                     ┌─────────────────────────────────┐
                     │    Docker Build Validation      │
                     │                                 │
                     │  - Set up Docker Buildx         │
                     │  - docker compose config        │
                     │  - docker build backend         │
                     │  - docker build frontend        │
                     └─────────────────────────────────┘
```

### Pipeline Stages & Checks:

1. **Backend Tests & Lint (`backend`)**:
   - **Environment**: `ubuntu-latest` with Python 3.13 and active `pip` caching.
   - **Dependencies**: Installs `requirements-dev.txt` (FastAPI, SQLAlchemy, asyncpg, Alembic, pytest, pytest-asyncio, aiosqlite, Ruff).
   - **Code Quality**: Runs `ruff check .` adhering to `pyproject.toml` linting standards.
   - **Test Suite**: Executes all 82 async unit and integration tests with `pytest --verbose`.

2. **Frontend Lint & Build (`frontend`)**:
   - **Environment**: `ubuntu-latest` with Node.js 22 and npm caching keyed against `frontend/package-lock.json`.
   - **Dependencies**: Installs reproducible dependencies cleanly with `npm ci`.
   - **Static Analysis**: Runs `npm run lint` (`oxlint`) checking for syntax anomalies, unused references, and React rules.
   - **Production Bundling**: Runs `npm run build` (`vite build`) producing minified production assets.

3. **Docker Build Validation (`docker`)**:
   - **Dependency**: Runs only after `backend` and `frontend` jobs pass (`needs: [backend, frontend]`).
   - **Compose Validation**: Copies `.env.example` to `.env` and validates syntax and service networking with `docker compose config`.
   - **Container Builds**: Executes `docker build` on both backend (`Dockerfile`) and frontend (`frontend/Dockerfile`) multi-stage definitions.

### Running CI Checks Locally:

Developers can replicate the exact GitHub Actions pipeline before opening a pull request:

```bash
# 1. Backend Linting & Tests
ruff check .
pytest --verbose

# 2. Frontend Linting & Build
cd frontend
npm run lint
npm run build
cd ..

# 3. Docker Compose & Image Builds
cp .env.example .env
docker compose config
docker build -t utms-backend:ci .
docker build -t utms-frontend:ci ./frontend
```

---

## Observability: Prometheus & Grafana (Phase 11)

UTMS provides enterprise-grade observability and telemetry using **Prometheus** for metrics collection and **Grafana** for real-time visualization and alerting.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Observability Architecture                      │
│                                                                        │
│   ┌───────────────┐     Scrapes /metrics      ┌────────────────────┐   │
│   │ utms_backend  │◀──────────────────────────│  utms_prometheus   │   │
│   │ (:8000)       │       (every 5s)          │  (:9090)           │   │
│   └───────────────┘                           └─────────┬──────────┘   │
│                                                         │ PromQL       │
│                                                         ▼ Queries      │
│                                               ┌────────────────────┐   │
│                                               │    utms_grafana    │   │
│                                               │    (:3001)         │   │
│                                               └────────────────────┘   │
│                                                 Auto-provisioned       │
│                                                 Dashboards             │
└────────────────────────────────────────────────────────────────────────┘
```

### Metrics Exposed (`GET /metrics`):
The FastAPI application exposes Prometheus-formatted metrics at `/metrics`:

| Metric Name | Type | Labels | Description |
| :--- | :--- | :--- | :--- |
| `utms_monitored_services_total` | Gauge | `status` | Active count of services (`enabled`, `disabled`) |
| `utms_checks_total` | Counter | `service_name`, `method`, `status` | Total monitoring checks performed (`success`, `failed`) |
| `utms_checks_success_total` | Counter | `service_name` | Total number of successful health checks |
| `utms_checks_failed_total` | Counter | `service_name`, `error_type` | Total failed checks grouped by error category |
| `utms_check_duration_seconds` | Histogram | `service_name` | Duration of health checks in seconds (buckets 10ms - 10s) |
| `utms_active_incidents` | Gauge | `service_name` | Active outage state per service (1=active, 0=none) |
| `utms_active_incidents_total` | Gauge | None | Global count of unresolved active incidents |
| `utms_incidents_created_total` | Counter | `service_name` | Total incidents opened due to consecutive failures |
| `utms_incidents_recovered_total` | Counter | `service_name` | Total incidents automatically recovered |
| `utms_notification_failures_total` | Counter | `provider`, `event_type` | Total notification delivery failures |
| `utms_notifications_sent_total` | Counter | `provider`, `event_type` | Total successful notification deliveries |
| `utms_scheduler_running` | Gauge | None | Monitoring scheduler daemon state (1=running, 0=stopped) |
| `utms_scheduler_ticks_total` | Counter | None | Total evaluation tick cycles executed |
| `utms_scheduler_last_tick_timestamp_seconds` | Gauge | None | Unix timestamp of most recent scheduler tick |
| `utms_scheduler_in_flight_checks` | Gauge | None | Count of health check tasks executing concurrently |
| `utms_api_requests_total` | Counter | `method`, `endpoint`, `status_code` | HTTP API request volume by normalized endpoint |
| `utms_api_request_duration_seconds` | Histogram | `method`, `endpoint` | API response latency in seconds |

---

### Accessing Prometheus & Grafana:

1. **Prometheus Web UI**:
   - URL: [http://localhost:9090](http://localhost:9090)
   - Targets Status: [http://localhost:9090/targets](http://localhost:9090/targets) (verifies `backend:8000` is UP and scraping)
   - Graph & PromQL Console: [http://localhost:9090/graph](http://localhost:9090/graph)

2. **Grafana Dashboards**:
   - URL: [http://localhost:3001](http://localhost:3001)
   - Default Credentials:
     - **Username**: `admin`
     - **Password**: `admin`
   - Pre-provisioned Dashboard: **UTMS — Monitoring & System Observability** (Folder: `UTMS`)
   - Pre-configured Datasource: **Prometheus** (`http://prometheus:9090`)

### Grafana Dashboard Panels:
The pre-provisioned dashboard automatically visualizes:
1. **Service Availability**: Live gauges of enabled services, total checks executed, and global success percentage.
2. **Check Success / Failure Rates**: Real-time operations/sec graph with failure breakdown by error type (`HTTP_STATUS`, `TIMEOUT`, `CONNECTION_ERROR`).
3. **Probe Latency**: Percentiles ($p_{50}$, $p_{95}$, $p_{99}$) and per-service average check response times.
4. **Active Incidents**: Open incidents counter, outage timeline, and notification delivery vs failure rates.
5. **Monitoring Worker Health**: Scheduler tick rate, in-flight concurrent probe count, and worker daemon state.
6. **API Health**: API request throughput by normalized endpoint and status code distribution.

---

## Monitoring System Self-Health & External Watchdog (Phase 12)

### The Problem: "Who Watches the Watcher?"
When an uptime monitoring system crashes, deadlocks, runs out of memory, or encounters a stalled scheduler event loop, all internal monitoring silently ceases. The monitored services might go down while the monitoring system itself is unavailable to detect or report the failure.

UTMS solves this reliability problem through a **decoupled, two-tier self-health verification architecture**:
1. **Internal Worker Heartbeat Mechanism**: The scheduler loop updates a monotonic heartbeat timestamp on every execution tick.
2. **Decoupled External Watchdog Service**: An independent probe process running in a separate failure domain (standalone container `utms_watchdog` or remote daemon) continuously verifies that the API is responsive, the scheduler is active, and the monitoring worker is not frozen.

```
┌────────────────────────────────────────────────────────────────────────┐
│             Monitoring System Self-Health Architecture                 │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                      utms_backend (:8000)                      │   │
│   │                                                                │   │
│   │   ┌───────────────┐                  ┌─────────────────────┐   │   │
│   │   │  FastAPI API  │                  │ MonitoringScheduler │   │   │
│   │   │               │                  │                     │   │   │
│   │   │ GET /health/  │◀─── reads ───────│ Updates Heartbeat   │   │   │
│   │   │   heartbeat   │     telemetry    │ Timestamp on Tick   │   │   │
│   │   └───────▲───────┘                  └─────────────────────┘   │   │
│   └───────────┼────────────────────────────────────────────────────┘   │
│               │ HTTP Probe (every 5s)                                  │
│               │ (decoupled process / separate container)               │
│   ┌───────────┴────────────────────────────────────────────────────┐   │
│   │              utms_watchdog (ExternalWatchdog)                  │   │
│   │                                                                │   │
│   │   - Probes API responsiveness                                  │   │
│   │   - Verifies scheduler_running == true                         │   │
│   │   - Verifies worker_alive (seconds_since_heartbeat <= 30s)     │   │
│   │   - Gated by consecutive failure threshold (default: 2)        │   │
│   │   - Deduplicates active outage alerts                          │   │
│   │   - Dispatches webhook alerts on OUTAGE and RECOVERY           │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ Outage Alert Webhook               │
│                                   ▼                                    │
│                     ┌───────────────────────────┐                      │
│                     │ External Pager / Operator │                      │
│                     │ (Slack, PagerDuty, etc.)  │                      │
│                     └───────────────────────────┘                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Internal Worker Heartbeat (`GET /health/heartbeat`)

The monitoring worker exposes a dedicated health endpoint at `/health/heartbeat` and `/api/v1/health/heartbeat`:

```json
{
  "status": "healthy",
  "api_alive": true,
  "scheduler_running": true,
  "worker_alive": true,
  "last_heartbeat_timestamp": 1792064018.60,
  "seconds_since_last_heartbeat": 0.12,
  "ticks_count": 142,
  "in_flight_checks": 0,
  "stale_threshold_seconds": 30.0
}
```

The endpoint returns **HTTP 200 (OK)** if and only if:
1. `api_alive == true`: The web server is responding.
2. `scheduler_running == true`: The background scheduler daemon is running.
3. `worker_alive == true`: The elapsed time since the last heartbeat tick is strictly within `stale_threshold_seconds` (default: 30s).

If any condition fails (e.g. scheduler deadlocked, stopped, or frozen), the endpoint immediately responds with **HTTP 503 (Service Unavailable)** and `status: "unhealthy"`.

---

### Complete Failure Scenario Walkthrough

The following sequence illustrates how the external watchdog detects and alerts when the monitoring system fails:

```
Step 1: Monitoring Service Crashes
   Backend process terminates (OOM kill, unhandled system signal, network drop).
                             │
                             ▼
Step 2: Internal Monitoring Stops
   Scheduler tick loop ceases execution. No health checks are performed on target services.
                             │
                             ▼
Step 3: External Watchdog Detects Failure
   Watchdog executes independent probe to http://backend:8000/health/heartbeat:
   - Probe attempt 1: ConnectionRefusedError (consecutive_failures = 1).
   - Probe attempt 2: ConnectionRefusedError (consecutive_failures = 2).
   Threshold (2) reached: Watchdog transitions state to DOWN.
                             │
                             ▼
Step 4: Outage Alert is Generated
   Watchdog logs critical alert and delivers webhook event:
   {
     "source": "UTMS_WATCHDOG",
     "alert": {
       "event_type": "MONITORING_SYSTEM_DOWN",
       "target_url": "http://backend:8000",
       "consecutive_failures": 2,
       "error_message": "Connection failed to http://backend:8000: Connection refused"
     }
   }
   Subsequent failed probes log ongoing failure but do NOT spam duplicate alerts.
                             │
                             ▼
Step 5: Automatic Recovery Detection
   Backend is restarted and scheduler ticks resume.
   Watchdog receives HTTP 200 with worker_alive=true.
   State transitions to HEALTHY, failure counter resets to 0, and a MONITORING_SYSTEM_RECOVERED alert is dispatched.
```

---

### Watchdog Configuration

| Variable | Default | Description |
| :--- | :--- | :--- |
| `WATCHDOG_TARGET_URL` | `http://localhost:8000` | Target URL of the backend service to monitor |
| `WATCHDOG_CHECK_INTERVAL_SECONDS` | `5.0` | Probing frequency in seconds |
| `WATCHDOG_TIMEOUT_SECONDS` | `5.0` | HTTP request timeout for each probe |
| `WATCHDOG_FAILURE_THRESHOLD` | `2` | Consecutive failed probes required before declaring `DOWN` |
| `WATCHDOG_HEARTBEAT_STALE_THRESHOLD_SECONDS` | `30.0` | Max age in seconds of worker heartbeat before flagging stale |
| `WATCHDOG_ALERT_WEBHOOK_URL` | `""` | Webhook URL to receive outage and recovery alerts |

---

### Running the External Watchdog

#### 1. In Docker Compose (Recommended):
The watchdog is configured as a standalone service in `docker-compose.yml`:
```bash
docker compose up -d watchdog
```
View watchdog logs:
```bash
docker logs -f utms_watchdog
```

#### 2. Standalone Python CLI:
Run directly from terminal or an external supervisor (e.g. systemd, external VM):
```bash
python -m watchdog.main
```
