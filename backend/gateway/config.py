from __future__ import annotations

import os
from typing import Any

import socketio
from pydantic import BaseModel, Field


def allowedOrigins() -> str | list[str]:
    """Return the browser origins allowed to open the Socket.IO connection.

    The CLI sends no Origin header, so this only affects browser clients.
    Defaults to "*" so the web client works from any host; set
    WEB_ALLOWED_ORIGINS (comma-separated) to lock it down to known origins.
    """
    raw = os.getenv("WEB_ALLOWED_ORIGINS", "").strip()
    if not raw or raw == "*":
        return "*"
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=allowedOrigins())
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
    client_kind: str = "cli"
    storage_folder: str | None = None


connected_users: dict[str, ConnectedUserMemory] = {}
