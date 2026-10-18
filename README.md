# Uptime Monitoring System (UTMS)

[![CI Pipeline](https://github.com/Arcohnix/Up-Time-Monitoring-System/actions/workflows/ci.yml/badge.svg)](https://github.com/Arcohnix/Up-Time-Monitoring-System/actions)
[![Docker](https://img.shields.io/badge/Docker-Compose%20v2-blue?logo=docker)](docker-compose.yml)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python)](https://python.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwindcss)](https://tailwindcss.com)
[![Prometheus](https://img.shields.io/badge/Prometheus-v2.54-E6522C?logo=prometheus)](https://prometheus.io)
[![Grafana](https://img.shields.io/badge/Grafana-11.1-F46800?logo=grafana)](https://grafana.com)

A high-performance, production-grade distributed health and uptime monitoring platform. Built with **FastAPI**, **SQLAlchemy 2.0 (Async)**, **PostgreSQL 16**, **React 19**, **Prometheus**, and **Grafana**, UTMS provides continuous availability tracking, sub-second latency analytics, automated incident recovery lifecycles, and a decoupled watchdog for self-health verification.

---

## Overview & Design Philosophy

UTMS is designed with a **"Less UI, more hierarchy"** approach inspired by modern engineering tools like **Linear**, **Raycast**, and **Vercel**:
- **Restrained Visual Palette**: Technical dark and light modes with soft status accents (muted green, soft amber, pastel red, lavender).
- **Universal Command Palette (`⌘K` / `Ctrl+K`)**: Rapidly search monitors, inspect incidents, or trigger batch probes from anywhere.
- **Observability Telemetry**: Interactive response-time charts with hover tooltips, P95/P99 statistical latency envelopes, and incident lifecycle timelines.
- **Fault-Isolated Architecture**: Outage notifications and probe errors are safely isolated so they never crash the background scheduler or monitoring runner.

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Host Network                                         │
│                                                                                        │
│   Web Dashboard: 3000          API Gateway: 8000         Prometheus: 9090              │
│   Grafana Portal: 3001         API Docs: /docs           Watchdog Target: /health      │
└───────────┬────────────────────────────┬─────────────────────────┬─────────────────────┘
            │                            │                         │
┌───────────┼────────────────────────────┼─────────────────────────┼─────────────────────┐
│           ▼                            ▼                         ▼                     │
│    ┌───────────────┐  /api, /health   ┌─────────────────┐       ┌──────────────────┐   │
│    │ utms_frontend │─────────────────▶│  utms_backend   │◀──────│  utms_prometheus │   │
│    │ (Nginx 1.27)  │                  │  (FastAPI ASGI) │       │  (Scrapes :8000) │   │
│    └───────────────┘                  └────────┬────────┘       └─────────┬────────┘   │
│       React 19 SPA                             │                          │ PromQL     │
│       Tailwind v4                              │ TCP: 5432                ▼            │
│       Dark / Light                             ▼                ┌──────────────────┐   │
│                                       ┌─────────────────┐       │   utms_grafana   │   │
│                                       │  utms_postgres  │       │  (Pre-configured)│   │
│                                       │ (PostgreSQL 16) │       └──────────────────┘   │
│                                       └─────────────────┘                              │
│                                                                                        │
│    ┌────────────────────────────────────────────────────┐                              │
│    │                  utms_watchdog                     │                              │
│    │  - Decoupled self-health monitor daemon            │                              │
│    │  - Probes /health/heartbeat every 5.0s             │                              │
│    │  - Solves the "Who Watches the Watcher?" problem   │                              │
│    └────────────────────────────────────────────────────┘                              │
│                                                                                        │
│                         Docker Bridge Network: utms_network                            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start (One-Command Docker Setup)

The recommended and fastest way to run the entire UTMS stack is using Docker Compose:

### 1. Clone the Repository
```bash
git clone https://github.com/Arcohnix/Up-Time-Monitoring-System.git
cd Up-Time-Monitoring-System
```

### 2. Configure Environment
Copy the environment template:
```bash
cp .env.example .env
```
*(Optional)* To enable live email alerts, set your Gmail credentials and 16-character Google App Password in `.env`:
```ini
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_SMTP_HOST="smtp.gmail.com"
ALERT_EMAIL_SMTP_PORT=587
ALERT_EMAIL_SMTP_USER="your-email@gmail.com"
ALERT_EMAIL_SMTP_PASSWORD="your-16-char-app-password"
ALERT_EMAIL_FROM="your-email@gmail.com"
ALERT_EMAIL_TO="your-email@gmail.com"
```

### 3. Launch the Stack
```bash
docker compose up -d
```
Docker Compose automatically provisions PostgreSQL, applies database migrations, starts the backend API and monitoring scheduler, builds the frontend SPA, and launches Prometheus, Grafana, and the external watchdog.

### 4. Verify Services
```bash
docker compose ps
```

---

## Access Points & Ports

| Service | URL | Default Credentials | Description |
| :--- | :--- | :--- | :--- |
| **Web Dashboard** | [http://localhost:3000](http://localhost:3000) | — | Production React 19 UI with Dark/Light modes & Command Palette |
| **Backend REST API** | [http://localhost:8000](http://localhost:8000) | — | FastAPI ASGI Application |
| **API Documentation** | [http://localhost:8000/docs](http://localhost:8000/docs) | — | Interactive OpenAPI / Swagger UI |
| **Prometheus Scraper** | [http://localhost:9090](http://localhost:9090) | — | Raw PromQL metric evaluation & targets dashboard |
| **Grafana Dashboards** | [http://localhost:3001](http://localhost:3001) | `admin` / `admin` | Auto-provisioned SRE dashboards for fleet availability & latency |
| **Watchdog Heartbeat** | [http://localhost:8000/health/heartbeat](http://localhost:8000/health/heartbeat) | — | Monitoring worker liveness verification probe |

---

## Core Features

### 1. Asynchronous Distributed Health Prober
- **Concurrent Non-Blocking Engine**: Evaluates HTTP/HTTPS endpoints concurrently via `asyncio` and `httpx`.
- **Configurable Thresholds**: Customizable check intervals (5s–86400s), timeouts, expected status codes, and consecutive failure thresholds.
- **Zero-Blocking Architecture**: Slow or hanging endpoints never delay or block checks on healthy targets.

### 2. Automated Incident Lifecycle & Notifications
- **Deduplicated Outage Alerts**: Exactly **one** notification is dispatched when an endpoint breaches its failure threshold (`DOWN`). Ongoing failures do not create notification noise.
- **Recovery Notification**: Automatically triggers an alert when the service passes health checks and returns to `HEALTHY`.
- **Supported Channels**:
  - **Email (SMTP)**: Direct asynchronous delivery supporting STARTTLS (e.g., Gmail, Mailgun, SendGrid).
  - **Webhook**: Asynchronous JSON payload dispatch to Slack, Discord, or custom incident endpoints.

### 3. Monitoring System Self-Health ("Who Watches the Watcher?")
- **Worker Heartbeat Mechanism**: The background scheduler writes a monotonic heartbeat timestamp on every execution tick.
- **Independent External Watchdog**: A standalone daemon (`utms_watchdog`) running in a separate container probes `/health/heartbeat`. If the API or scheduler deadlocks, freezes, or crashes, the watchdog raises an alert even if the main application is dead.

### 4. Full Observability & Grafana Dashboards
- **Prometheus Telemetry**: Exposes application, API throughput, scheduler tick duration, in-flight probes, and latency histograms at `/metrics`.
- **Pre-Provisioned Grafana**: Includes ready-to-use panels for:
  - Global service availability SLA
  - Check success / failure ratios categorized by error type
  - P50, P95, and P99 latency percentiles
  - Active incidents counter & duration

---

## Local Development (Without Docker)

### Backend Setup:
```bash
# 1. Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements-dev.txt

# 3. Configure environment
cp .env.example .env

# 4. Run database migrations
alembic upgrade head

# 5. Start API server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Setup:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173). Requests to `/api` and `/health` automatically proxy to `http://localhost:8000`.

---

## Testing & Quality Assurance

### Run Backend Tests (Pytest):
```bash
pytest
```
*All 82 async unit and integration tests pass cleanly.*

### Run Frontend Linting & Build (Oxlint & Vite):
```bash
cd frontend
npm run test
```

### Continuous Integration (GitHub Actions):
The project includes a multi-stage GitHub Actions CI pipeline ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) validating:
1. Python 3.13 dependency caching and Ruff code formatting.
2. Full async unit, integration, and incident lifecycle test suite.
3. Node.js 22 static analysis via Oxlint and production asset bundling with Vite.
4. Docker Compose configuration and multi-stage container build validation.

---

## Docker Hub Images

Pre-built multi-arch images can be pulled directly:

```bash
# Backend image
docker pull arcohnix/utms-backend:latest

# Frontend image
docker pull arcohnix/utms-frontend:latest

# External Watchdog image
docker pull arcohnix/utms-watchdog:latest
```

To build and tag locally for your own registry:
```bash
docker build -t <your-username>/utms-backend:latest .
docker build -t <your-username>/utms-frontend:latest ./frontend
docker build -t <your-username>/utms-watchdog:latest . -f Dockerfile
```

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
