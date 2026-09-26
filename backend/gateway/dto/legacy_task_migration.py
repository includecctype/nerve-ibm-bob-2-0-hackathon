from __future__ import annotations

from ai_tool.task.emit.planning_placeholder import isPlaceholderDescription
from ai_tool.task.task_graph import makeCategory
from ai_tool.task.task_models import TaskCategory

LEGACY_CATEGORY_NAME = "tasks"


def normalizeLegacyTasks(
    pending_task: list | None,
    running_task: list | None,
) -> list[TaskCategory]:
    """Collapse legacy flat task lists into a single 'tasks' category.

    Legacy running work is resumed before queued work, so running entries are
    collected first. Placeholder rows are dropped.

    Legacy pending shapes:  [{simultaneous: bool, description: str}, ...] or [[bool, str], ...]
    Legacy running shapes:  [{model_id: int, description: str}, ...] or [[int, str], ...]
    """
    descriptions: list[str] = []
    for raw in (running_task, pending_task):
        for entry in raw or []:
            description = _extract_description(entry)
            if description and not isPlaceholderDescription(description):
                descriptions.append(description)

    if not descriptions:
        return []
    return [makeCategory(LEGACY_CATEGORY_NAME, descriptions, [])]


def _extract_description(entry: object) -> str:
    if isinstance(entry, dict):
        return str(entry.get("description", "") or "")
    if isinstance(entry, (list, tuple)) and len(entry) >= 2:
        return str(entry[1])
    return ""
