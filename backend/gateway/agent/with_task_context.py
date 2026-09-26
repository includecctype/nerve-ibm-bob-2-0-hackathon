from __future__ import annotations

from ai_tool.task.prompt_format import buildGraphOverview
from gateway.config import connected_users
from gateway.prompt.task_context import TASK_CONTEXT_SUFFIX


def withTaskContext(sid: str, system_prompt: str) -> str:
    """Append the live task-graph snapshot to the system prompt for a sid."""
    mem = connected_users.get(sid)
    if mem is None:
        return system_prompt
    task_context = buildGraphOverview(
        mem.pending_categories,
        mem.running_categories,
        mem.completed_categories,
    )
    return system_prompt + TASK_CONTEXT_SUFFIX.format(task_context=task_context)
