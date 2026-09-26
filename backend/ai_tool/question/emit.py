from __future__ import annotations

import logging
from typing import Any

from gateway.config import sio

logger = logging.getLogger(__name__)


async def sendStructuredQuestion(sid: str, questions: list[dict[str, Any]]) -> None:
    """Emit a questionnaire event to the CLI with structured questions."""
    await sio.emit("questionnaire", questions, to=sid)
