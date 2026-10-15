# ==============================================================================
# Multi-Stage Dockerfile: Frontend React SPA (Vite + Tailwind + Nginx)
# ==============================================================================

# Stage 1: Build the React Application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies cleanly
RUN npm ci || npm install

# Copy application sources
COPY . .

# Build production assets
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Serve with Production Nginx Web Server
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine

# Remove default nginx configurations
RUN rm -rf /etc/nginx/conf.d/*

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled SPA static artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Health check probe
HEALTHCHECK --interval=10s --timeout=5s --start-period=3s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/nginx-health || exit 1

STOPSIGNAL SIGQUIT

CMD ["nginx", "-g", "daemon off;"]
