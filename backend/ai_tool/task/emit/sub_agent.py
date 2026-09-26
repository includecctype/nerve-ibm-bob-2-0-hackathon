from __future__ import annotations

from typing import Literal

from gateway.config import sio


async def subAgentResponse(
    sid: str, category: str, status: Literal["done", "failed"], report: str
) -> None:
    """Display-only sub-agent progress line. Never forwarded to the main agent."""
    await sio.emit(
        "subagent_response",
        {"category": category, "status": status, "report": report},
        to=sid,
    )
