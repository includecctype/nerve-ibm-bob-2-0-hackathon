from __future__ import annotations

from typing import Any

from ai_tool.delegation.tool import makeFileTool
from ai_tool.network.tool import webFetch, webSearch
from ai_tool.question.tool import makeQuestionTool
from ai_tool.task.tool import checkRunningTasks, executeCurrentTask, processNewTask


def getMainAgentTools(sid: str) -> list[Any]:
    """Return the tool set for the main orchestrator agent (graph + question, no file/web execution)."""
    return [
        makeQuestionTool(sid),
        processNewTask,
        executeCurrentTask,
        checkRunningTasks,
    ]


def getSubAgentTools(sid: str) -> list[Any]:
    """Return the tool set for sub-agent executors (file/shell + web, no graph or question tools)."""
    file_tools = makeFileTool(sid)
    return [
        *file_tools,
        webSearch,
        webFetch,
    ]
