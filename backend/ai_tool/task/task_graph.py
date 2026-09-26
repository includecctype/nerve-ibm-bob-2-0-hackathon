from __future__ import annotations

import re
from collections import deque

from ai_tool.task.task_models import TaskCategory, TaskStatus

TRUNCATE_RESULT_LIMIT = 600


def normalizeName(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip()).lower()


def truncateResult(result: str, limit: int = TRUNCATE_RESULT_LIMIT) -> str:
    """Collapse whitespace and cap a result so prompt context stays bounded."""
    cleaned = " ".join(result.split())
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1] + "…"


def makeCategory(name: str, tasks: list[str], depends_on: list[str]) -> TaskCategory:
    from ai_tool.task.task_models import TaskItem

    return TaskCategory(
        name=name.strip(),
        tasks=[TaskItem(description=t) for t in tasks],
        depends_on=[d.strip() for d in depends_on],
        status="pending",
    )


def validateCategoryInput(raw: object) -> tuple[list[dict] | None, str | None]:
    """Structural validation of processNewTask input (list of category dicts).

    Returns (categories, None) or (None, error_message) so the model gets a
    corrective message instead of silently losing categories.
    """
    if not raw:
        return None, "Error: categories must contain at least one category."
    if not isinstance(raw, list):
        return None, "Error: categories must be a JSON array."

    categories: list[dict] = []
    for item in raw:
        if not isinstance(item, dict):
            return None, f"Error: each category must be an object: {item!r}."
        name = item.get("name")
        if not isinstance(name, str) or not name.strip():
            return None, "Error: every category needs a non-empty string name."

        tasks = item.get("tasks")
        if not isinstance(tasks, list) or not tasks:
            return None, f"Error: category {name!r} needs a non-empty tasks list."
        deduped: list[str] = []
        seen: set[str] = set()
        for task in tasks:
            if not isinstance(task, str) or not task.strip():
                return None, f"Error: category {name!r} has an empty task description."
            key = normalizeName(task)
            if key in seen:
                continue
            seen.add(key)
            deduped.append(task.strip())

        depends = item.get("depends_on", [])
        if depends is None:
            depends = []
        if not isinstance(depends, list):
            return None, f"Error: depends_on of category {name!r} must be a list of names."
        for dep in depends:
            if not isinstance(dep, str) or not dep.strip():
                return None, f"Error: category {name!r} has an invalid depends_on entry: {dep!r}."

        categories.append(
            {
                "name": name.strip(),
                "tasks": deduped,
                "depends_on": [dep.strip() for dep in depends],
            }
        )

    return categories, None


def buildStatusMap(
    pending: list[TaskCategory],
    running: list[TaskCategory],
    completed: list[TaskCategory],
) -> dict[str, TaskStatus]:
    status_map: dict[str, TaskStatus] = {}
    for cat in running:
        status_map[normalizeName(cat.name)] = cat.status
    for cat in completed:
        status_map[normalizeName(cat.name)] = cat.status
    for cat in pending:
        # Pending must not override a known running/completed status for the same name.
        status_map.setdefault(normalizeName(cat.name), cat.status)
    return status_map


def readyCategories(
    pending: list[TaskCategory], status_map: dict[str, TaskStatus]
) -> list[TaskCategory]:
    """Return pending categories whose every depends_on is 'done'."""
    ready = []
    for cat in pending:
        if cat.status != "pending":
            continue
        if all(status_map.get(normalizeName(d)) == "done" for d in cat.depends_on):
            ready.append(cat)
    return ready


def cascadeBlocked(
    pending: list[TaskCategory], status_map: dict[str, TaskStatus]
) -> tuple[list[TaskCategory], list[TaskCategory]]:
    """
    Mark pending categories blocked when any dependency failed or is blocked,
    transitively: a category blocked here can block its own dependents in the
    same pass.
    Returns (newly_blocked, remaining_pending).
    """
    blocked: list[TaskCategory] = []
    remaining = list(pending)
    changed = True
    while changed:
        changed = False
        for cat in remaining:
            if any(
                status_map.get(normalizeName(d)) in ("failed", "blocked") for d in cat.depends_on
            ):
                cat.status = "blocked"
                status_map[normalizeName(cat.name)] = "blocked"
                blocked.append(cat)
                remaining.remove(cat)
                changed = True
                break
    return blocked, remaining


