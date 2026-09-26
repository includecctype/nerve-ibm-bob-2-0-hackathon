from __future__ import annotations

from ai_tool.task.task_models import TERMINAL_STATUSES, TaskCategory

PLANNING_CATEGORY_NAME = "planning"
PLANNING_DESCRIPTION = "Planning your request…"


def isPlaceholderDescription(description: str) -> bool:
    normalized = " ".join(description.strip().lower().split())
    expected = " ".join(PLANNING_DESCRIPTION.strip().lower().split())
    return normalized == expected


async def emitPlanningPlaceholder(sid: str, real_categories: list[TaskCategory]) -> None:
    from gateway.config import sio

    placeholder = {
        "name": PLANNING_CATEGORY_NAME,
        "status": "pending",
        "depends_on": [],
        "tasks": [{"description": PLANNING_DESCRIPTION, "status": "pending", "result": ""}],
    }

    # The real graph is listed first; the transient placeholder trails it.
    wire_cats = _sessionCategoriesToWire(real_categories)
    payload = {"categories": wire_cats + [placeholder]}

    await sio.emit("task_update", payload, to=sid)


def _sessionCategoriesToWire(categories: list[TaskCategory]) -> list[dict]:
    running = [c for c in categories if c.status == "running"]
    pending = [c for c in categories if c.status == "pending"]
    completed = [c for c in categories if c.status in TERMINAL_STATUSES]
    ordered = running + pending + completed
    return [_categoryToWire(c) for c in ordered]


def _categoryToWire(cat: TaskCategory) -> dict:
    return {
        "name": cat.name,
        "status": cat.status,
        "depends_on": cat.depends_on,
        "tasks": [
            {"description": t.description, "status": t.status, "result": t.result}
            for t in cat.tasks
        ],
    }
