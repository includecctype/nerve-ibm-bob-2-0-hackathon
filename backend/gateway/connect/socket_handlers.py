from __future__ import annotations

import asyncio
import logging
import math

from ai_tool.delegation.pending_requests.pending_requests import (
    cancelPendingRequests,
    resolveToolResult,
)
from ai_tool.task.emit.planning_placeholder import emitPlanningPlaceholder
from ai_tool.task.emit.task import updateTaskDisplay
from ai_tool.task.task_graph import buildStatusMap, cascadeBlocked
from ai_tool.tool_registry import getMainAgentTools
from gateway.config import AgentBinding, ConnectedUserMemory, connected_users, sio
from gateway.dto.legacy_task_migration import normalizeLegacyTasks
from gateway.dto.task_auth import normalizeCategories, splitCategories
from gateway.prompt.questionnaire import QUESTIONNAIRE_SYSTEM
from gateway.prompt.user_prompt import USER_PROMPT_SYSTEM
from gateway.ratelimit.inbound_limiter import clientIp, connect_limiter, prompt_limiter
from gateway.retry.agent_error import clearErrorState, resetErrorBounce
from gateway.state.prompt_queue import (
    PROMPT_KIND_GIVE_UP,
    PROMPT_KIND_QUESTIONNAIRE,
    PROMPT_KIND_USER,
    enqueuePrompt,
    startPromptQueue,
    stopPromptQueue,
)
from gateway.state.runtime_state import exec_locks, sid_locks
from model.main_agent import createMainAgent
from model.model_client import PROVIDED_AGENT_ID, WATSONX_AGENT_ID, providedModelKey
from storage.oci.session_folder import makeSessionFolder
from storage.service import storage_service

logger = logging.getLogger(__name__)


async def promptRateLimited(sid: str, client_ip: str) -> bool:
    """Throttle prompt turns per client IP; emit rate_limited and return True when full."""
    if prompt_limiter.allow(client_ip):
        return False
    retry_after = math.ceil(prompt_limiter.retryAfterSeconds(client_ip))
    logger.warning("[ratelimit] prompt denied sid=%s ip=%s", sid, client_ip)
    await sio.emit("rate_limited", {"retry_after": retry_after}, to=sid)
    return True


