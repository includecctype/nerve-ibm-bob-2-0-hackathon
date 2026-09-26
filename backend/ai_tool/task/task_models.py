from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

TaskStatus = Literal["pending", "running", "done", "failed", "blocked"]

TERMINAL_STATUSES = ("done", "failed", "blocked")


class TaskItem(BaseModel):
    description: str
    status: TaskStatus = "pending"
    result: str = ""


class TaskCategory(BaseModel):
    name: str
    tasks: list[TaskItem] = Field(default_factory=list)
    depends_on: list[str] = Field(default_factory=list)
    status: TaskStatus = "pending"
