"""Entrypoint script to execute the UTMS External Watchdog daemon."""

import asyncio
import logging
import signal

from watchdog.config import get_watchdog_config
from watchdog.watchdog import ExternalWatchdog


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] [WATCHDOG] %(message)s",
    )
    config = get_watchdog_config()
    watchdog = ExternalWatchdog(config=config)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    task = loop.create_task(watchdog.run_forever())

    def stop_signal_handler(sig, frame):
        logging.info("Received signal %s; shutting down watchdog...", sig)
        task.cancel()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            signal.signal(sig, stop_signal_handler)
        except (ValueError, AttributeError):
            pass

    try:
        loop.run_until_complete(task)
    except asyncio.CancelledError:
        pass
    finally:
        loop.close()
        logging.info("Watchdog process exited cleanly.")


if __name__ == "__main__":
    main()
