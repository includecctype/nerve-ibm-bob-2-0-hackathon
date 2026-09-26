from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable

from systemconfig.limits import (
    DEFAULT_RETRY_AFTER_SECONDS,
    MAX_MODEL_ATTEMPTS,
    MODEL_CALL_TIMEOUT_SECONDS,
)


def isRateLimitError(exc: BaseException) -> bool:
    """Return True when the exception is a provider 429 / rate-limit error."""
    status = getattr(exc, "status_code", None)
    if status == 429:
        return True
    name = type(exc).__name__
    return name == "TooManyRequestsResponseError" or "TooManyRequests" in name


def retryAfterSeconds(exc: BaseException) -> float:
    """Read Retry-After from the exception's response headers, or fall back to the default."""
    headers = getattr(exc, "headers", None)
    if headers is not None:
        try:
            value = headers.get("Retry-After") if hasattr(headers, "get") else None
            if value is not None:
                return float(value)
        except (TypeError, ValueError, AttributeError):
            pass
    data = getattr(exc, "data", None)
    if data is not None:
        error = getattr(data, "error", None)
        metadata = getattr(error, "metadata", None) if error is not None else None
        if metadata is not None and hasattr(metadata, "get"):
            try:
                raw_headers = metadata.get("headers") or metadata.get("Headers")
                if isinstance(raw_headers, dict):
                    value = raw_headers.get("Retry-After") or raw_headers.get("retry-after")
                    if value is not None:
                        return float(value)
            except (TypeError, ValueError):
                pass
    return float(DEFAULT_RETRY_AFTER_SECONDS)


async def callWithRateLimitRetry[T](
    factory: Callable[[], Awaitable[T]],
    *,
    attempts: int = MAX_MODEL_ATTEMPTS,
    timeout: float = MODEL_CALL_TIMEOUT_SECONDS,
) -> T:
    """Run an async call with a per-attempt timeout; on 429 wait Retry-After and retry.

    Non-rate-limit failures and the final attempt are raised immediately.
    """
    if attempts < 1:
        raise ValueError("attempts must be at least 1")
    for attempt in range(attempts):
        try:
            return await asyncio.wait_for(factory(), timeout=timeout)
        except TimeoutError as exc:
            raise TimeoutError(f"Call timed out after {timeout}s") from exc
        except BaseException as exc:
            if not isRateLimitError(exc) or attempt + 1 >= attempts:
                raise
            await asyncio.sleep(retryAfterSeconds(exc))
    raise RuntimeError("retry loop exited without returning or raising")
