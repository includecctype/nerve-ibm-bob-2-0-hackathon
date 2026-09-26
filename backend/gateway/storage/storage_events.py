from __future__ import annotations

from gateway.config import connected_users, sio


def storageFolder(sid: str) -> str | None:
    """Return the OCI session folder bound to a socket, or None for CLI clients."""
    mem = connected_users.get(sid)
    return mem.storage_folder if mem is not None else None


async def emitStorageChange(sid: str, op: str, path: str) -> None:
    await sio.emit("storage_change", {"op": op, "path": path}, to=sid)


async def emitStorageError(sid: str, request_id: str, message: str) -> None:
    await sio.emit("storage_error", {"request_id": request_id, "message": message}, to=sid)
