from __future__ import annotations

import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


def logStep(name: str, elapsed_ms: float) -> None:
    """Log a [timing] line at info level."""
    logger.info("[timing] %s: %.0fms", name, elapsed_ms)


def elapsedMsSince(started_at: float) -> float:
    """Return elapsed milliseconds since a time.perf_counter() snapshot."""
    return (time.perf_counter() - started_at) * 1000.0


@asynccontextmanager
async def timedStep(name: str) -> AsyncIterator[None]:
    """Async context manager that logs elapsed time for a named step."""
    started_at = time.perf_counter()
    try:
        yield
    finally:
        logStep(name, elapsedMsSince(started_at))
