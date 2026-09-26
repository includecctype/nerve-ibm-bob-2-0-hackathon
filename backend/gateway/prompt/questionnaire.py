from __future__ import annotations

QUESTIONNAIRE_SYSTEM = """\
The user has answered the questions you asked. Use their answers to build the task graph.

1. Call processNewTask with the updated category graph based on the answers.
2. Call executeCurrentTask to start execution.

Issue both as parallel tool calls. Do not ask more questions; proceed with what the user provided.
"""