def repairGraph(
    incoming: list[dict],
    running: list[TaskCategory],
    completed: list[TaskCategory],
) -> tuple[list[dict], list[str]]:
    """Auto-fix recoverable morph issues instead of rejecting the call.

    - a name colliding with a RUNNING or COMPLETED category is suffixed: "visa" -> "visa (2)"
    - duplicate names inside the incoming list are suffixed the same way
    - unknown or self dependencies are dropped
    Returns the repaired list (dicts) plus human-readable notes for the model.
    Cycles are NOT repaired here - validateGraph still rejects them.
    """
    running_keys = {normalizeName(c.name) for c in running}
    completed_keys = {normalizeName(c.name) for c in completed}

    notes: list[str] = []
    claimed: set[str] = set()
    renamed: list[dict] = []

    for item in incoming:
        name = item["name"]
        key = normalizeName(name)
        reason: str | None = None
        if key in running_keys:
            reason = "conflicts with running"
        elif key in claimed:
            reason = "duplicate in this call"
        if reason is not None:
            suffix = 2
            while True:
                candidate = f"{name} ({suffix})"
                candidate_key = normalizeName(candidate)
                if (
                    candidate_key not in claimed
                    and candidate_key not in running_keys
                    and candidate_key not in completed_keys
                ):
                    break
                suffix += 1
            notes.append(f"Renamed '{name}' to '{candidate}' ({reason})")
            name = candidate
            key = candidate_key
        claimed.add(key)
        renamed.append({**item, "name": name})

    known = claimed | running_keys | completed_keys
    repaired: list[dict] = []
    for item in renamed:
        self_key = normalizeName(item["name"])
        clean_deps: list[str] = []
        for dep in item.get("depends_on", []):
            dep_key = normalizeName(dep)
            if dep_key == self_key:
                notes.append(f"Dropped self-dep '{dep}' from '{item['name']}'")
                continue
            if dep_key not in known:
                notes.append(f"Dropped unknown dep '{dep}' from '{item['name']}'")
                continue
            clean_deps.append(dep)
        repaired.append({**item, "depends_on": clean_deps})

    return repaired, notes


def validateGraph(
    incoming: list[dict],
    running: list[TaskCategory],
    completed: list[TaskCategory],
) -> tuple[bool, str]:
    """
    Validate references and acyclicity (Kahn) over incoming + running + completed.
    Returns (is_valid, error_message).
    """
    running_keys = {normalizeName(c.name) for c in running}
    completed_keys = {normalizeName(c.name) for c in completed}
    incoming_keys = {normalizeName(item["name"]) for item in incoming}

    for item in incoming:
        if normalizeName(item["name"]) in running_keys:
            return False, f"Category '{item['name']}' conflicts with a running category"

    known = incoming_keys | running_keys | completed_keys
    for item in incoming:
        self_key = normalizeName(item["name"])
        for dep in item.get("depends_on", []):
            dep_key = normalizeName(dep)
            if dep_key not in known:
                return (
                    False,
                    f"Category '{item['name']}' depends on unknown category '{dep}'.",
                )
            if dep_key == self_key:
                return False, f"Category '{item['name']}' cannot depend on itself"

    # Kahn's algorithm over the full graph (incoming + running + completed).
    nodes: dict[str, list[str]] = {}
    for cat in completed:
        nodes[normalizeName(cat.name)] = []
    for cat in running:
        nodes[normalizeName(cat.name)] = []
    for item in incoming:
        nodes[normalizeName(item["name"])] = [
            normalizeName(dep) for dep in item.get("depends_on", [])
        ]

    dependents: dict[str, list[str]] = {n: [] for n in nodes}
    in_deg: dict[str, int] = {n: 0 for n in nodes}
    for n, deps in nodes.items():
        for dep in deps:
            dependents[dep].append(n)
            in_deg[n] += 1

    queue: deque[str] = deque(n for n, deg in in_deg.items() if deg == 0)
    visited = 0
    while queue:
        node = queue.popleft()
        visited += 1
        for neighbor in dependents[node]:
            in_deg[neighbor] -= 1
            if in_deg[neighbor] == 0:
                queue.append(neighbor)

    if visited != len(nodes):
        stuck = [name for name in nodes if in_deg[name] > 0]
        return False, f"Dependency cycle detected involving: {', '.join(stuck)}"

    return True, ""
