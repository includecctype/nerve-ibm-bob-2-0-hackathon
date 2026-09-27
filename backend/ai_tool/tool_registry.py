from __future__ import annotations

from typing import Any

from ai_tool.delegation.tool import makeFileTool
from ai_tool.network.tool import webFetch, webSearch
from ai_tool.question.tool import makeQuestionTool


def createSubAgentWithTools(agent_id: int, api_key: str, sid: str) -> Any:
    """Create a sub-agent bound to the executor tool set of its session."""
    from model.sub_agent import createSubAgent

    return createSubAgent(agent_id, api_key, getSubAgentTools(sid), sid)


def getMainAgentTools(sid: str) -> list[Any]:
    """
    Return the tool set for the main orchestrator agent: the task-graph tools
    plus makeQuestion (no file/web execution — that is the sub-agents' job).

    Execution runs in the background (see gateway.state.exec_scheduler), so
    executeCurrentTask only starts or joins a pass; results are delivered later
    as a prompt.
    """
    from ai_tool.task.tool import makeTaskTools

    process_new_task, execute_current_task, check_running_tasks = makeTaskTools(sid=sid)
    return [
        makeQuestionTool(sid),
        process_new_task,
        execute_current_task,
        check_running_tasks,
    ]


def getSubAgentTools(sid: str) -> list[Any]:
    """Return the tool set for sub-agent executors (file/shell + web, no graph or question tools).

    Web sessions work against their OCI folder; CLI sessions forward the tools
    to the client for local execution.
    """
    from gateway.storage.storage_events import storageFolder

    if storageFolder(sid) is not None:
        from ai_tool.file_ops.tool import makeOciFileTools

        file_tools = makeOciFileTools(sid)
    else:
        file_tools = makeFileTool(sid)
    return [
        *file_tools,
        webSearch,
        webFetch,
    ]
