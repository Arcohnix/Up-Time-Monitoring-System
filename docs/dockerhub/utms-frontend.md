# arcohnixx/utms-frontend

> **Short Description:** Production React SPA web dashboard and Nginx reverse proxy for Uptime Monitoring System (UTMS).

[![Docker Image](https://img.shields.io/badge/docker-arcohnixx%2Futms--frontend-blue.svg?logo=docker)](https://hub.docker.com/r/arcohnixx/utms-frontend)
[![GitHub Repository](https://img.shields.io/badge/GitHub-Arcohnix%2FUp--Time--Monitoring--System-black?logo=github)](https://github.com/Arcohnix/Up-Time-Monitoring-System)
[![Nginx Version](https://img.shields.io/badge/nginx-1.27--alpine-green?logo=nginx)](https://nginx.org/)
[![React Version](https://img.shields.io/badge/react-19-blue?logo=react)](https://react.dev/)

---

## Overview

`arcohnixx/utms-frontend` is the official user interface for the **Uptime Monitoring System (UTMS)**. It packages a compiled Single Page Application (SPA) built with React 19, TypeScript, and Tailwind CSS, served by an optimized, security-hardened Nginx web server.

In addition to serving client-side UI assets, the container functions as an API gateway reverse proxy, routing browser requests for `/api/` and `/health` directly to the backend service over Docker's internal networking.

---

## Architectural Role

The frontend container sits at the network boundary facing browser clients, decoupling the client UI from backend API concerns:

```
                  ┌─────────────────────────────────────────┐
                  │              Web Browser                │
                  └────────────────────┬────────────────────┘
                                       │ HTTP (Port 80/3000)
                                       ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ arcohnixx/utms-frontend (Nginx 1.27)                                      │
│                                                                           │
│  ├── Static Assets (/*) ──────► Compiled React 19 SPA (/usr/share/nginx)   │
│  ├── Health Probe (/nginx-health) ──► HTTP 200 "healthy"                  │
│  └── Reverse Proxy (/api/*, /health)                                      │
└──────────────────────────────────────┬────────────────────────────────────┘
                                       │ Internal Network: http://backend:8000
                                       ▼
                        ┌─────────────────────────────┐
                        │   arcohnixx/utms-backend    │
                        └─────────────────────────────┘
```

1. **Static File Serving:** Delivers compiled HTML, CSS, JavaScript bundles, fonts, and SVG assets with Gzip compression and browser caching headers (`max-age=15552000`).
2. **SPA Client-Side Routing:** Enforces standard SPA fallback routing (`try_files $uri $uri/ /index.html;`), allowing seamless client-side navigation.
3. **Internal API Reverse Proxy:** Eliminates Cross-Origin Resource Sharing (CORS) friction by forwarding `/api/*` and `/health` requests to `http://backend:8000`.
4. **Security Hardening:** Injects production headers including `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, and `Referrer-Policy: strict-origin-when-cross-origin`.

---

## Technology Stack

- **Base Web Server:** Nginx 1.27-alpine
- **UI Framework:** React 19 / TypeScript / Vite
- **Styling & Design System:** Tailwind CSS with custom Dark / Light / System theme engine
- **Icons & Visuals:** Lucide React icons & custom SVG trendline visualizers
- **Build Mechanism:** Multi-stage Docker build (Node 22-alpine compilation stage discarded; runtime container contains only static files and Nginx binary)

---

## Dashboard Capabilities

The dashboard provides observability and control for your monitored infrastructure:

- **Theme Engine:** Integrated Dark mode, Light mode, and System preference synchronization accessible via a theme toggle in the header navigation.
- **Global Command Palette:** Keyboard-driven navigation and search modal triggered with `⌘K` (macOS) or `Ctrl+K` (Linux/Windows).
- **Fleet-Wide Overview:** Real-time KPI summary displaying active services, global availability status, active incident counter, and fleet-wide average latency.
- **Service Inventory & Status:** Service cards and list views highlighting current state (`HEALTHY`, `DEGRADED`, `DOWN`), last checked timestamp, probe frequency, and consecutive failure counts.
- **Interactive Latency History:** Responsive SVG line charts showing recent response times, degraded latency ceilings, and check outcomes.
- **Active Incident Tracker:** Real-time incident logs providing outage durations, failure reasons, HTTP status codes, and recovery timestamps.
- **Service Management:** Modals for registering new monitored endpoints, configuring check intervals, adjusting timeout thresholds, pausing monitoring, and deleting services.
- **On-Demand Health Probes:** Trigger manual checks instantly from the UI without waiting for scheduled intervals.

---

## Production Build & Container Characteristics

- **Image Footprint:** Minimal Alpine-based footprint (< 30 MB compressed).
- **Zero Runtime Node.js:** The Node.js compiler and `node_modules` are completely excluded from the runtime image.
- **Process Management:** Runs directly with `nginx -g "daemon off;"` responding to `SIGQUIT` for graceful teardown.
- **Container Health Check:** Features a built-in healthcheck probe at `/nginx-health` returning HTTP 200.

---

## Exposed Ports & Endpoints

- **Exposed Port:** `80` (typically mapped to host port `3000` or port `80`)

### Endpoints

| Endpoint | Method | Handling |
| :--- | :--- | :--- |
| `/` | `GET` | Serves React Single Page Application (`index.html`). |
| `/nginx-health` | `GET` | Direct Nginx container liveness probe returning HTTP 200 `"healthy\n"`. |
| `/api/*` | `ANY` | Reverse-proxied upstream to `http://backend:8000/api/*`. |
| `/health` | `GET` | Reverse-proxied upstream to `http://backend:8000/health`. |

---

## Running with Docker Compose (Recommended)

In a standard UTMS stack, the frontend is deployed alongside `arcohnixx/utms-backend` on a shared Docker network named `utms_network`:

```yaml
services:
  frontend:
    image: arcohnixx/utms-frontend:latest
    container_name: utms_frontend
    restart: unless-stopped
    ports:
      - "3000:80"
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://127.0.0.1/nginx-health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 5s
    networks:
      - utms_network

networks:
  utms_network:
    name: utms_network
    driver: bridge
```

Start the frontend service:

```bash
docker compose up -d frontend
```

Access the dashboard at `http://localhost:3000`.

---

## Running Standalone

To run the container standalone while proxying to a running backend container:

```bash
# 1. Ensure the shared Docker network exists
docker network create utms_network

# 2. Launch the frontend container
docker run -d \
  --name utms_frontend \
  --network utms_network \
  -p 3000:80 \
  --restart unless-stopped \
  arcohnixx/utms-frontend:latest
```

> **Note:** The internal Nginx configuration proxies `/api/` to the hostname `http://backend:8000/`. When running with custom container names or non-default hosts, ensure a host entry or DNS alias exists for `backend` on the shared Docker network (e.g. `--network-alias backend`).

### Customizing Nginx Configuration (Optional)

If your backend is located at a different network address or port, you can mount a customized `nginx.conf` into the container:

```bash
docker run -d \
  --name utms_frontend \
  -p 80:80 \
  -v /path/to/custom_nginx.conf:/etc/nginx/conf.d/default.conf:ro \
  arcohnixx/utms-frontend:latest
```

---

## Available Image Tags

- `arcohnixx/utms-frontend:latest` — Current stable build from the `main` branch.

---

## Relationship to Other UTMS Components

- **`arcohnixx/utms-backend`**: The upstream API service. Nginx proxies all client requests for `/api/` and `/health` to `http://backend:8000/`. The backend must be healthy for the frontend to render live data and accept management actions.
- **`arcohnixx/utms-watchdog`**: Probes the backend independently. While the frontend visualizes monitoring states for human operators, the watchdog independently verifies system self-health.

---

## Troubleshooting

### HTTP 502 Bad Gateway when loading dashboard data
- **Symptoms:** The UI shell loads, but toast error notifications appear and API requests fail with status 502.
- **Cause:** Nginx cannot reach `http://backend:8000/`. Either the backend container is stopped, not yet healthy, or not attached to the same Docker network.
- **Resolution:**
  1. Check backend status: `docker ps --filter name=utms_backend`.
  2. Verify network connectivity: Ensure both containers are on the same network (`utms_network`).
  3. Verify backend health: Run `curl -f http://localhost:8000/health`.

### Dashboard displays a blank screen or 404 on deep links
- **Symptoms:** Refreshing the browser on a subpath produces a 404 error.
- **Cause:** Standard web servers fail to resolve client-side routes unless SPA fallback is configured.
- **Resolution:** The image includes built-in SPA routing (`try_files $uri $uri/ /index.html;`). If you mounted a custom Nginx configuration, verify that the fallback directive is included.

### Container fails healthcheck probe
- **Symptoms:** `docker ps` reports the frontend container as `unhealthy`.
- **Cause:** Port 80 inside the container is blocked or Nginx crashed.
- **Resolution:** Inspect Nginx logs using `docker logs utms_frontend` to check for configuration or permission errors.

---

## Source & References

- **GitHub Repository:** [Up-Time-Monitoring-System](https://github.com/Arcohnix/Up-Time-Monitoring-System)
- **Issue Tracker:** [GitHub Issues](https://github.com/Arcohnix/Up-Time-Monitoring-System/issues)
