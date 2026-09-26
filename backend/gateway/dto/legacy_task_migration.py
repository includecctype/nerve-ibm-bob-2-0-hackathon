from __future__ import annotations

from ai_tool.task.task_models import TaskCategory, TaskItem


def normalizeLegacyTasks(
    pending_task: list | None,
    running_task: list | None,
) -> list[TaskCategory]:
    """
    Collapse legacy flat task lists into a single 'tasks' category.

    Legacy pending shapes:
      [{simultaneous: bool, description: str}, ...]
      [[bool, str], ...]

    Legacy running shapes:
      [{model_id: int, description: str}, ...]
      [[int, str], ...]
    """
    items: list[TaskItem] = []

    for entry in pending_task or []:
        desc = _extract_description(entry)
        if desc:
            items.append(TaskItem(description=desc))

    for entry in running_task or []:
        desc = _extract_description(entry)
        if desc:
            # Downgrade running → pending on restore
            items.append(TaskItem(description=desc))

    if not items:
        return []

    return [TaskCategory(name="tasks", tasks=items)]


def _extract_description(entry: object) -> str:
    if isinstance(entry, dict):
        return str(entry.get("description", ""))
    if isinstance(entry, (list, tuple)) and len(entry) >= 2:
        return str(entry[1])
    return ""
