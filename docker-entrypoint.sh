#!/bin/sh
set -e

# If running the standalone watchdog daemon, skip database migrations and exec immediately
if [ "$1" = "python" ] && [ "$2" = "-m" ] && [ "$3" = "watchdog.main" ]; then
    exec "$@"
fi

# Wait for PostgreSQL connectivity if POSTGRES_SERVER is specified

if [ -n "$POSTGRES_SERVER" ]; then
    PORT="${POSTGRES_PORT:-5432}"
    echo "Checking database readiness at ${POSTGRES_SERVER}:${PORT}..."
    until python -c "
import socket, sys
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(2)
try:
    s.connect(('${POSTGRES_SERVER}', int('${PORT}')))
    s.close()
    sys.exit(0)
except Exception:
    sys.exit(1)
"; do
        echo "Waiting for PostgreSQL to accept connections..."
        sleep 1
    done
    echo "PostgreSQL is reachable!"
fi

# Apply pending Alembic migrations automatically on startup
echo "Applying database migrations..."
alembic upgrade head
echo "Database migrations applied successfully."

# Execute the primary container command (e.g., uvicorn)
exec "$@"
