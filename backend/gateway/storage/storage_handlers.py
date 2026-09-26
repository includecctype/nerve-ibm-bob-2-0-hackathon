from __future__ import annotations

import asyncio
import logging

from gateway.config import sio
from gateway.storage.storage_events import (
    emitStorageChange,
    emitStorageError,
    storageFolder,
)
from storage.service import storage_service

logger = logging.getLogger(__name__)


def requestFields(data: dict | None) -> tuple[str, str]:
    payload = data or {}
    return str(payload.get("request_id", "")), str(payload.get("path", ""))


@sio.on("storage_list")
async def onStorageList(sid: str, data: dict | None = None) -> None:
    request_id, path = requestFields(data)
    folder = storageFolder(sid)
    if folder is None:
        await emitStorageError(sid, request_id, "this session has no storage folder")
        return
    try:
        nodes = await asyncio.to_thread(storage_service.listTree, folder, path)
    except Exception as exc:
        logger.exception("[storage] list failed sid=%s path=%s", sid, path)
        await emitStorageError(sid, request_id, str(exc))
        return
    entries = [
        {
            "name": node.name,
            "path": node.path,
            "kind": node.kind,
            "size": node.size,
            "updated_at": node.updated_at,
        }
        for node in nodes
    ]
    await sio.emit(
        "storage_listing",
        {"request_id": request_id, "path": path, "entries": entries},
        to=sid,
    )


@sio.on("storage_read")
async def onStorageRead(sid: str, data: dict | None = None) -> None:
    request_id, path = requestFields(data)
    folder = storageFolder(sid)
    if folder is None:
        await emitStorageError(sid, request_id, "this session has no storage folder")
        return
    try:
        content, truncated = await asyncio.to_thread(storage_service.readRaw, folder, path)
    except Exception as exc:
        logger.exception("[storage] read failed sid=%s path=%s", sid, path)
        await emitStorageError(sid, request_id, str(exc))
        return
    await sio.emit(
        "storage_content",
        {
            "request_id": request_id,
            "path": path,
            "content": content,
            "truncated": truncated,
        },
        to=sid,
    )


@sio.on("storage_write")
async def onStorageWrite(sid: str, data: dict | None = None) -> None:
    payload = data or {}
    request_id = str(payload.get("request_id", ""))
    path = str(payload.get("path", ""))
    content = str(payload.get("content", ""))
    folder = storageFolder(sid)
    if folder is None:
        await emitStorageError(sid, request_id, "this session has no storage folder")
        return
    try:
        await asyncio.to_thread(storage_service.writeText, folder, path, content, "overwrite")
    except Exception as exc:
        logger.exception("[storage] write failed sid=%s path=%s", sid, path)
        await emitStorageError(sid, request_id, str(exc))
        return
    await sio.emit("storage_result", {"request_id": request_id, "ok": True, "path": path}, to=sid)
    await emitStorageChange(sid, "write", path)


@sio.on("storage_delete")
async def onStorageDelete(sid: str, data: dict | None = None) -> None:
    request_id, path = requestFields(data)
    folder = storageFolder(sid)
    if folder is None:
        await emitStorageError(sid, request_id, "this session has no storage folder")
        return
    try:
        deleted = await asyncio.to_thread(storage_service.deletePath, folder, path)
    except Exception as exc:
        logger.exception("[storage] delete failed sid=%s path=%s", sid, path)
        await emitStorageError(sid, request_id, str(exc))
        return
    await sio.emit(
        "storage_result",
        {"request_id": request_id, "ok": True, "path": path, "deleted": deleted},
        to=sid,
    )
    await emitStorageChange(sid, "delete", path)
