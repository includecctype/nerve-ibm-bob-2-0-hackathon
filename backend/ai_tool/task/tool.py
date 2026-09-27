from __future__ import annotations

import logging

from langchain_core.tools import tool

from ai_tool.task.emit.task import updateTaskDisplay
from ai_tool.task.merge_task_lists import mergeCategoryLists
from ai_tool.task.task_graph import (
    buildStatusMap,
    cascadeBlocked,
    makeCategory,
    normalizeName,
    repairGraph,
    validateCategoryInput,
    validateGraph,
)
from gateway.config import connected_users

logger = logging.getLogger(__name__)

# These are created per-session via makeTaskTools(sid)


def makeTaskTools(sid: str):
    @tool
    async def processNewTask(categories: list[dict]) -> str:
        """
        Replace the pending task graph with the morphed graph for this turn.

        `categories` is the complete pending list of {name, tasks, depends_on}
        objects. Never include running or finished categories.
        """

        user = connected_users.get(sid)
        if user is None:
            return "Error: session not found"

        validated, error = validateCategoryInput(categories)
        if error:
            return error
        if not validated:
            return "Error: no valid categories in input"

        repaired, notes = repairGraph(validated, user.running_categories, user.completed_categories)
        is_valid, err = validateGraph(repaired, user.running_categories, user.completed_categories)
        if not is_valid:
            return f"Error: {err}"

        # A re-added category is being morphed, so drop its stale completed copy:
        # otherwise it would live in both pending and completed and be counted twice.
        incoming_names = {normalizeName(item["name"]) for item in repaired}
        completed = [
            category
            for category in user.completed_categories
            if normalizeName(category.name) not in incoming_names
        ]

        new_cats = [
            makeCategory(item["name"], item["tasks"], item.get("depends_on", []))
            for item in repaired
        ]
        pending = mergeCategoryLists(user.pending_categories, new_cats)

        status_map = buildStatusMap(pending, user.running_categories, completed)
        newly_blocked, pending = cascadeBlocked(pending, status_map)

        user.completed_categories = completed + newly_blocked
        user.pending_categories = pending

        await updateTaskDisplay(sid, connected_users)

        msg = f"Task graph updated: {len(user.pending_categories)} pending categories."
        if notes:
            msg += " Notes: " + "; ".join(notes)
        return msg

    @tool
    async def executeCurrentTask() -> str:
        """
        Start (or join) background execution of the pending task graph.
        Returns immediately; ready categories run in parallel, tasks sequential
        inside each category, and results arrive later as a new message.
        """
        user = connected_users.get(sid)
        if user is None:
            return "Error: session not found"

        from gateway.state.exec_scheduler import isExecutionRunning, startExecution

        # A running pass owns the graph; new categories from processNewTask join it.
        if isExecutionRunning(sid):
            return "Execution already in progress; new categories join the running pass."

        if not user.pending_categories and not user.running_categories:
            return "No tasks to execute."

        startExecution(sid)
        return (
            "Execution started in the background. Do not poll; the pass results "
            "will be delivered to you as a new message to summarize."
        )

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
