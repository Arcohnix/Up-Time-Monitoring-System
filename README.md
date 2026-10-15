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
├── ARCHITECTURE.md          # System architecture and incremental phase roadmap
├── README.md                # Project setup and documentation
├── Dockerfile               # Backend application container definition
├── docker-compose.yml       # Local development composition (API + PostgreSQL)
├── requirements.txt         # Core production dependencies
├── requirements-dev.txt     # Development and testing dependencies
├── pytest.ini               # Pytest configuration
├── alembic.ini              # Alembic configuration
├── .env.example             # Environment variable template
├── .gitignore               # Ignored files for git
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
│   │       └── endpoints/
│   │           └── health.py# Health check and DB reachability routes
│   ├── core/
│   │   └── config.py        # Pydantic BaseSettings and URL normalization
│   ├── db/
│   │   ├── base.py          # SQLAlchemy DeclarativeBase
│   │   └── session.py       # Async engine and session factory
│   ├── models/              # SQLAlchemy ORM models (empty in Phase 1)
│   ├── schemas/             # Pydantic request/response schemas
│   │   └── health.py        # Health response schema
│   └── services/            # Domain logic and business services
│       └── health.py        # Database connectivity check helper
└── tests/                   # Automated test suite
    ├── conftest.py          # Pytest fixtures and mock transport
    ├── test_config.py       # Configuration unit tests
    ├── test_db.py           # Database connectivity service tests
    └── test_health.py       # Health endpoint integration tests
```

---

## Quickstart with Docker Compose

The easiest way to run the application with PostgreSQL is via Docker Compose:

1. **Clone and enter the repository:**
   ```bash
   cd UTMS
   ```

2. **Create your `.env` file:**
   ```bash
   cp .env.example .env
   ```

3. **Start the containers:**
   ```bash
   docker compose up -d --build
   ```

4. **Verify services are running:**
   ```bash
   curl http://localhost:8000/health
   ```

5. **Stop containers:**
   ```bash
   docker compose down
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

## Running Automated Tests

Run the full test suite with pytest:
```bash
pytest
```

To run with coverage reporting:
```bash
pytest --verbose
```
