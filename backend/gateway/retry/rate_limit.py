from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from typing import Any

from systemconfig.limits import (
    DEFAULT_RETRY_AFTER_SECONDS,
    MAX_MODEL_ATTEMPTS,
    MODEL_CALL_TIMEOUT_SECONDS,
)

logger = logging.getLogger(__name__)


def isRateLimitError(exc: BaseException) -> bool:
    """Return True if the exception looks like a provider 429 / rate-limit error."""
    msg = str(exc).lower()
    return "429" in msg or "rate limit" in msg or "rate_limit" in msg or "too many requests" in msg


def retryAfterSeconds(exc: BaseException) -> float:
    """Parse the Retry-After value from the exception message, or fall back to the default."""
    msg = str(exc)
    import re

    match = re.search(r"retry.after[:\s]+(\d+(?:\.\d+)?)", msg, re.IGNORECASE)
    if match:
        return float(match.group(1))
    return float(DEFAULT_RETRY_AFTER_SECONDS)


async def callWithRateLimitRetry(
    fn: Callable[[], Any],
    attempts: int = MAX_MODEL_ATTEMPTS,
    timeout: float = MODEL_CALL_TIMEOUT_SECONDS,
) -> Any:
    """
    Call an async callable up to `attempts` times.
    On 429 errors, sleep Retry-After seconds and retry.
    On other errors or timeout, raise immediately.
    """
    last_exc: BaseException | None = None
    for attempt in range(1, attempts + 1):
        try:
            return await asyncio.wait_for(fn(), timeout=timeout)
        except TimeoutError as exc:
            logger.warning("[retry] attempt %d/%d timed out after %ss", attempt, attempts, timeout)
            last_exc = exc
            raise
        except Exception as exc:
            if isRateLimitError(exc):
                wait = retryAfterSeconds(exc)
                logger.warning(
                    "[retry] attempt %d/%d rate-limited; sleeping %.1fs", attempt, attempts, wait
                )
                await asyncio.sleep(wait)
                last_exc = exc
                continue
            raise
    raise last_exc  # type: ignore[misc]
