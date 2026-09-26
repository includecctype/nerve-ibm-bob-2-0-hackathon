from __future__ import annotations

TASK_CONTEXT_SUFFIX = """\

Current session task graph:
Running categories (immutable):
{running}
Pending categories (morph the complete list via processNewTask):
{pending}
Finished: {finished}

Category names are free-form. A category runs in parallel the moment all its depends_on are done; tasks inside a category run sequentially in order. depends_on must form a DAG (no cycles) and only reference known categories. A failed category blocks its dependents. processNewTask must return the FULL updated pending list.
"""
