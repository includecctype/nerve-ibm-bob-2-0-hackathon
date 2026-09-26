from __future__ import annotations

import logging
import time

from gateway.config import sio
from gateway.state.runtime_state import error_bounce_count, error_cooldown
from systemconfig.limits import ERROR_COOLDOWN_SECONDS, MAX_GIVE_UP_BOUNCES

logger = logging.getLogger(__name__)


async def emitAgentError(sid: str, message: str) -> None:
    """Emit an agent_error event, deduped within ERROR_COOLDOWN_SECONDS."""
    now = time.monotonic()
    last = error_cooldown.get(sid, 0.0)
    if now - last < ERROR_COOLDOWN_SECONDS:
        logger.debug("[error] suppressing duplicate agent_error for sid=%s", sid)
        return
    error_cooldown[sid] = now
    await sio.emit("agent_error", message, to=sid)


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
    error_cooldown.pop(sid, None)


def isGiveUpExhausted(sid: str) -> bool:
    """Return True when the give-up bounce cap has been exceeded."""
    return error_bounce_count.get(sid, 0) > MAX_GIVE_UP_BOUNCES
