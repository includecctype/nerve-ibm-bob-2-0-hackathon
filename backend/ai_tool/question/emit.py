from __future__ import annotations

import asyncio
import logging
from typing import Any

from gateway.config import sio

logger = logging.getLogger(__name__)


def sendStructuredQuestion(sid: str, questions: list[dict[str, Any]]) -> None:
    """Emit a questionnaire event to the CLI with structured questions."""

    async def _emit():
        await sio.emit("questionnaire", questions, to=sid)

    loop = asyncio.get_event_loop()
    if loop.is_running():
        asyncio.ensure_future(_emit())
    else:
        loop.run_until_complete(_emit())
