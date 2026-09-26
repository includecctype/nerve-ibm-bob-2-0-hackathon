from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime

from storage.oci import object_ops
from storage.oci.session_folder import SESSION_MARKER_NAME, markerKey
from storage.service import storage_limits


@dataclass
class TreeNode:
    name: str
    path: str
    kind: str
    size: int = 0
    updated_at: str = ""


def normalizePath(path: str) -> str:
    """Return a safe path relative to the session folder.

    Leading slashes and "." segments are dropped; any ".." segment is rejected
    so a caller can never escape the session folder.
    """
    cleaned = (path or "").strip().replace("\\", "/").lstrip("/")
    parts = [part for part in cleaned.split("/") if part not in ("", ".")]
    if any(part == ".." for part in parts):
        raise ValueError("path escapes the session folder")
    return "/".join(parts)


def listPrefix(folder: str, path: str = "") -> str:
    relative = normalizePath(path)
    return f"{folder}/{relative}/" if relative else f"{folder}/"


def fileKey(folder: str, path: str) -> str:
    relative = normalizePath(path)
    if not relative:
        raise ValueError("a file path is required")
    return f"{folder}/{relative}"


def ensureSession(folder: str, model_id: int = 0) -> None:
    """Write the marker object that materialises the session folder."""
    marker = {
        "created_at": datetime.now(UTC).isoformat(),
        "model_id": model_id,
    }
    object_ops.putText(markerKey(folder), json.dumps(marker))


def listTree(folder: str, path: str = "") -> list[TreeNode]:
    """List one directory level, folders first, with paths relative to the folder."""
    prefix = listPrefix(folder, path)
    relative_dir = normalizePath(path)
    prefixes: list[str] = []
    objects: list[object_ops.ObjectEntry] = []
    start: str | None = None
    for _ in range(storage_limits.LIST_MAX_PAGES):
        page = object_ops.listObjects(
            prefix=prefix,
            delimiter="/",
            limit=storage_limits.LIST_PAGE_LIMIT,
            start=start,
        )
        prefixes.extend(page.prefixes)
        objects.extend(page.objects)
        start = page.next_start_with
        if not start:
            break

    nodes: list[TreeNode] = []
    for full_prefix in prefixes:
        name = full_prefix[len(prefix) :].rstrip("/")
        if not name:
            continue
        nodes.append(
            TreeNode(
                name=name,
                path=f"{relative_dir}/{name}" if relative_dir else name,
                kind="folder",
            )
        )
    for obj in objects:
        name = obj.name[len(prefix) :]
        if not name or name.endswith("/") or name == SESSION_MARKER_NAME:
            continue
        nodes.append(
            TreeNode(
                name=name,
                path=f"{relative_dir}/{name}" if relative_dir else name,
                kind="file",
                size=obj.size,
                updated_at=obj.updated_at,
            )
        )
    nodes.sort(key=lambda node: (node.kind != "folder", node.name.lower()))
    return nodes


def readText(
    folder: str,
    path: str,
    offset: int = 1,
    limit: int = storage_limits.DEFAULT_READ_LIMIT,
) -> str:
    raw = object_ops.getBytes(fileKey(folder, path))
    truncated = len(raw) > storage_limits.MAX_READ_BYTES
    if truncated:
        raw = raw[: storage_limits.MAX_READ_BYTES]
    text = raw.decode("utf-8", errors="replace")
    if not text:
        return "(empty file)"

    lines = text.split("\n")
    start = max(0, offset - 1)
    selected = lines[start : start + limit]
    numbered = [f"{start + index + 1}: {line}" for index, line in enumerate(selected)]

    notes: list[str] = []
    if truncated:
        notes.append(f"… truncated at {storage_limits.MAX_READ_BYTES} bytes")
    if start + limit < len(lines):
        notes.append(f"… {len(lines) - (start + limit)} more lines")
    if notes:
        numbered.extend(["", *notes])
    return "\n".join(numbered)


def writeText(folder: str, path: str, content: str, mode: str = "overwrite") -> None:
    key = fileKey(folder, path)
    if mode == "append" and object_ops.objectExists(key):
        content = object_ops.getText(key) + content
    object_ops.putText(key, content)


def fileExists(folder: str, path: str) -> bool:
    return object_ops.objectExists(fileKey(folder, path))


def deletePath(folder: str, path: str) -> int:
    """Delete a single object, or every object under a directory prefix."""
    relative = normalizePath(path)
    if not relative:
        raise ValueError("refusing to delete the session root")

    key = f"{folder}/{relative}"
    if object_ops.objectExists(key):
        object_ops.deleteObject(key)
        return 1

    prefix = f"{folder}/{relative}/"
    keys: list[str] = []
    start: str | None = None
    for _ in range(storage_limits.LIST_MAX_PAGES):
        page = object_ops.listObjects(
            prefix=prefix,
            limit=storage_limits.LIST_PAGE_LIMIT,
            start=start,
        )
        keys.extend(obj.name for obj in page.objects)
        start = page.next_start_with
        if not start:
            break
    for object_key in keys:
        object_ops.deleteObject(object_key)
    return len(keys)
