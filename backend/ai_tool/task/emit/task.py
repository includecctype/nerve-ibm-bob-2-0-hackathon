from __future__ import annotations

import asyncio

from ai_tool.task.task_models import TERMINAL_STATUSES, TaskCategory


def categoryToWire(cat: TaskCategory) -> dict:
    return {
        "name": cat.name,
        "status": cat.status,
        "depends_on": cat.depends_on,
        "tasks": [
            {"description": t.description, "status": t.status, "result": t.result}
            for t in cat.tasks
        ],
    }


def sessionCategoriesToWire(
    pending: list[TaskCategory],
    running: list[TaskCategory],
    completed: list[TaskCategory],
) -> list[dict]:
    ordered = running + pending + [c for c in completed if c.status in TERMINAL_STATUSES]
    return [categoryToWire(c) for c in ordered]


def updateTaskDisplay(sid: str, connected_users: dict) -> None:
    user = connected_users.get(sid)
    if user is None:
        return
    from gateway.config import sio

    payload = {
        "categories": sessionCategoriesToWire(
            user.pending_categories,
            user.running_categories,
            user.completed_categories,
        )
    }
    asyncio.create_task(sio.emit("task_update", payload, to=sid))
