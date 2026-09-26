from __future__ import annotations

import asyncio
from typing import Literal

from gateway.config import sio


def subAgentResponse(
    sid: str, category: str, status: Literal["done", "failed"], report: str
) -> None:
    """Display-only sub-agent progress line. Never forwarded to the main agent."""
    asyncio.create_task(
        sio.emit(
            "subagent_response",
            {"category": category, "status": status, "report": report},
            to=sid,
        )
    )
