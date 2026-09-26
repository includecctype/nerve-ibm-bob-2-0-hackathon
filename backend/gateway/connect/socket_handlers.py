from __future__ import annotations

import asyncio
import logging

from ai_tool.delegation.pending_requests.pending_requests import (
    cancelPendingRequests,
    resolveToolResult,
)
from ai_tool.task.emit.planning_placeholder import emitPlanningPlaceholder
from ai_tool.task.task_graph import buildStatusMap, cascadeBlocked
from ai_tool.tool_registry import getMainAgentTools
from gateway.agent.invoke_main_agent import invokeMainAgent
from gateway.config import AgentBinding, ConnectedUserMemory, connected_users, sio
from gateway.dto.legacy_task_migration import normalizeLegacyTasks
from gateway.dto.task_auth import normalizeCategories, splitCategories
from gateway.prompt.questionnaire import QUESTIONNAIRE_SYSTEM
from gateway.prompt.user_prompt import USER_PROMPT_SYSTEM
from gateway.retry.agent_error import clearErrorState, resetErrorBounce
from gateway.state.runtime_state import exec_locks, sid_locks
from model.main_agent import createMainAgent

logger = logging.getLogger(__name__)


@sio.event
async def connect(sid: str, environ: dict, auth: dict | None) -> None:
    auth = auth or {}
    api_key: str = auth.get("api_key", "")
    main_agent_id: int = int(auth.get("main_agent_id", 1))

    if not api_key or main_agent_id not in range(1, 6):
        logger.warning("[connect] rejected sid=%s (bad auth)", sid)
        await sio.emit("connection_status", False, to=sid)
        return

    try:
        # Restore task graph — prefer new categories shape, fall back to legacy flat lists
        raw_categories: list = auth.get("categories") or []
        if raw_categories:
            all_categories = normalizeCategories(raw_categories)
        else:
            all_categories = normalizeLegacyTasks(
                auth.get("pending_task"), auth.get("running_task")
            )

        pending, completed = splitCategories(all_categories)

        # Pre-block dependents of already-failed/blocked completed categories
        status_map = buildStatusMap(pending, [], completed)
        _, pending = cascadeBlocked(pending, status_map)

        history: list[dict] = auth.get("history") or []

        agent_session = createMainAgent(main_agent_id, api_key, getMainAgentTools(sid))

        connected_users[sid] = ConnectedUserMemory(
            api_key=api_key,
            main_agent=AgentBinding(agent_id=main_agent_id, session=agent_session),
            pending_categories=pending,
            running_categories=[],
            completed_categories=completed,
            history=history,
        )

        await sio.emit("connection_status", True, to=sid)
        logger.info("[connect] sid=%s agent_id=%d", sid, main_agent_id)

    except Exception:
        logger.exception("[connect] error for sid=%s", sid)
        await sio.emit("connection_status", False, to=sid)


@sio.event
async def user_prompt(sid: str, data: str) -> None:
    mem = connected_users.get(sid)
    if mem is None:
        return

    resetErrorBounce(sid)
    mem.last_user_request = str(data)

    await emitPlanningPlaceholder(
        sid,
        mem.pending_categories + mem.running_categories + mem.completed_categories,
    )

    asyncio.create_task(invokeMainAgent(sid, USER_PROMPT_SYSTEM, str(data)))


@sio.event
async def questionnaire_answers(sid: str, data: list) -> None:
    mem = connected_users.get(sid)
    if mem is None:
        return

    # Format the answers into a readable message
    lines: list[str] = []
    for item in data or []:
        if isinstance(item, dict):
            q = item.get("question", "")
            a = item.get("answer", "")
            lines.append(f"Q: {q}\nA: {a}")
    formatted = "\n\n".join(lines) if lines else str(data)

    asyncio.create_task(invokeMainAgent(sid, QUESTIONNAIRE_SYSTEM, formatted))


@sio.event
async def agent_error_response(sid: str, data: str) -> None:
    """CLI bounce-back after an agent_error — triggers the give-up loop."""
    from gateway.prompt.give_up import GIVE_UP_SYSTEM_PROMPT
    from gateway.retry.agent_error import bumpErrorBounce, isGiveUpExhausted

    mem = connected_users.get(sid)
    if mem is None:
        return

    bumpErrorBounce(sid)
    if isGiveUpExhausted(sid):
        await sio.emit("main_agent_response", str(data), to=sid)
        return

    asyncio.create_task(invokeMainAgent(sid, GIVE_UP_SYSTEM_PROMPT, str(data)))


@sio.event
async def tool_result(sid: str, data: dict) -> None:
    """Resolve a pending tool future when the CLI returns a tool_result."""
    request_id: str = data.get("id", "")
    ok: bool = bool(data.get("ok", False))
    output: str = str(data.get("output", ""))
    await resolveToolResult(sid, request_id, ok, output)


@sio.event
async def disconnect(sid: str) -> None:
    logger.info("[disconnect] sid=%s", sid)

    await cancelPendingRequests(sid)

    connected_users.pop(sid, None)

    # Release prompt lock if still held
    lock = sid_locks.pop(sid, None)
    if lock and lock.locked():
        lock.release()

    # Release exec lock if still held
    exec_lock = exec_locks.pop(sid, None)
    if exec_lock and exec_lock.locked():
        exec_lock.release()

    clearErrorState(sid)
