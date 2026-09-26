from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

SESSION_MARKER_NAME = ".session"


def makeSessionFolder(today: date | None = None) -> str:
    """Return a fresh per-visit folder key, e.g. "2026-09-27:<uuid>"."""
    day = (today or datetime.now(UTC).date()).isoformat()
    return f"{day}:{uuid.uuid4()}"


def markerKey(folder: str) -> str:
    return f"{folder}/{SESSION_MARKER_NAME}"
