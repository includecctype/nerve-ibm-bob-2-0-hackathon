from __future__ import annotations

import re
from collections import deque

from ai_tool.task.task_models import TaskCategory, TaskStatus

TRUNCATE_RESULT_LIMIT = 600


def normalizeName(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip()).lower()


def truncateResult(result: str) -> str:
    if len(result) <= TRUNCATE_RESULT_LIMIT:
        return result
    return result[:TRUNCATE_RESULT_LIMIT] + "…"


def makeCategory(name: str, tasks: list[str], depends_on: list[str]) -> TaskCategory:
    from ai_tool.task.task_models import TaskItem

    return TaskCategory(
        name=normalizeName(name),
        tasks=[TaskItem(description=t) for t in tasks],
        depends_on=[normalizeName(d) for d in depends_on],
    )


def validateCategoryInput(raw: list[dict]) -> list[dict]:
    """Return only well-formed category dicts; drop malformed ones."""
    valid = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        name = item.get("name", "")
        tasks = item.get("tasks", [])
        if not name or not isinstance(tasks, list) or not tasks:
            continue
        # Deduplicate task descriptions within this category
        seen: set[str] = set()
        deduped = []
        for t in tasks:
            if isinstance(t, str) and t not in seen:
                seen.add(t)
                deduped.append(t)
        if not deduped:
            continue
        valid.append(
            {
                "name": name,
                "tasks": deduped,
                "depends_on": item.get("depends_on", []),
            }
        )
    return valid


def buildStatusMap(
    pending: list[TaskCategory],
    running: list[TaskCategory],
    completed: list[TaskCategory],
) -> dict[str, TaskStatus]:
    status_map: dict[str, TaskStatus] = {}
    for cat in completed:
        status_map[normalizeName(cat.name)] = cat.status
    for cat in running:
        status_map[normalizeName(cat.name)] = cat.status
    for cat in pending:
        status_map[normalizeName(cat.name)] = cat.status
    return status_map


def readyCategories(
    pending: list[TaskCategory], status_map: dict[str, TaskStatus]
) -> list[TaskCategory]:
    """Return pending categories whose every depends_on is 'done'."""
    ready = []
    for cat in pending:
        if all(status_map.get(normalizeName(d)) == "done" for d in cat.depends_on):
            ready.append(cat)
    return ready


def cascadeBlocked(
    pending: list[TaskCategory], status_map: dict[str, TaskStatus]
) -> tuple[list[TaskCategory], list[TaskCategory]]:
    """
    Mark pending categories as blocked when a dependency is failed/blocked.
    Returns (newly_blocked, remaining_pending).
    """
    newly_blocked: list[TaskCategory] = []
    remaining: list[TaskCategory] = []
    for cat in pending:
        should_block = any(
            status_map.get(normalizeName(d)) in ("failed", "blocked") for d in cat.depends_on
        )
        if should_block:
            cat.status = "blocked"
            newly_blocked.append(cat)
        else:
            remaining.append(cat)
    return newly_blocked, remaining


def repairGraph(
    incoming: list[dict],
    running: list[TaskCategory],
    existing_pending: list[TaskCategory],
) -> tuple[list[dict], list[str]]:
    """
    Rename categories colliding with running names (suffix ' (2)').
    Drop self-referencing and unknown depends_on.
    Returns (repaired_list, notes).
    """
    running_names = {normalizeName(c.name) for c in running}
    incoming_names = {normalizeName(item["name"]) for item in incoming}
    all_known = running_names | incoming_names | {normalizeName(c.name) for c in existing_pending}

    notes: list[str] = []
    repaired: list[dict] = []

    for item in incoming:
        normalized = normalizeName(item["name"])
        new_name = item["name"]

        # Rename if colliding with a running category
        if normalized in running_names:
            new_name = f"{item['name']} (2)"
            notes.append(f"Renamed '{item['name']}' to '{new_name}' (conflicts with running)")
            normalized = normalizeName(new_name)

        # Drop self-referencing and unknown depends_on
        clean_deps: list[str] = []
        for d in item.get("depends_on", []):
            nd = normalizeName(d)
            if nd == normalized:
                notes.append(f"Dropped self-dep '{d}' from '{new_name}'")
                continue
            if nd not in all_known:
                notes.append(f"Dropped unknown dep '{d}' from '{new_name}'")
                continue
            clean_deps.append(d)

        repaired.append(
            {
                "name": new_name,
                "tasks": item["tasks"],
                "depends_on": clean_deps,
            }
        )

    return repaired, notes


def validateGraph(
    incoming: list[dict],
    running: list[TaskCategory],
    completed: list[TaskCategory],
) -> tuple[bool, str]:
    """
    Kahn's algorithm over incoming + running + completed.
    Returns (is_valid, error_message).
    """
    # Build full name set
    all_cats: dict[str, list[str]] = {}

    for cat in completed:
        all_cats[normalizeName(cat.name)] = []

    for cat in running:
        n = normalizeName(cat.name)
        all_cats[n] = []

    for item in incoming:
        n = normalizeName(item["name"])
        if n in {normalizeName(c.name) for c in running}:
            return False, f"Category '{item['name']}' conflicts with a running category"
        all_cats[n] = [normalizeName(d) for d in item.get("depends_on", [])]

    # Kahn's algorithm
    in_degree: dict[str, int] = {n: 0 for n in all_cats}
    for deps in all_cats.values():
        for d in deps:
            if d in in_degree:
                in_degree[d] = in_degree.get(d, 0)  # already accounted for

    # Build adjacency for Kahn
    adj: dict[str, list[str]] = {n: [] for n in all_cats}
    in_deg: dict[str, int] = {n: 0 for n in all_cats}
    for n, deps in all_cats.items():
        for d in deps:
            adj[d].append(n)
            in_deg[n] += 1

    queue: deque[str] = deque(n for n, deg in in_deg.items() if deg == 0)
    visited = 0
    while queue:
        node = queue.popleft()
        visited += 1
        for neighbor in adj[node]:
            in_deg[neighbor] -= 1
            if in_deg[neighbor] == 0:
                queue.append(neighbor)

    if visited != len(all_cats):
        return False, "Cycle detected in task graph"

    return True, ""
