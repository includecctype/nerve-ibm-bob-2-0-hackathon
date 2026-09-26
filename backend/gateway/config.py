from __future__ import annotations

from typing import Any

import socketio
from pydantic import BaseModel, Field

sio = socketio.AsyncServer(async_mode="asgi")
app = socketio.ASGIApp(sio)


class AgentBinding(BaseModel):
    agent_id: int
    session: Any = None


class ConnectedUserMemory(BaseModel):
    api_key: str
    main_agent: AgentBinding
    pending_categories: list[Any] = Field(default_factory=list)
    running_categories: list[Any] = Field(default_factory=list)
    completed_categories: list[Any] = Field(default_factory=list)
    history: list[dict] = Field(default_factory=list)
    last_user_request: str = ""


connected_users: dict[str, ConnectedUserMemory] = {}
