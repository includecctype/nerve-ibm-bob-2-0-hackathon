from __future__ import annotations

from ai_tool.task.emit.planning_placeholder import isPlaceholderDescription
from ai_tool.task.task_models import TERMINAL_STATUSES, TaskCategory, TaskItem

TASK_STATUSES = ("pending", "running", "done", "failed")
CATEGORY_STATUSES = ("pending", "running", "done", "failed", "blocked")


def parseTaskItems(raw: list) -> list[TaskItem]:
    """Convert raw task dicts (or strings) into TaskItem objects.

    Empty and transient placeholder descriptions are dropped, and an unknown
    status is coerced to pending so a malformed payload cannot raise.
    """
    items: list[TaskItem] = []
    for entry in raw or []:
        if isinstance(entry, dict):
            description = str(entry.get("description", "") or "")
            status = str(entry.get("status", "pending") or "pending")
            result = str(entry.get("result", "") or "")
        elif isinstance(entry, str):
            description = entry
            status = "pending"
            result = ""
        else:
            continue
        if not description or isPlaceholderDescription(description):
            continue
        if status not in TASK_STATUSES:
            status = "pending"
        items.append(TaskItem(description=description, status=status, result=result))
    return items


def normalizeCategories(raw_categories: list[dict]) -> list[TaskCategory]:
    """Parse wire category dicts into TaskCategory objects.

    Skips nameless or taskless categories (the transient planning placeholder is
    filtered out by parseTaskItems) and coerces an unknown status to pending.
    """
    categories: list[TaskCategory] = []
    for cat in raw_categories or []:
        if not isinstance(cat, dict):
            continue
        name = str(cat.get("name", "") or "").strip()
        if not name:
            continue
        tasks = parseTaskItems(cat.get("tasks", []))
        if not tasks:
            continue
        status = str(cat.get("status", "pending") or "pending")
        if status not in CATEGORY_STATUSES:
            status = "pending"
        # Interrupted work resumes: nothing is actually running after a reconnect.
        if status == "running":
            status = "pending"
        depends_on = [str(dep).strip() for dep in (cat.get("depends_on") or []) if str(dep).strip()]
        category = TaskCategory(
            name=name,
            tasks=tasks,
            depends_on=depends_on,
            status=status,  # type: ignore[arg-type]
        )
        for task in category.tasks:
            if task.status == "running":
                task.status = "pending"
        categories.append(category)
    return categories


def splitCategories(
    categories: list[TaskCategory],
) -> tuple[list[TaskCategory], list[TaskCategory]]:
    """Partition restored categories: terminal ones become finished, the rest stay pending."""
    pending = [category for category in categories if category.status not in TERMINAL_STATUSES]
    completed = [category for category in categories if category.status in TERMINAL_STATUSES]
    return pending, completed
