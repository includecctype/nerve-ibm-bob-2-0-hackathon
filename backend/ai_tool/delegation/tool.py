from __future__ import annotations

import asyncio
from typing import Any

from langchain_core.tools import tool

from ai_tool.delegation.pending_requests.pending_requests import requestTool


def _run_async(coro: Any) -> str:
    """Run a coroutine from a sync context (tool invocation)."""
    loop = asyncio.get_event_loop()
    if loop.is_running():
        import concurrent.futures

        future = concurrent.futures.Future()

        async def _wrapper():
            try:
                result = await coro
                future.set_result(result)
            except Exception as exc:  # noqa: BLE001
                future.set_exception(exc)

        asyncio.ensure_future(_wrapper())
        return future.result()
    return loop.run_until_complete(coro)


def makeFileTool(sid: str):
    """Return a namespace of forwarded file/shell tools bound to the given sid."""

    @tool
    def write(file_path: str, content: str, mode: str = "overwrite") -> str:
        """Write content to a file on the user's machine. mode must be 'overwrite' or 'append'."""
        return _run_async(
            requestTool(sid, "write", {"file_path": file_path, "content": content, "mode": mode})
        )

    @tool
    def edit(file_path: str, old_string: str, new_string: str) -> str:
        """Edit a file by replacing old_string with new_string. old_string must be unique in the file."""
        return _run_async(
            requestTool(
                sid,
                "edit",
                {"file_path": file_path, "old_string": old_string, "new_string": new_string},
            )
        )

    @tool
    def readFile(file_path: str, offset: int = 1, limit: int = 500) -> str:
        """Read a file from the user's machine. Returns line-numbered content. offset is 1-based."""
        return _run_async(
            requestTool(sid, "readFile", {"file_path": file_path, "offset": offset, "limit": limit})
        )

    @tool
    def listDir(directory_path: str) -> str:
        """List the contents of a directory on the user's machine as an ASCII tree."""
        return _run_async(requestTool(sid, "listDir", {"directory_path": directory_path}))

    @tool
    def grep(pattern: str, path: str = ".", file_glob: str | None = None) -> str:
        """Search for a regex pattern in files on the user's machine. Returns up to 50 matches."""
        args: dict = {"pattern": pattern, "path": path}
        if file_glob is not None:
            args["file_glob"] = file_glob
        return _run_async(requestTool(sid, "grep", args))

    @tool
    def glob(pattern: str, path: str = ".") -> str:
        """Find files matching a glob pattern on the user's machine. Returns up to 100 paths."""
        return _run_async(requestTool(sid, "glob", {"pattern": pattern, "path": path}))

    @tool
    def terminalCommand(bash_command: str) -> str:
        """Execute a bash command on the user's machine. 30 s timeout. Returns exit code + output."""
        return _run_async(requestTool(sid, "terminalCommand", {"bash_command": bash_command}))

    return [write, edit, readFile, listDir, grep, glob, terminalCommand]
