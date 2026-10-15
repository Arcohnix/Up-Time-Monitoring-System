# Architecture Design: Uptime Monitoring System (UTMS)

## 1. Project Purpose

The **Uptime Monitoring System (UTMS)** is a production-grade, distributed-ready health and availability monitoring platform. Its primary goal is to provide reliable, non-blocking periodic health verification for registered HTTP/HTTPS endpoints and APIs, accurately detect downtime and degradations while minimizing false positives, record granular health history, manage incidents through explicit lifecycle transitions, and deliver alerts.

The system is designed with a clean separation of concerns, ensuring that core monitoring logic remains decoupled from the HTTP API and can evolve from an embedded asynchronous loop into an autonomous distributed worker fleet without architectural rewrites.

---

## 2. Major Components

The system is decomposed into modular layers with distinct boundaries:

```
+------------------------------------------------------------------+
|                           Clients / UI                           |
+---------------------------------+--------------------------------+
                                  | HTTP / REST
                                  v
+------------------------------------------------------------------+
|                           API Layer                              |
|       (FastAPI: Endpoint CRUD, Status Queries, Incident Views)   |
+---------------------------------+--------------------------------+
                                  |
            +---------------------+---------------------+
            v                                           v
+-----------------------+                   +----------------------+
|  Database / Storage   |                   |  Monitoring Engine   |
| (PostgreSQL / Alembic)|<------------------| (Async HTTP Prober,  |
|  SQLAlchemy Models    |   Saves Results   |  Scheduler / Runner) |
+-----------+-----------+                   +----------+-----------+
            |                                          |
            | Reads State                              | Evaluates Result
            v                                          v
+------------------------------------------------------------------+
|                   Incident Management Engine                     |
|         (State Machine: HEALTHY -> DEGRADED -> DOWN)             |
|              Threshold & Flapping Prevention Rules               |
+---------------------------------+--------------------------------+
                                  | State Change / Trigger
                                  v
+------------------------------------------------------------------+
|                      Alerting Subsystem                          |
|         (Notification Dispatcher: Webhook, Email, etc.)          |
+------------------------------------------------------------------+
```

### 2.1 API Layer (`api/`)
- Exposes RESTful endpoints for managing monitored targets (CRUD for endpoints).
- Exposes query interfaces for health histories, uptime percentages, and active/resolved incidents.
- Purely handles request validation, serialization, error mapping, and routing to application services.

### 2.2 Database Layer (`db/`, `models/`, `schemas/`)
- Defines the relational schema and ORM mappings (SQLAlchemy).
- Manages database migrations reliably via Alembic.
- Enforces relational integrity and indexes on high-frequency query paths (e.g., endpoint checks by timestamp).

### 2.3 Monitoring / Checking Engine (`checker/` or `engine/`)
- Decoupled from the web API runtime lifecycle.
- Executes concurrent HTTP/HTTPS probes using asynchronous I/O (`httpx.AsyncClient`).
- Isolates probes to ensure a slow or timing-out target endpoint never starves or blocks checks for other endpoints.
- Emits raw `CheckResult` records (status code, latency, availability, headers, error details).

### 2.4 Incident Management Layer (`incidents/`)
- Evaluates consecutive probe outcomes against endpoint-specific thresholds.
- Governs lifecycle transitions: `OPERATIONAL` $\leftrightarrow$ `DEGRADED` $\leftrightarrow$ `DOWN`.
- Suppresses noise via hysteresis (requiring $N$ consecutive failures to declare an incident, and $M$ consecutive successes to mark recovery).
- Tracks incident lifecycles (opened timestamp, resolved timestamp, cause, status).

### 2.5 Alerting Subsystem (`alerts/`)
- Consumes state transition events from the incident manager.
- Implements an extensible dispatcher interface for notification channels (Webhook, Email, Slack, etc.).
- Keeps delivery mechanics decoupled from probing logic.

### 2.6 Metrics & Observability (`metrics/`)
- Collects execution statistics (probe latency histograms, failure rates, queue backlog, engine liveness).
- Prepares standard metrics format for future observability tooling.

### 2.7 Frontend (`frontend/`)
- Single-page application (SPA) providing visibility into monitored targets, real-time status badges, latency charts, and incident timelines.
- Interacts strictly through the REST API.

---

## 3. Data Flow

### 3.1 Endpoint Registration Flow
1. Client issues a `POST /api/v1/endpoints` request with target URL, interval, timeout, and threshold rules.
2. API validates payloads against Pydantic schemas.
3. Service layer persists the `MonitoredEndpoint` record to PostgreSQL via SQLAlchemy.
4. Monitoring engine dynamically schedules or queries active targets for subsequent execution cycles.

### 3.2 Health Check Execution Flow
1. The scheduler selects active targets due for checking.
2. Check jobs are dispatched asynchronously into an event loop / task pool.
3. `httpx.AsyncClient` issues non-blocking requests with strict per-endpoint timeouts.
4. Response characteristics (HTTP code, latency in ms, payload validity, TLS/connection errors) are captured as a `CheckResult`.
5. `CheckResult` is persisted to PostgreSQL.

### 3.3 State Evaluation & Incident Lifecycle Flow
1. Incident evaluator inspects the recent check results for the given endpoint.
2. **Threshold check**:
   - If failures $\ge \text{failure\_threshold}$ and no active incident exists $\rightarrow$ Open `Incident`, mark endpoint `DOWN`.
   - If successes $\ge \text{recovery\_threshold}$ and an active incident exists $\rightarrow$ Close `Incident` with resolution timestamp, mark endpoint `OPERATIONAL`.
