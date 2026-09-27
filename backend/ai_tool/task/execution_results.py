from __future__ import annotations

from typing import Any

from ai_tool.task.task_graph import normalizeName, truncateResult


def buildExecutionResults(totals: dict[str, list[str]], user: Any) -> str:
    """Summarise a drained execution pass for the main agent to report.

    `totals` accumulates the done/failed/blocked category names across the passes
    that ran for one set of prompts; results are read from the session's finished
    categories so only categories that actually ran are reported.
    """
    done = totals.get("done", [])
    failed = totals.get("failed", [])
    blocked = totals.get("blocked", [])
    if not (done or failed or blocked):
        return ""

    parts: list[str] = []
    if done:
        parts.append(f"completed: {', '.join(done)}")
    if failed:
        parts.append(f"failed: {', '.join(failed)}")
    if blocked:
        parts.append(f"blocked by failures: {', '.join(blocked)}")
    summary = "; ".join(parts) if parts else "no categories ran"

    completed_lookup = {normalizeName(known.name): known for known in user.completed_categories}
    detail_lines: list[str] = []
    for name in [*done, *failed]:
        known = completed_lookup.get(normalizeName(name))
        if known is None:
            continue
        results = [truncateResult(task.result) for task in known.tasks if task.result]
        detail = "; ".join(results) if results else "(no result captured)"
        detail_lines.append(f"- {name}: {detail}")

    body = f"Execution pass finished ({summary})."
    if detail_lines:
        body += "\nCategory results:\n" + "\n".join(detail_lines)

    remaining = len(user.pending_categories)
    if remaining:
        body += f"\n{remaining} pending categor(ies) remain undrained (blocked or waiting)."
    return body
