"""Shared logger factory for agent handlers."""

import sys
from datetime import datetime, timezone


def create_logger(prefix: str):
    """Create a logger with consistent [prefix][timestamp] format."""

    class _Logger:
        @staticmethod
        def _ts() -> str:
            return datetime.now(timezone.utc).isoformat()

        @staticmethod
        def log(*args: object) -> None:
            print(f"[{prefix}][{_Logger._ts()}]", *args, flush=True)

        @staticmethod
        def error(*args: object) -> None:
            print(f"[{prefix}][{_Logger._ts()}]", *args, file=sys.stderr, flush=True)

    return _Logger()
