from __future__ import annotations

from ai_tool.task.task_models import TaskCategory, TaskItem

TERMINAL_STATUSES = ("done", "failed", "blocked")


def parseTaskItems(raw: list) -> list[TaskItem]:
    """Convert a raw list of task dicts (or strings) into TaskItem objects."""
    items: list[TaskItem] = []
    for entry in raw:
        if isinstance(entry, dict):
            items.append(
                TaskItem(
                    description=str(entry.get("description", "")),
                    status=entry.get("status", "pending"),
                    result=str(entry.get("result", "")),
                )
            )
        elif isinstance(entry, str):
            items.append(TaskItem(description=entry))
    return items


def normalizeCategories(raw_categories: list[dict]) -> list[TaskCategory]:
    """Parse wire category dicts into TaskCategory objects."""
    categories: list[TaskCategory] = []
    for cat in raw_categories:
        if not isinstance(cat, dict):
            continue
        categories.append(
            TaskCategory(
                name=str(cat.get("name", "")),
                tasks=parseTaskItems(cat.get("tasks", [])),
                depends_on=[str(d) for d in cat.get("depends_on", [])],
                status=cat.get("status", "pending"),
            )
        )
    return categories


def splitCategories(
    categories: list[TaskCategory],
) -> tuple[list[TaskCategory], list[TaskCategory]]:
    """Split categories into (pending/running, completed). Running is downgraded to pending."""
    active: list[TaskCategory] = []
    completed: list[TaskCategory] = []
    for cat in categories:
        if cat.status in TERMINAL_STATUSES:
            completed.append(cat)
        else:
            # Downgrade running → pending (nothing actually runs after reconnect)
            if cat.status == "running":
                cat.status = "pending"
                for task in cat.tasks:
                    if task.status == "running":
                        task.status = "pending"
            active.append(cat)
    return active, completed
