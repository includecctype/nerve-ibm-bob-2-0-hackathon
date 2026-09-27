from __future__ import annotations

QUESTIONNAIRE_SYSTEM = """\
Convert the user's answers into a concrete plan:
1) Call processNewTask with the COMPLETE pending graph as an array of {name, tasks, depends_on} objects — morph answer-derived work into the pending graph from the session state. Decompose into one category per independent workstream or phase (never lump sequenced phases together; "then" = depends_on, "also" = separate category). Free-form unique category names; tasks run sequentially inside a category; depends_on must form a DAG (no cycles). Never include running or finished categories.
2) Briefly restate the plan to the user.
3) Call executeCurrentTask to start (or join) background execution; it returns immediately and results arrive later as a new message.
Categories run in parallel once all their depends_on are done; a failed category blocks its dependents.
If answers are incomplete, ask one focused follow-up with makeQuestion (2-5 concrete options; never include an "other"/custom/write-in option — the UI always adds one)."""
