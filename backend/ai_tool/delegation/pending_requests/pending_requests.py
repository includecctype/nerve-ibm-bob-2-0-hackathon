from __future__ import annotations

import asyncio
import logging
import uuid

from gateway.config import sio
from systemconfig.limits import TOOL_TIMEOUT_SECONDS

logger = logging.getLogger(__name__)

# keyed by (sid, request_id) → asyncio.Future
_pending: dict[tuple[str, str], asyncio.Future] = {}


def requestTool(
    sid: str,
    tool: str,
    args: dict,
    timeout: int = TOOL_TIMEOUT_SECONDS,
) -> asyncio.Future:
    """
    Emit a tool_request to the CLI, return a future that resolves when tool_result arrives.
    Times out after `timeout` seconds and resolves with an error string.
    """
    request_id = str(uuid.uuid4())
    loop = asyncio.get_event_loop()
    future: asyncio.Future = loop.create_future()
    _pending[(sid, request_id)] = future

    async def _emit_and_await():
        await sio.emit("tool_request", {"id": request_id, "tool": tool, "args": args}, to=sid)
        try:
            return await asyncio.wait_for(asyncio.shield(future), timeout=timeout)
        except TimeoutError:
            _pending.pop((sid, request_id), None)
            if not future.done():
                future.set_result(f"Error: tool '{tool}' timed out after {timeout}s")
            return future.result()

    return asyncio.ensure_future(_emit_and_await())


async def resolveToolResult(sid: str, request_id: str, ok: bool, output: str) -> None:
    future = _pending.pop((sid, request_id), None)
    if future is None or future.done():
        return
    if ok:
        future.set_result(output)
    else:
        future.set_result(f"Error: {output}")


async def cancelPendingRequests(sid: str) -> None:
    keys_to_cancel = [k for k in _pending if k[0] == sid]
    for key in keys_to_cancel:
        future = _pending.pop(key, None)
        if future and not future.done():
            future.set_result("Error: client disconnected")
