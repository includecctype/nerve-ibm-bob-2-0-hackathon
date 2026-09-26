from __future__ import annotations

import json
import logging

from langchain_core.tools import tool

from ai_tool.task.emit.task import updateTaskDisplay
from ai_tool.task.merge_task_lists import mergeCategoryLists
from ai_tool.task.task_graph import (
    buildStatusMap,
    cascadeBlocked,
    makeCategory,
    repairGraph,
    validateCategoryInput,
    validateGraph,
)
from ai_tool.task.task_runner import runTaskGraph
from gateway.config import connected_users
from systemconfig.limits import SUBAGENT_TIMEOUT_SECONDS

logger = logging.getLogger(__name__)

# These are created per-session via makeTaskTools(sid)


def makeTaskTools(
    sid: str,
    create_sub_agent_fn,
    call_with_retry_fn,
    exec_lock_fn,
    release_prompt_fn,
    reacquire_prompt_fn,
):
    @tool
    async def processNewTask(categories: str) -> str:
        """
        Replace the pending task graph with the morphed graph for this turn.
        Input must be a JSON array of {name, tasks: [str], depends_on: [str]}.
        Never include running or finished categories.
        """

        user = connected_users.get(sid)
        if user is None:
            return "Error: session not found"

        try:
            raw = json.loads(categories) if isinstance(categories, str) else categories
        except json.JSONDecodeError as e:
            return f"Error: invalid JSON — {e}"

        validated = validateCategoryInput(raw)
        if not validated:
            return "Error: no valid categories in input"

        repaired, notes = repairGraph(validated, user.running_categories, user.pending_categories)
        is_valid, err = validateGraph(repaired, user.running_categories, user.completed_categories)
        if not is_valid:
            return f"Error: {err}"

        new_cats = [
            makeCategory(item["name"], item["tasks"], item.get("depends_on", []))
            for item in repaired
        ]

        user.pending_categories = mergeCategoryLists(user.pending_categories, new_cats)

        status_map = buildStatusMap(
            user.pending_categories,
            user.running_categories,
            user.completed_categories,
        )
        newly_blocked, user.pending_categories = cascadeBlocked(user.pending_categories, status_map)
        for cat in newly_blocked:
            user.completed_categories.append(cat)

        await updateTaskDisplay(sid, connected_users)

        msg = f"Task graph updated: {len(user.pending_categories)} pending categories."
        if notes:
            msg += " Notes: " + "; ".join(notes)
        return msg

    @tool
    async def executeCurrentTask() -> str:
        """
        Execute the pending task graph to completion.
        Runs ready categories in parallel; tasks sequential inside each category.
        Returns a summary of done/failed/blocked counts and result excerpts.
        """
        user = connected_users.get(sid)
        if user is None:
            return "Error: session not found"

        if not user.pending_categories and not user.running_categories:
            return "No tasks to execute."

        # One execution pass at a time per session: the main agent may issue this
        # tool as a parallel call, and two passes would race on the shared graph.
        exec_lock = exec_lock_fn(sid)
        if exec_lock.locked():
            return "Error: execution already in progress for this session."

        await exec_lock.acquire()
        released_prompt = False
        try:
            released_prompt = await release_prompt_fn(sid)
            summary = await runTaskGraph(
                sid=sid,
                connected_users=connected_users,
                create_sub_agent_fn=create_sub_agent_fn,
                call_with_retry_fn=call_with_retry_fn,
                subagent_timeout=SUBAGENT_TIMEOUT_SECONDS,
            )
        finally:
            exec_lock.release()
            if released_prompt:
                await reacquire_prompt_fn(sid)

        parts = [
            "Execution complete.",
            f"Done: {summary['done']}, Failed: {summary['failed']}, Blocked: {summary['blocked']}",
        ]
        if summary.get("excerpts"):
            parts.append("Excerpts:")
            parts.extend(summary["excerpts"])
        return "\n".join(parts)

    @tool
    async def checkRunningTasks() -> str:
        """
        Return the current status of running and pending categories.
        Use before queueing more work.
        """
        user = connected_users.get(sid)
        if user is None:
            return "Error: session not found"

        lines = []
        if user.running_categories:
            lines.append("Running categories:")
            for c in user.running_categories:
                lines.append(f"  [{c.status}] {c.name}")
                for t in c.tasks:
                    lines.append(f"      [{t.status}] {t.description}")
        if user.pending_categories:
            lines.append("Pending categories:")
            for c in user.pending_categories:
                deps = f" (waits: {', '.join(c.depends_on)})" if c.depends_on else ""
                lines.append(f"  {c.name}{deps}")

        return "\n".join(lines) if lines else "No running or pending categories."

    return processNewTask, executeCurrentTask, checkRunningTasks
