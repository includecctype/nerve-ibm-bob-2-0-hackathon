from __future__ import annotations

import time
from collections import defaultdict, deque
from collections.abc import Callable

from systemconfig import limits


class SlidingWindowLimiter:
    """In-memory sliding-window limiter keyed by an arbitrary string.

    The gateway runs as a single process, so a process-local counter is enough
    to absorb demo abuse; no shared store is required.
    """

    def __init__(
        self,
        max_events: int,
        window_seconds: float,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._max_events = max_events
        self._window_seconds = window_seconds
        self._clock = clock
        self._events: dict[str, deque[float]] = defaultdict(deque)

    def _prune(self, key: str, now: float) -> deque[float]:
        window = self._events[key]
        cutoff = now - self._window_seconds
        while window and window[0] <= cutoff:
            window.popleft()
        return window

    def allow(self, key: str) -> bool:
        """Record one event for key; return False when the window is already full."""
        now = self._clock()
        window = self._prune(key, now)
        if len(window) >= self._max_events:
            return False
        window.append(now)
        return True

    def retryAfterSeconds(self, key: str) -> float:
        """Seconds until the oldest event leaves the window (0 when not limited)."""
        now = self._clock()
        window = self._prune(key, now)
        if not window:
            return 0.0
        return max(0.0, self._window_seconds - (now - window[0]))


connect_limiter = SlidingWindowLimiter(
    limits.RATE_LIMIT_CONNECT_MAX, limits.RATE_LIMIT_CONNECT_WINDOW_SECONDS
)
prompt_limiter = SlidingWindowLimiter(
    limits.RATE_LIMIT_PROMPT_MAX, limits.RATE_LIMIT_PROMPT_WINDOW_SECONDS
)


def clientIp(environ: dict) -> str:
    """Return the client IP, honouring the proxy headers Render sets.

    Render terminates TLS in front of the app, so REMOTE_ADDR is the proxy;
    the real client is the first hop in X-Forwarded-For.
    """
    forwarded = str(environ.get("HTTP_X_FORWARDED_FOR", "") or "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = str(environ.get("HTTP_X_REAL_IP", "") or "")
    if real_ip:
        return real_ip.strip()
    return str(environ.get("REMOTE_ADDR", "") or "unknown")
