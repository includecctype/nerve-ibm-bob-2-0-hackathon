from __future__ import annotations

import logging
import re
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta

from storage.oci import object_ops

logger = logging.getLogger(__name__)

# Web sessions live in "YYYY-MM-DD:<uuid>" folders; anything else is left alone.
SESSION_FOLDER_PREFIX = re.compile(r"^(\d{4}-\d{2}-\d{2}):")

SESSION_MAX_AGE_HOURS = 6
LIST_PAGE_LIMIT = 500
LIST_MAX_PAGES = 200


def parseSessionDate(folder: str) -> date | None:
    """Return the date encoded in a session folder name, or None when it is not one."""
    match = SESSION_FOLDER_PREFIX.match(folder)
    if match is None:
        return None
    try:
        return date.fromisoformat(match.group(1))
    except ValueError:
        return None


def parseTimestamp(value: str) -> datetime | None:
    """Parse an OCI timestamp; naive values are treated as UTC."""
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


def listSessionFolders() -> dict[str, list[object_ops.ObjectEntry]]:
    """Group every object in the bucket by its top-level folder key."""
    folders: dict[str, list[object_ops.ObjectEntry]] = defaultdict(list)
    start: str | None = None
    for _ in range(LIST_MAX_PAGES):
        page = object_ops.listObjects(prefix="", limit=LIST_PAGE_LIMIT, start=start)
        for entry in page.objects:
            folder, separator, _ = entry.name.partition("/")
            if separator:
                folders[folder].append(entry)
        start = page.next_start_with
        if not start:
            break
    return folders


def folderCreatedAt(entries: list[object_ops.ObjectEntry]) -> datetime | None:
    """Earliest object timestamp in a folder — the marker makes this the visit time."""
    timestamps = [
        stamp for stamp in (parseTimestamp(entry.updated_at) for entry in entries) if stamp
    ]
    return min(timestamps) if timestamps else None


def deleteFolder(entries: list[object_ops.ObjectEntry]) -> None:
    for entry in entries:
        object_ops.deleteObject(entry.name)


def cleanupExpiredSessions(now: datetime | None = None) -> list[str]:
    """Delete session folders older than SESSION_MAX_AGE_HOURS and return their names."""
    reference = now or datetime.now(UTC)
    cutoff = reference - timedelta(hours=SESSION_MAX_AGE_HOURS)

    expired: list[str] = []
    for folder, entries in listSessionFolders().items():
        # A folder that does not look like a session folder is never touched.
        if parseSessionDate(folder) is None:
            continue
        created = folderCreatedAt(entries)
        if created is None or created > cutoff:
            continue
        deleteFolder(entries)
        expired.append(folder)
        logger.info("removed expired session folder %s", folder)
    return expired


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    expired = cleanupExpiredSessions()
    logger.info("cleanup finished: %d expired session folder(s) removed", len(expired))


if __name__ == "__main__":
    main()
