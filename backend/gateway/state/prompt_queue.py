from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

PROMPT_KIND_USER = "user"
PROMPT_KIND_QUESTIONNAIRE = "questionnaire"
PROMPT_KIND_GIVE_UP = "give_up"


@dataclass(slots=True)
class PromptJob:
    """One queued main-agent turn: the turn instructions plus the user-facing message."""

    system_prompt: str
    message: str
    kind: str


_queues: dict[str, asyncio.Queue[PromptJob]] = {}
_workers: dict[str, asyncio.Task[None]] = {}


def _queueFor(sid: str) -> asyncio.Queue[PromptJob]:
    queue = _queues.get(sid)
    if queue is None:
        queue = asyncio.Queue()
        _queues[sid] = queue
    return queue


async def _runPromptWorker(sid: str) -> None:
    """Drain the session's prompt queue one turn at a time.

    Strict single-flight: the next prompt only starts once the previous turn —
    including its task-graph execution — has fully finished. This keeps the
    shared agent session and task graph free of concurrent writers, so a prompt
    is never dropped.
    """
    from gateway.agent.invoke_main_agent import invokeMainAgent
    from gateway.config import connected_users

    queue = _queueFor(sid)
    while True:
        job = await queue.get()
        try:
            if sid not in connected_users:
                break
            logger.info("[prompt] start sid=%s kind=%s", sid, job.kind)
            await invokeMainAgent(sid, job.system_prompt, job.message)
            logger.info("[prompt] done sid=%s kind=%s", sid, job.kind)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("[prompt] job failed sid=%s kind=%s", sid, job.kind)
        finally:
            queue.task_done()


def startPromptQueue(sid: str) -> None:
    """Start the single-flight prompt worker for a session."""
    if sid in _workers:
        return
    _queueFor(sid)
    _workers[sid] = asyncio.create_task(_runPromptWorker(sid), name=f"prompt-worker:{sid}")


async def stopPromptQueue(sid: str) -> None:
    """Cancel the worker and drop any queued work for a session."""
    worker = _workers.pop(sid, None)
    if worker is not None and not worker.done():
        worker.cancel()
        try:
            await worker
        except asyncio.CancelledError:
            pass
    _queues.pop(sid, None)


def enqueuePrompt(sid: str, system_prompt: str, message: str, kind: str) -> int:
    """Queue one prompt turn; returns the resulting queue depth."""
    queue = _queueFor(sid)
    queue.put_nowait(PromptJob(system_prompt=system_prompt, message=message, kind=kind))
    return queue.qsize()