@sio.event
async def connect(sid: str, environ: dict, auth: dict | None) -> None:
    auth = auth or {}

    client_ip = clientIp(environ)
    if not connect_limiter.allow(client_ip):
        logger.warning("[connect] rate limited sid=%s ip=%s", sid, client_ip)
        await sio.emit("connection_status", False, to=sid)
        return

    try:
        api_key: str = auth.get("api_key", "")
        main_agent_id: int = int(auth.get("main_agent_id", 1))
    except (TypeError, ValueError):
        logger.warning("[connect] rejected sid=%s (malformed auth)", sid)
        await sio.emit("connection_status", False, to=sid)
        return

    client_kind = str(auth.get("client_kind", "cli"))
    is_provided = main_agent_id == PROVIDED_AGENT_ID
    is_watsonx = main_agent_id == WATSONX_AGENT_ID

    # The provided model is funded for the web demo only; the CLI must use its
    # own key, so refuse it for any non-web client.
    if is_provided and client_kind != "web":
        logger.warning("[connect] rejected sid=%s (provided model is web-only)", sid)
        await sio.emit("connection_status", False, to=sid)
        return

    if (not api_key and not is_provided and not is_watsonx) or main_agent_id not in range(1, 8):
        logger.warning("[connect] rejected sid=%s (bad auth)", sid)
        await sio.emit("connection_status", False, to=sid)
        return

    try:
        # The provided model is funded by the operator, so its key comes from the
        # environment; clients that select it may send an empty key.
        if is_provided:
            api_key = providedModelKey()

        # Restore task graph — prefer new categories shape, fall back to legacy flat lists
        all_categories = normalizeCategories(auth.get("categories"))
        if not all_categories:
            all_categories = normalizeLegacyTasks(
                auth.get("pending_task"), auth.get("running_task")
            )

        pending, completed = splitCategories(all_categories)

        # Pre-block dependents of already-failed/blocked completed categories
        status_map = buildStatusMap(pending, [], completed)
        newly_blocked, pending = cascadeBlocked(pending, status_map)
        completed.extend(newly_blocked)

        history: list[dict] = auth.get("history") or []

        # Web clients get a fresh object-storage folder per visit; the CLI works
        # against the local machine instead and gets no folder.
        storage_folder = makeSessionFolder() if client_kind == "web" else None
        if storage_folder is not None:
            try:
                await asyncio.to_thread(
                    storage_service.ensureSession, storage_folder, main_agent_id
                )
            except Exception:  # storage is best-effort at connect time
                logger.exception("[connect] could not create the storage folder for sid=%s", sid)

        agent_session = createMainAgent(main_agent_id, api_key, getMainAgentTools(sid))

        connected_users[sid] = ConnectedUserMemory(
            api_key=api_key,
            main_agent=AgentBinding(agent_id=main_agent_id, session=agent_session),
            pending_categories=pending,
            running_categories=[],
            completed_categories=completed,
            history=history,
            client_kind=client_kind,
            client_ip=client_ip,
            storage_folder=storage_folder,
        )

        # Prompts are handled by one worker per session so turns never overlap.
        startPromptQueue(sid)

        # Publish the normalised graph (running downgraded to pending) so a
        # reconnecting client renders the restored state instead of stale statuses.
        await updateTaskDisplay(sid, connected_users)

        if storage_folder is not None:
            await sio.emit("storage_session", {"folder": storage_folder}, to=sid)

        await sio.emit("connection_status", True, to=sid)
        logger.info("[connect] sid=%s agent_id=%d kind=%s", sid, main_agent_id, client_kind)

    except Exception:
        logger.exception("[connect] error for sid=%s", sid)
        await sio.emit("connection_status", False, to=sid)


@sio.event
async def user_prompt(sid: str, data: str) -> None:
    mem = connected_users.get(sid)
    if mem is None:
        return

    if await promptRateLimited(sid, mem.client_ip):
        return

    resetErrorBounce(sid)
    mem.last_user_request = str(data)

    await emitPlanningPlaceholder(
        sid,
        mem.pending_categories + mem.running_categories + mem.completed_categories,
    )

    depth = enqueuePrompt(sid, USER_PROMPT_SYSTEM, str(data), PROMPT_KIND_USER)
    logger.info("[prompt] queued sid=%s kind=user depth=%d", sid, depth)


@sio.event
async def questionnaire_answers(sid: str, data: list) -> None:
    mem = connected_users.get(sid)
    if mem is None:
        return

    if await promptRateLimited(sid, mem.client_ip):
        return

    resetErrorBounce(sid)
    await emitPlanningPlaceholder(
        sid,
        mem.pending_categories + mem.running_categories + mem.completed_categories,
    )

    # Format the answers into a readable message
    lines: list[str] = []
    for item in data or []:
        if isinstance(item, dict):
            q = item.get("question", "")
            a = item.get("answer", "")
            lines.append(f"Q: {q}\nA: {a}")
    formatted = "\n\n".join(lines) if lines else str(data)

    depth = enqueuePrompt(sid, QUESTIONNAIRE_SYSTEM, formatted, PROMPT_KIND_QUESTIONNAIRE)
    logger.info("[prompt] queued sid=%s kind=questionnaire depth=%d", sid, depth)


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

    depth = enqueuePrompt(sid, GIVE_UP_SYSTEM_PROMPT, str(data), PROMPT_KIND_GIVE_UP)
    logger.info("[prompt] queued sid=%s kind=give_up depth=%d", sid, depth)


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

    # Stop the prompt worker before the session is removed, so it never runs a
    # queued turn against a session that is already gone.
    await stopPromptQueue(sid)

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
