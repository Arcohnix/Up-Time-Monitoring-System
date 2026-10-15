"""Configuration settings for the external watchdog mechanism."""

import os
from dataclasses import dataclass


@dataclass
class WatchdogConfig:
    """External watchdog configuration parsed from environment variables."""

    # Target URL of the Uptime Monitoring System API
    target_url: str = os.getenv("WATCHDOG_TARGET_URL", "http://localhost:8000").rstrip("/")

    # Evaluation frequency in seconds
    check_interval_seconds: float = float(os.getenv("WATCHDOG_CHECK_INTERVAL_SECONDS", "5.0"))

    # HTTP probe request timeout in seconds
    timeout_seconds: float = float(os.getenv("WATCHDOG_TIMEOUT_SECONDS", "5.0"))

    # Consecutive failed probes before declaring the monitoring system DOWN
    failure_threshold: int = int(os.getenv("WATCHDOG_FAILURE_THRESHOLD", "2"))

    # Maximum acceptable seconds since last scheduler heartbeat before flagging worker failure
    heartbeat_stale_threshold_seconds: float = float(
        os.getenv("WATCHDOG_HEARTBEAT_STALE_THRESHOLD_SECONDS", "30.0")
    )

    # Optional external notification webhook URL
    alert_webhook_url: str = os.getenv("WATCHDOG_ALERT_WEBHOOK_URL", "").strip()


def get_watchdog_config() -> WatchdogConfig:
    """Retrieve external watchdog configuration."""
    return WatchdogConfig()
