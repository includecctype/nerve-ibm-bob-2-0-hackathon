from __future__ import annotations

import asyncio
import logging

from ai_tool.task.emit.sub_agent import subAgentResponse
from ai_tool.task.emit.task import updateTaskDisplay
from ai_tool.task.prompt_format import buildGraphOverview, buildTaskPrompt
from ai_tool.task.task_graph import (
    buildStatusMap,
    cascadeBlocked,
    readyCategories,
    truncateResult,
)
from ai_tool.task.task_models import TaskCategory
from model.agent_session import lastTextFromResult

logger = logging.getLogger(__name__)


async def runCategory(
    category: TaskCategory,
    sid: str,
    connected_users: dict,
    create_sub_agent_fn,
    call_with_retry_fn,
    subagent_timeout: int,
) -> None:
    """
    Run all tasks in a category sequentially.
    Each task gets a fresh sub-agent.
    On failure, remaining tasks and the category are marked failed.
    """
    user = connected_users.get(sid)
    if user is None:
        return

    for index, item in enumerate(category.tasks):
        item.status = "running"
        updateTaskDisplay(sid, connected_users)

        sub_agent = create_sub_agent_fn(
            agent_id=user.main_agent.agent_id,
            api_key=user.api_key,
            sid=sid,
        )

        graph_overview = buildGraphOverview(
            user.pending_categories,
            user.running_categories,
            user.completed_categories,
        )
        prompt = buildTaskPrompt(
            category=category,
            task_index=index,
            completed=user.completed_categories,
            last_user_request=user.last_user_request,
            graph_overview=graph_overview,
        )

        try:
            result = await call_with_retry_fn(
                lambda agent=sub_agent, task=prompt: agent.ainvoke(task),
                timeout=subagent_timeout,
            )
            content = lastTextFromResult(result)
            item.result = content
            item.status = "done"
            updateTaskDisplay(sid, connected_users)
        except Exception as exc:  # noqa: BLE001
            logger.error("Task failed in category '%s': %s", category.name, exc)
            item.status = "failed"
            # Mark remaining tasks as failed
            for remaining in category.tasks[index + 1 :]:
                remaining.status = "failed"
            category.status = "failed"
            updateTaskDisplay(sid, connected_users)
            subAgentResponse(sid, category.name, "failed", str(exc))
            return

    category.status = "done"
    updateTaskDisplay(sid, connected_users)
    report = truncateResult(category.tasks[-1].result) if category.tasks else ""
    subAgentResponse(sid, category.name, "done", report)


async def runTaskGraph(
    sid: str,
    connected_users: dict,
    create_sub_agent_fn,
    call_with_retry_fn,
    subagent_timeout: int,
) -> dict:
    """
    Event-driven DAG scheduler.
    Loop: cascadeBlocked → readyCategories → create_task per ready → wait(FIRST_COMPLETED) → drain.
    Returns summary counts.
    """
    user = connected_users.get(sid)
    if user is None:
        return {"done": 0, "failed": 0, "blocked": 0}

    running_tasks: dict[asyncio.Task, TaskCategory] = {}

    while True:
        status_map = buildStatusMap(
            user.pending_categories,
            user.running_categories,
            user.completed_categories,
        )

        newly_blocked, user.pending_categories = cascadeBlocked(user.pending_categories, status_map)
        for cat in newly_blocked:
            user.completed_categories.append(cat)
        if newly_blocked:
            status_map = buildStatusMap(
                user.pending_categories,
                user.running_categories,
                user.completed_categories,
            )

        ready = readyCategories(user.pending_categories, status_map)

        for cat in ready:
            user.pending_categories.remove(cat)
            cat.status = "running"
            user.running_categories.append(cat)
            task = asyncio.create_task(
                runCategory(
                    cat,
                    sid,
                    connected_users,
                    create_sub_agent_fn,
                    call_with_retry_fn,
                    subagent_timeout,
                )
            )
            running_tasks[task] = cat

        updateTaskDisplay(sid, connected_users)

        if not running_tasks:
            # No running tasks — check if there is still pending work
            if not user.pending_categories:
                break
            # Pending exists but nothing ready (all blocked or waiting) — break
            ready_check = readyCategories(
                user.pending_categories,
                buildStatusMap(
                    user.pending_categories,
                    user.running_categories,
                    user.completed_categories,
                ),
            )
            if not ready_check:
                break
            continue

        done, _ = await asyncio.wait(running_tasks.keys(), return_when=asyncio.FIRST_COMPLETED)

        for finished_task in done:
            cat = running_tasks.pop(finished_task)
            if finished_task.exception():
                cat.status = "failed"
            user.running_categories.remove(cat)
            user.completed_categories.append(cat)

    # Count outcomes
    done_count = sum(1 for c in user.completed_categories if c.status == "done")
    failed_count = sum(1 for c in user.completed_categories if c.status == "failed")
    blocked_count = sum(1 for c in user.completed_categories if c.status == "blocked")

    excerpts = []
    for c in user.completed_categories:
        if c.status == "done" and c.tasks:
            excerpts.append(f"[{c.name}] {truncateResult(c.tasks[-1].result)}")

    return {
        "done": done_count,
        "failed": failed_count,
        "blocked": blocked_count,
        "excerpts": excerpts,
    }
