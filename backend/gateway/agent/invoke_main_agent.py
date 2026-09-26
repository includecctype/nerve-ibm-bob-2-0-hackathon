from __future__ import annotations

import logging
import time

from gateway.agent.with_task_context import withTaskContext
from gateway.config import connected_users, sio
from gateway.observability.timing import logStep
from gateway.retry.agent_error import (
    bumpErrorBounce,
    emitAgentError,
    isGiveUpExhausted,
    resetErrorBounce,
)
from gateway.retry.rate_limit import callWithRateLimitRetry
from gateway.state.session_locks import (
    acquirePromptLock,
    finishPromptLock,
)
from model.agent_session import lastTextFromResult
from systemconfig.limits import AGENT_TURN_TIMEOUT_SECONDS

logger = logging.getLogger(__name__)


async def invokeMainAgent(sid: str, system_prompt: str, user_message: str) -> None:
    """
    Run one main-agent turn under the prompt lock, with retry/timeout.
    Emits main_agent_response on success, or triggers the give-up loop on failure.
    """
    mem = connected_users.get(sid)
    if mem is None:
        return

    session = mem.main_agent.session
    if session is None:
        logger.error("[agent] no session for sid=%s", sid)
        return

    await acquirePromptLock(sid)
    turn_start = time.monotonic()
    try:

        async def _call():
            return await session.runTurn(
                withTaskContext(sid, system_prompt),
                user_message,
                mem.history,
            )

        result = await callWithRateLimitRetry(_call, timeout=AGENT_TURN_TIMEOUT_SECONDS)
        logStep("agent_turn", turn_start)

        response_text = lastTextFromResult(result)
        resetErrorBounce(sid)
        await sio.emit("main_agent_response", response_text, to=sid)

    except Exception as exc:
        logStep("agent_turn_failed", turn_start)
        logger.exception("[agent] turn failed for sid=%s", sid)
        error_msg = str(exc)

        bumpErrorBounce(sid)
        if isGiveUpExhausted(sid):
            # Past the cap — emit provider text directly, no model call
            await sio.emit("main_agent_response", error_msg, to=sid)
        else:
            # Give-up bounce: invoke with no tools, plain text only
            await emitAgentError(sid, error_msg)

    finally:
        await finishPromptLock(sid)
