from __future__ import annotations

from ai_tool.task.task_models import TERMINAL_STATUSES, TaskCategory

PLANNING_DESCRIPTION = "Planning your request…"


def isPlaceholderDescription(description: str) -> bool:
    return description == PLANNING_DESCRIPTION


async def emitPlanningPlaceholder(sid: str, real_categories: list[TaskCategory]) -> None:
    from gateway.config import sio

    placeholder = {
        "name": "planning",
        "status": "running",
        "depends_on": [],
        "tasks": [{"description": PLANNING_DESCRIPTION, "status": "running", "result": ""}],
    }

    wire_cats = _sessionCategoriesToWire(real_categories)
    payload = {"categories": [placeholder] + wire_cats}

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
