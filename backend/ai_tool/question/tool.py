from __future__ import annotations

import json
import logging

from langchain_core.tools import tool

from ai_tool.question.emit import sendStructuredQuestion

logger = logging.getLogger(__name__)


def makeQuestionTool(sid: str):
    """Return the makeQuestion tool bound to the given sid."""

    @tool
    def makeQuestion(question_json: str) -> str:
        """
        Ask the user one or more questions with predefined options.

        Input must be a JSON array of objects, each with:
          - "question": str — the question text
          - "options": list[str] — 2 to 5 non-empty options (do NOT include "other"; the CLI appends it)

        Returns immediately after emitting; answers arrive later via questionnaire_answers.
        """
        try:
            questions = json.loads(question_json)
        except json.JSONDecodeError as exc:
            return f"Error: invalid JSON — {exc}"

        if not isinstance(questions, list) or len(questions) == 0:
            return "Error: question_json must be a non-empty JSON array"

        for item in questions:
            if not isinstance(item, dict):
                return "Error: each question must be a JSON object with 'question' and 'options'"
            options = item.get("options", [])
            if not isinstance(options, list) or not (2 <= len(options) <= 5):
                return "Error: each question must have between 2 and 5 options"
            if any(not isinstance(o, str) or not o.strip() for o in options):
                return "Error: all options must be non-empty strings"

        sendStructuredQuestion(sid, questions)
        return "Questions sent. Waiting for user response."

    return makeQuestion
