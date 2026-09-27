from __future__ import annotations

import asyncio
import logging

from gateway.state.session_locks import execSidLock

logger = logging.getLogger(__name__)

_exec_tasks: dict[str, asyncio.Task[None]] = {}
_planning_counts: dict[str, int] = {}
_planning_idle: dict[str, asyncio.Event] = {}


def _idleEvent(sid: str) -> asyncio.Event:
    event = _planning_idle.get(sid)
    if event is None:
        event = asyncio.Event()
        event.set()
        _planning_idle[sid] = event
    return event


def beginPlanning(sid: str) -> None:
    """Mark that a prompt turn is in flight; it may still morph the pending graph."""
    count = _planning_counts.get(sid, 0) + 1
    _planning_counts[sid] = count
    _idleEvent(sid).clear()


def endPlanning(sid: str) -> None:
    """Mark that a prompt turn finished planning."""
    count = _planning_counts.get(sid, 0) - 1
    if count <= 0:
        _planning_counts.pop(sid, None)
        _idleEvent(sid).set()
    else:
        _planning_counts[sid] = count


async def waitPlanningIdle(sid: str) -> None:
    """Wait until no prompt turn is being planned for the session."""
    await _idleEvent(sid).wait()


def isExecutionRunning(sid: str) -> bool:
    task = _exec_tasks.get(sid)
    return task is not None and not task.done()


def startExecution(sid: str) -> bool:
    """Start a background execution pass for a session, if none is running."""
    if isExecutionRunning(sid):
        return False
    _exec_tasks[sid] = asyncio.create_task(_runExecution(sid), name=f"exec:{sid}")
    return True


async def stopExecution(sid: str) -> None:
    """Cancel the session's execution pass and clear its planning gate."""
    task = _exec_tasks.pop(sid, None)
    if task is not None and not task.done():
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    _planning_counts.pop(sid, None)
    _idleEvent(sid).set()
    _planning_idle.pop(sid, None)


async def _runExecution(sid: str) -> None:
    """Drain the pending graph in the background, then deliver the results.

    Loops until there is nothing running, nothing pending, and no prompt turn is
    still planning (so work morphed in by a later prompt is never stranded). The
    next prompt can be planned immediately: it only mutates the pending graph,
    which this loop re-reads, so it joins the running pass.
    """
    from ai_tool.task.execution_results import buildExecutionResults
    from ai_tool.task.task_graph import buildStatusMap, readyCategories
    from ai_tool.task.task_runner import runTaskGraph
    from ai_tool.tool_registry import createSubAgentWithTools
    from gateway.config import connected_users
    from gateway.prompt.execution_results import EXECUTION_RESULTS_SYSTEM
    from gateway.retry.rate_limit import callWithRateLimitRetry
    from gateway.state.prompt_queue import PROMPT_KIND_RESULTS, enqueuePrompt
    from systemconfig.limits import SUBAGENT_TIMEOUT_SECONDS

    lock = execSidLock(sid)
    await lock.acquire()
    totals: dict[str, list[str]] = {"done": [], "failed": [], "blocked": []}
    message: str | None = None
    try:
        while True:
            user = connected_users.get(sid)
            if user is None:
                return

            stats = await runTaskGraph(
                sid=sid,
                connected_users=connected_users,
                create_sub_agent_fn=createSubAgentWithTools,
                call_with_retry_fn=callWithRateLimitRetry,
                subagent_timeout=SUBAGENT_TIMEOUT_SECONDS,
            )
            for key, names in totals.items():
                names.extend(stats[key])

            # Give any in-flight planner a chance to morph before deciding to exit.
            await waitPlanningIdle(sid)
            user = connected_users.get(sid)
            if user is None:
                return
            status_map = buildStatusMap(
                user.pending_categories, user.running_categories, user.completed_categories
            )
            if readyCategories(user.pending_categories, status_map):
                continue
            break

        user = connected_users.get(sid)
        if user is not None:
            message = buildExecutionResults(totals, user)
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("[exec] pass failed sid=%s", sid)
    finally:
        lock.release()
        _exec_tasks.pop(sid, None)

    if message and sid in connected_users:
        enqueuePrompt(sid, EXECUTION_RESULTS_SYSTEM, message, PROMPT_KIND_RESULTS)