3. If an incident state change occurs, a transition event is emitted to the Alerting subsystem.

### 3.4 Alert Notification Flow
1. Alerting dispatcher receives incident event (`INCIDENT_OPENED` or `INCIDENT_RESOLVED`).
2. Configured notification targets (e.g., webhook URL, email) are loaded.
3. Notification payloads are delivered asynchronously with exponential backoff on delivery failure.

---

## 4. Technology Choices

| Domain | Technology | Justification |
| :--- | :--- | :--- |
| **Backend Runtime** | Python 3.11+ | Modern typing, native asynchronous capabilities (`asyncio`), high productivity. |
| **Web Framework** | FastAPI | High performance async ASGI framework, automatic OpenAPI documentation, tight Pydantic integration. |
| **ORM / Data Access** | SQLAlchemy 2.0+ (async) | Industry-standard ORM with full async support, query expression flexibility, strict typing. |
| **Schema Migrations** | Alembic | First-class SQLAlchemy migration tool ensuring reliable, version-controlled schema upgrades. |
| **Relational Database**| PostgreSQL | ACID compliance, strong indexing capabilities, JSON/structured data support, production reliability. |
| **HTTP Client** | `httpx` (async) | Async-native HTTP client supporting HTTP/1.1 and HTTP/2, connection pooling, configurable timeouts. |
| **Testing Suite** | `pytest`, `pytest-asyncio` | Robust test ecosystem, fixture management, async support, high test isolation. |
| **Containerization** | Docker, Docker Compose | Consistent local and CI development environments; reproducible builds. |
| **Continuous Integration** | GitHub Actions | Automated linting, type checks, and test suite execution on pull requests. |
| **Frontend (Future)**| React + Vite + Tailwind CSS | Fast build times, standard component-driven UI, modern styling primitives. |

---

## 5. Planned Future Phases

To maintain steady velocity, clean boundaries, and guaranteed runnable state at each stage, development is divided into incremental phases:

* **Phase 1: Core API & Database Foundation**
  - Project scaffolding, configuration management, dependency management.
  - SQLAlchemy async engine and base models (`MonitoredEndpoint`, `CheckResult`).
  - Alembic migrations setup.
  - FastAPI CRUD endpoints for managing monitored endpoints with validation.
  - Integration and unit tests with automated test runner.

* **Phase 2: Monitoring Engine & Concurrent Probing**
  - Decoupled async HTTP checker service using `httpx`.
  - Concurrency management (using `asyncio.gather` / worker pools with bounded semaphores).
  - Timeout isolation (slow endpoints do not block peers).
  - Persistence of detailed check results (status code, latency, error reason, timestamp).

* **Phase 3: Incident Management & State Transitions**
  - Consecutive failure tracking and flapping prevention.
  - Incident data models (`Incident`, `IncidentStatus`).
  - Automatic detection of downtime and recovery.
  - Endpoints to inspect incident histories and active outages.

* **Phase 4: Alerting Subsystem**
  - Extensible notification channel interface (`BaseNotifier`).
  - Webhook and email alert implementations.
  - Asynchronous alert dispatch on state changes.

* **Phase 5: Containerization & Local Dev Orchestration**
  - Multi-stage `Dockerfile` for the application.
  - `docker-compose.yml` orchestrating API, database, and background runner.
  - Health checks and graceful shutdown handling.

* **Phase 6: Frontend Dashboard**
  - React/Vite SPA styled with Tailwind CSS.
  - Endpoint overview, real-time health indicator, latency history charts, incident status modal.

* **Phase 7: Metrics, CI/CD & Scale Preparation**
  - Prometheus metrics exposition.
  - GitHub Actions CI pipeline (linting, type checking, tests).
  - Autonomous background worker separation for distributed deployment.

---

## 6. Important Architectural Decisions

1. **Decoupled Monitoring Engine**:
   The probing engine is architected as an independent domain service. While it may run as an embedded background task in early development phases, its interfaces strictly depend on data repositories rather than web request contexts, enabling a seamless transition to a standalone worker process.
2. **Asynchronous Non-Blocking Concurrency**:
   Probing hundreds of remote endpoints entails significant I/O wait. Using `asyncio` and `httpx.AsyncClient` allows thousands of concurrent probes on minimal system resources without thread exhaustion.
3. **Threshold-Based State Machine (Flapping Prevention)**:
   Single transient network glitches must not trigger alerts. The system requires $N$ consecutive failures to declare an outage and $M$ consecutive successes to declare recovery.
4. **Strict Isolation of Probes**:
   Every probe is executed with an isolated timeout and exception boundary. A DNS failure, SSL error, or hanging socket on endpoint A will never impact the schedule or execution of endpoint B.
5. **Schema-First Migrations**:
   All database state is managed via Alembic migrations from day one. Direct schema mutation scripts are prohibited.

---

## 7. Explicitly Out-of-Scope for Current Phase

The following technologies and features are intentionally deferred to future phases to avoid premature complexity:

- **No Distributed Task Queues / Caches**: Redis, Celery, RabbitMQ, or Kafka.
- **No Heavy Orchestration**: Kubernetes, Helm charts, Terraform, or cloud-specific infrastructure.
- **No External Observability Exporters**: Prometheus metrics endpoints, Grafana dashboards, OpenTelemetry collectors.
- **No Authentication / Authorization**: JWTs, OAuth2, multi-tenancy, or user role access control.
- **No Frontend**: React, Vite, Tailwind, HTML/CSS UI components.
- **No Third-Party Alert Integrations**: PagerDuty, Slack bot, Twilio SMS.
