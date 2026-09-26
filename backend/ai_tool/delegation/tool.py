from __future__ import annotations

from langchain_core.tools import tool

from ai_tool.delegation.pending_requests.pending_requests import requestTool
from systemconfig.limits import (
    COMMAND_TIMEOUT_SECONDS,
    DEFAULT_READ_LIMIT,
    TOOL_TIMEOUT_SECONDS,
)


def makeFileTool(sid: str):
    """Return the forwarded file/shell tools bound to the given sid.

    Every call is forwarded to the CLI, where the work runs in the user's
    workspace; these tools never touch the server's filesystem.
    """

    @tool
    async def write(file_path: str, content: str, mode: str = "overwrite") -> str:
        """Write or append content to a file on the user's machine.

        mode must be 'overwrite' or 'append'. Path must stay within the workspace.

        Args:
            file_path: Path to the file (relative or absolute, within workspace)
            content: Content to write to the file
            mode: 'overwrite' to replace, 'append' to add to existing content
        """
        return await requestTool(
            sid,
            "write",
            {"file_path": file_path, "content": content, "mode": mode},
            timeout=TOOL_TIMEOUT_SECONDS,
        )

    @tool
    async def edit(file_path: str, old_string: str, new_string: str) -> str:
        """Replace an exact string in a file on the user's machine.

        old_string must appear exactly once. Path must stay within the workspace.

        Args:
            file_path: Path to the file (relative or absolute, within workspace)
            old_string: Exact text to replace (must be unique in the file)
            new_string: Replacement text
        """
        return await requestTool(
            sid,
            "edit",
            {"file_path": file_path, "old_string": old_string, "new_string": new_string},
            timeout=TOOL_TIMEOUT_SECONDS,
        )

    @tool
    async def readFile(file_path: str, offset: int = 1, limit: int = DEFAULT_READ_LIMIT) -> str:
        """Read a file on the user's machine with line numbers.

        offset is 1-based; default reads from line 1 up to the limit.

        Args:
            file_path: Path to the file (relative or absolute, within workspace)
            offset: 1-based line number to start reading from
            limit: Maximum number of lines to return
        """
        return await requestTool(
            sid,
            "readFile",
            {"file_path": file_path, "offset": offset, "limit": limit},
            timeout=TOOL_TIMEOUT_SECONDS,
        )

    @tool
    async def listDir(directory_path: str) -> str:
        """List a directory on the user's machine as an ASCII tree.

        Path must stay within the workspace.

        Args:
            directory_path: Path to the directory (relative or absolute, within workspace)
        """
        return await requestTool(
            sid,
            "listDir",
            {"directory_path": directory_path},
            timeout=TOOL_TIMEOUT_SECONDS,
        )

    @tool
    async def grep(pattern: str, path: str = ".", file_glob: str | None = None) -> str:
        """Search file contents on the user's machine with a regular expression.

        Returns up to 50 matches. Path must stay within the workspace.

        Args:
            pattern: Regular expression to search for
            path: Directory or file to search (relative or absolute, within workspace)
            file_glob: Optional filename filter, e.g. '*.py'
        """
        args: dict = {"pattern": pattern, "path": path}
        if file_glob is not None:
            args["file_glob"] = file_glob
        return await requestTool(sid, "grep", args, timeout=TOOL_TIMEOUT_SECONDS)

    @tool
    async def glob(pattern: str, path: str = ".") -> str:
        """Find files matching a glob pattern (e.g. '**/*.py') on the user's machine.

        Returns up to 100 paths, newest first. Path must stay within the workspace.

        Args:
            pattern: Glob pattern to match
            path: Directory to search in (relative or absolute, within workspace)
        """
        return await requestTool(
            sid, "glob", {"pattern": pattern, "path": path}, timeout=TOOL_TIMEOUT_SECONDS
        )

    @tool
    async def terminalCommand(bash_command: str) -> str:
        """Run a Bash command on the user's machine with a 30s timeout.

        cwd is the workspace root. Returns exit code, stdout, and stderr.

        Args:
            bash_command: Bash command to execute
        """
        return await requestTool(
            sid,
            "terminalCommand",
            {"bash_command": bash_command},
            timeout=COMMAND_TIMEOUT_SECONDS,
        )

    return [write, edit, readFile, listDir, grep, glob, terminalCommand]
