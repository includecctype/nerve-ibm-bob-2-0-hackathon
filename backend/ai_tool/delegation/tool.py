from __future__ import annotations

from langchain_core.tools import tool

from ai_tool.delegation.pending_requests.pending_requests import requestTool


def makeFileTool(sid: str):
    """Return a namespace of forwarded file/shell tools bound to the given sid."""

    @tool
    async def write(file_path: str, content: str, mode: str = "overwrite") -> str:
        """Write content to a file on the user's machine. mode must be 'overwrite' or 'append'."""
        return await requestTool(
            sid, "write", {"file_path": file_path, "content": content, "mode": mode}
        )

    @tool
    async def edit(file_path: str, old_string: str, new_string: str) -> str:
        """Edit a file by replacing old_string with new_string. old_string must be unique in the file."""
        return await requestTool(
            sid,
            "edit",
            {"file_path": file_path, "old_string": old_string, "new_string": new_string},
        )

    @tool
    async def readFile(file_path: str, offset: int = 1, limit: int = 500) -> str:
        """Read a file from the user's machine. Returns line-numbered content. offset is 1-based."""
        return await requestTool(
            sid, "readFile", {"file_path": file_path, "offset": offset, "limit": limit}
        )

    @tool
    async def listDir(directory_path: str) -> str:
        """List the contents of a directory on the user's machine as an ASCII tree."""
        return await requestTool(sid, "listDir", {"directory_path": directory_path})

    @tool
    async def grep(pattern: str, path: str = ".", file_glob: str | None = None) -> str:
        """Search for a regex pattern in files on the user's machine. Returns up to 50 matches."""
        args: dict = {"pattern": pattern, "path": path}
        if file_glob is not None:
            args["file_glob"] = file_glob
        return await requestTool(sid, "grep", args)

    @tool
    async def glob(pattern: str, path: str = ".") -> str:
        """Find files matching a glob pattern on the user's machine. Returns up to 100 paths."""
        return await requestTool(sid, "glob", {"pattern": pattern, "path": path})

    @tool
    async def terminalCommand(bash_command: str) -> str:
        """Execute a bash command on the user's machine. 30 s timeout. Returns exit code + output."""
        return await requestTool(sid, "terminalCommand", {"bash_command": bash_command})

    return [write, edit, readFile, listDir, grep, glob, terminalCommand]
