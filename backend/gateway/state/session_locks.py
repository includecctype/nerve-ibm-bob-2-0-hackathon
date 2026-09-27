from __future__ import annotations

import asyncio
import logging

from gateway.state.runtime_state import exec_locks, sid_locks

logger = logging.getLogger(__name__)


def _get_sid_lock(sid: str) -> asyncio.Lock:
    if sid not in sid_locks:
        sid_locks[sid] = asyncio.Lock()
    return sid_locks[sid]


def _get_exec_lock(sid: str) -> asyncio.Lock:
    if sid not in exec_locks:
        exec_locks[sid] = asyncio.Lock()
    return exec_locks[sid]


async def acquirePromptLock(sid: str) -> None:
    """Acquire the per-session prompt lock before invoking the main agent."""
    await _get_sid_lock(sid).acquire()


async def finishPromptLock(sid: str) -> None:
    """Release the prompt lock after the agent turn is complete."""
    lock = _get_sid_lock(sid)
    if lock.locked():
        lock.release()


def sidLock(sid: str) -> asyncio.Lock:
    """Return (and lazily create) the prompt lock for a sid."""
    return _get_sid_lock(sid)


def execSidLock(sid: str) -> asyncio.Lock:
    """Return (and lazily create) the execution lock for a sid."""
    return _get_exec_lock(sid)
