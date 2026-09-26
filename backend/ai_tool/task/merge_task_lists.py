from __future__ import annotations

from ai_tool.task.task_graph import normalizeName
from ai_tool.task.task_models import TaskCategory


def mergeCategoryLists(old: list[TaskCategory], new: list[TaskCategory]) -> list[TaskCategory]:
    """
    The incoming (new) morphed list is authoritative.
    If new is non-empty, return it with exact-deduplication by name.
    If new is empty, keep the old list unchanged.
    """
    if not new:
        return old

    seen: set[str] = set()
    deduped: list[TaskCategory] = []
    for cat in new:
        key = normalizeName(cat.name)
        if key not in seen:
            seen.add(key)
            deduped.append(cat)

    return deduped
