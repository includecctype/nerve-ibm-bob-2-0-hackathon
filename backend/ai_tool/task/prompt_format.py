from __future__ import annotations

from ai_tool.task.task_graph import normalizeName, truncateResult
from ai_tool.task.task_models import TaskCategory


def buildGraphOverview(
    pending: list[TaskCategory],
    running: list[TaskCategory],
    completed: list[TaskCategory],
) -> str:
    lines = ["Current task graph:"]
    if running:
        lines.append("  Running:")
        for c in running:
            lines.append(f"    [{c.status}] {c.name}")
    if pending:
        lines.append("  Pending:")
        for c in pending:
            deps = f" (waits: {', '.join(c.depends_on)})" if c.depends_on else ""
            lines.append(f"    [pending] {c.name}{deps}")
    if completed:
        lines.append("  Completed:")
        for c in completed:
            lines.append(f"    [{c.status}] {c.name}")
    return "\n".join(lines)


def formatPendingForPrompt(pending: list[TaskCategory]) -> str:
    if not pending:
        return "No pending categories."
    lines = []
    for c in pending:
        deps = f" | waits: {', '.join(c.depends_on)}" if c.depends_on else ""
        lines.append(f"- {c.name}{deps}")
        for t in c.tasks:
            lines.append(f"    • {t.description}")
    return "\n".join(lines)


def formatRunningForPrompt(running: list[TaskCategory]) -> str:
    if not running:
        return "No running categories."
    lines = []
    for c in running:
        lines.append(f"- {c.name} [{c.status}]")
        for t in c.tasks:
            lines.append(f"    • [{t.status}] {t.description}")
    return "\n".join(lines)


def formatFinishedForPrompt(completed: list[TaskCategory]) -> str:
    if not completed:
        return "No completed categories."
    lines = []
    for c in completed:
        lines.append(f"- {c.name} [{c.status}]")
    return "\n".join(lines)


def buildTaskPrompt(
    category: TaskCategory,
    task_index: int,
    completed: list[TaskCategory],
    last_user_request: str,
    graph_overview: str,
) -> str:
    task = category.tasks[task_index]
    total = len(category.tasks)

    prior_results = ""
    for i in range(task_index):
        prev = category.tasks[i]
        if prev.result:
            prior_results += f"\nResult of task {i + 1}:\n{truncateResult(prev.result)}"

    dep_results = ""
    dep_names = {normalizeName(d) for d in category.depends_on}
    for c in completed:
        if normalizeName(c.name) in dep_names and c.result:
            dep_results += f"\nResult from '{c.name}':\n{truncateResult(c.result)}"

    parts = [
        f"Overall goal: {last_user_request}",
        f"\n{graph_overview}",
        f"\nYou are executing task {task_index + 1} of {total} in category '{category.name}'.",
        f"Task: {task.description}",
    ]
    if prior_results:
        parts.append(f"\nPrior task results in this category:{prior_results}")
    if dep_results:
        parts.append(f"\nResults from dependency categories:{dep_results}")

    return "\n".join(parts)
