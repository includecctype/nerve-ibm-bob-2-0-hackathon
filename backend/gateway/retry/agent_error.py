from __future__ import annotations

import logging
import time

from gateway.config import sio
from gateway.state.runtime_state import error_bounce_count, error_cooldown
from systemconfig.limits import ERROR_COOLDOWN_SECONDS, MAX_GIVE_UP_BOUNCES

logger = logging.getLogger(__name__)


def errorBounceCount(sid: str) -> int:
    """Return the current error bounce count for a sid."""
    return error_bounce_count.get(sid, 0)


def bumpErrorBounce(sid: str) -> int:
    """Increment and return the error bounce count for a sid."""
    count = error_bounce_count.get(sid, 0) + 1
    error_bounce_count[sid] = count
    return count


def resetErrorBounce(sid: str) -> None:
    """Reset the error bounce counter on a successful prompt."""
    error_bounce_count[sid] = 0


def clearErrorState(sid: str) -> None:
    """Remove all error tracking for a sid (called on disconnect)."""
    error_bounce_count.pop(sid, None)
    for key in [key for key in error_cooldown if key[0] == sid]:
        error_cooldown.pop(key, None)


def shouldEmitAgentError(sid: str, message: str) -> bool:
    """False if an identical (sid, message) was emitted within ERROR_COOLDOWN_SECONDS."""
    key = (sid, message)
    now = time.monotonic()
    last = error_cooldown.get(key)
    if last is not None and now - last < ERROR_COOLDOWN_SECONDS:
        return False
    error_cooldown[key] = now
    return True


def isGiveUpExhausted(sid: str) -> bool:
    """Return True when the give-up bounce cap has been exceeded."""
    return errorBounceCount(sid) > MAX_GIVE_UP_BOUNCES


async def emitAgentError(sid: str, message: str) -> None:
    """Emit agent_error unless the bounce cap is past or the same error is cooling down."""
    if isGiveUpExhausted(sid):
        return
    if not shouldEmitAgentError(sid, message):
        logger.debug("[error] suppressing duplicate agent_error for sid=%s", sid)
        return
    await sio.emit("agent_error", message, to=sid)
