from __future__ import annotations

from ai_tool.task.prompt_format import (
    formatFinishedForPrompt,
    formatPendingForPrompt,
    formatRunningForPrompt,
)
from gateway.config import connected_users
from gateway.prompt.task_context import TASK_CONTEXT_SUFFIX


def withTaskContext(sid: str, system_prompt: str) -> str:
    """Append the live task-graph snapshot to the system prompt for a sid."""
    mem = connected_users.get(sid)
    if mem is None:
        return system_prompt
    return system_prompt + TASK_CONTEXT_SUFFIX.format(
        running=formatRunningForPrompt(mem.running_categories),
        pending=formatPendingForPrompt(mem.pending_categories),
        finished=formatFinishedForPrompt(mem.completed_categories),
    )
