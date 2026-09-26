from __future__ import annotations

import asyncio
import re
from typing import Any

from langchain_core.tools import tool

from ai_tool.file_ops import operations
from gateway.storage.storage_events import emitStorageChange, storageFolder
from storage.service import storage_limits
from storage.service.storage_service import TreeNode, readRaw, readText, writeText


async def collectFiles(folder: str, path: str = "", depth: int = 0) -> list[TreeNode]:
    """Return every file under a directory, bounded by depth and count."""
    from storage.service import storage_service

    if depth > storage_limits.MAX_TREE_DEPTH:
        return []
    nodes = await asyncio.to_thread(storage_service.listTree, folder, path)
    files: list[TreeNode] = []
    for node in nodes:
        if len(files) >= storage_limits.MAX_TREE_ENTRIES:
            break
        if node.kind == "folder":
            if node.name in storage_limits.IGNORED_DIRS:
                continue
            files.extend(await collectFiles(folder, node.path, depth + 1))
        else:
            files.append(node)
    return files


def makeOciFileTools(sid: str):
    """Return the file tools backed by the session's OCI folder.

    These replace the forwarded CLI tools for web sessions: instead of asking a
    browser to run against a local filesystem, they read and write the session's
    object-storage folder and announce changes so the explorer can refresh.
    """

    def requireFolder() -> str:
        folder = storageFolder(sid)
        if folder is None:
            raise RuntimeError("this session has no storage folder")
        return folder

    @tool
    async def write(file_path: str, content: str, mode: str = "overwrite") -> str:
        """Write or append content to a file in the session workspace.

        mode must be 'overwrite' or 'append'.

        Args:
            file_path: Path to the file relative to the workspace folder
            content: Content to write to the file
            mode: 'overwrite' to replace, 'append' to add to existing content
        """
        if mode not in ("overwrite", "append"):
            return "Error: mode must be 'overwrite' or 'append'"
        try:
            folder = requireFolder()
            await asyncio.to_thread(writeText, folder, file_path, content, mode)
            await emitStorageChange(sid, "write", file_path)
            return f"Wrote {file_path} ({mode})"
        except Exception as exc:  # noqa: BLE001 - tools report failures as text
            return f"Error: {exc}"

    @tool
    async def edit(file_path: str, old_string: str, new_string: str) -> str:
        """Replace an exact string in a file in the session workspace.

        old_string must appear exactly once.

        Args:
            file_path: Path to the file relative to the workspace folder
            old_string: Exact text to replace (must be unique in the file)
            new_string: Replacement text
        """
        try:
            folder = requireFolder()
            text, _ = await asyncio.to_thread(readRaw, folder, file_path)
            updated = operations.replaceOnce(text, old_string, new_string)
            await asyncio.to_thread(writeText, folder, file_path, updated, "overwrite")
            await emitStorageChange(sid, "write", file_path)
            return f"Edited {file_path}"
        except Exception as exc:  # noqa: BLE001 - tools report failures as text
            return f"Error: {exc}"

    @tool
    async def readFile(file_path: str, offset: int = 1, limit: int = 500) -> str:
        """Read a file in the session workspace with line numbers.

        offset is 1-based; default reads from line 1 up to the limit.

        Args:
            file_path: Path to the file relative to the workspace folder
            offset: 1-based line number to start reading from
            limit: Maximum number of lines to return
        """
        try:
            folder = requireFolder()
            return await asyncio.to_thread(readText, folder, file_path, offset, limit)
        except Exception as exc:  # noqa: BLE001 - tools report failures as text
            return f"Error: {exc}"

    @tool
    async def listDir(directory_path: str) -> str:
        """List a directory in the session workspace as an ASCII tree.

        Args:
            directory_path: Path to the directory relative to the workspace folder
        """
        try:
            folder = requireFolder()
            tree = await buildTree(folder, directory_path)
            root_name = directory_path.rstrip("/").split("/")[-1] or folder
            return operations.renderTree(root_name, tree)
        except Exception as exc:  # noqa: BLE001 - tools report failures as text
            return f"Error: {exc}"

    @tool
    async def grep(pattern: str, path: str = ".", file_glob: str | None = None) -> str:
        """Search file contents in the session workspace with a regular expression.

        Returns up to 50 matches.

        Args:
            pattern: Regular expression to search for
            path: Directory or file to search, relative to the workspace folder
            file_glob: Optional filename filter, e.g. '*.py'
        """
        from storage.service import storage_service

        try:
            folder = requireFolder()
            compiled = re.compile(pattern)
        except Exception as exc:  # noqa: BLE001 - tools report failures as text
            return f"Error: {exc}"

        search_path = "" if path in (".", "") else path
        if search_path and await asyncio.to_thread(storage_service.fileExists, folder, search_path):
            targets = [TreeNode(name=search_path, path=search_path, kind="file")]
        else:
            targets = await collectFiles(folder, search_path)

        matches: list[str] = []
        for node in targets:
            if file_glob and not operations.matchesGlob(file_glob, node.name):
                continue
            text, _ = await asyncio.to_thread(readRaw, folder, node.path)
            for lineno, line in enumerate(text.split("\n"), start=1):
                if compiled.search(line):
                    matches.append(f"{node.path}:{lineno}: {line}")
                    if len(matches) >= storage_limits.GREP_MAX_MATCHES:
                        break
            if len(matches) >= storage_limits.GREP_MAX_MATCHES:
                break
        return "\n".join(matches) if matches else "No matches."

    @tool
    async def glob(pattern: str, path: str = ".") -> str:
        """Find files matching a glob pattern (e.g. '**/*.py') in the session workspace.

        Returns up to 100 paths, newest first.

        Args:
            pattern: Glob pattern to match
            path: Directory to search in, relative to the workspace folder
        """
        try:
            folder = requireFolder()
            search_path = "" if path in (".", "") else path
            files = await collectFiles(folder, search_path)
        except Exception as exc:  # noqa: BLE001 - tools report failures as text
            return f"Error: {exc}"

        matched = [node for node in files if operations.matchesGlob(pattern, node.path)]
        matched.sort(key=lambda node: (node.updated_at, node.name), reverse=True)
        matched = matched[: storage_limits.GLOB_MAX_RESULTS]
        return "\n".join(node.path for node in matched) if matched else "No matches."

    @tool
    async def terminalCommand(bash_command: str) -> str:
        """Run a shell command.

        Not available in the web workspace: there is no shell, only the session's
        cloud storage folder.

        Args:
            bash_command: Command that would have been executed
        """
        return "Error: terminalCommand is not available in the web workspace"

    return [write, edit, readFile, listDir, grep, glob, terminalCommand]


async def buildTree(folder: str, path: str, depth: int = 0) -> dict[str, Any]:
    """Build a nested {name: subtree|None} map for listDir rendering."""
    from storage.service import storage_service

    if depth > storage_limits.MAX_TREE_DEPTH:
        return {}
    nodes = await asyncio.to_thread(storage_service.listTree, folder, path)
    tree: dict[str, Any] = {}
    for node in nodes:
        if len(tree) >= storage_limits.MAX_TREE_ENTRIES:
            break
        if node.kind == "folder":
            if node.name in storage_limits.IGNORED_DIRS:
                continue
            tree[node.name] = await buildTree(folder, node.path, depth + 1)
        else:
            tree[node.name] = None
    return tree
