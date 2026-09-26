from __future__ import annotations

import logging
import time
from typing import Self

logger = logging.getLogger(__name__)


def elapsedMsSince(start: float) -> int:
    """Return elapsed milliseconds since a time.monotonic() snapshot."""
    return int((time.monotonic() - start) * 1000)


def logStep(label: str, start: float) -> None:
    """Log a [timing] line with elapsed ms since start."""
    logger.info("[timing] %s: %dms", label, elapsedMsSince(start))


class timedStep:
    """Context manager that logs elapsed time for a named step."""

    def __init__(self, label: str) -> None:
        self._label = label
        self._start = 0.0

    def __enter__(self) -> Self:
        self._start = time.monotonic()
        return self

    def __exit__(self, *_: object) -> None:
        logStep(self._label, self._start)
