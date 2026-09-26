from __future__ import annotations

from typing import Any


def contentToText(content: Any) -> str:
    """Flatten a message content value (string or list of blocks) into plain text."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(str(block.get("text", "")))
        return "".join(parts)
    if content is None:
        return ""
    return str(content)


def lastTextFromResult(result: dict) -> str:
    """Return the text of the final assistant message in an agent ainvoke result.

    Only assistant messages are considered: a trailing tool or human message must
    never be surfaced as the model's answer.
    """
    messages = result.get("messages", []) if isinstance(result, dict) else []
    for msg in reversed(messages):
        if getattr(msg, "type", None) != "ai":
            continue
        text = contentToText(getattr(msg, "content", None))
        if text.strip():
            return text
    if messages:
        return contentToText(getattr(messages[-1], "content", None))
    if isinstance(result, dict) and result.get("output"):
        return str(result["output"])
    return str(result)


class AgentSession:
    def __init__(self, agent: Any, thread_id: str) -> None:
        self.agent = agent
        self.thread_id = thread_id
        self.history_restored = False

    def historyMessages(self, history: list[dict] | None) -> list[tuple[str, str]]:
        """Map the CLI display history ({'role', 'content'}) onto chat messages."""
        messages: list[tuple[str, str]] = []
        for entry in history or []:
            role = entry.get("role")
            content = entry.get("content")
            if content is None:
                continue
            if role == "user":
                messages.append(("human", str(content)))
            elif role == "assistant":
                messages.append(("ai", str(content)))
        return messages

    async def invokeMessages(self, messages: list[tuple[str, str]]) -> dict:
        config = {"configurable": {"thread_id": self.thread_id}}
        return await self.agent.ainvoke({"messages": messages}, config=config)

    async def runTurn(
        self,
        turn_prompt: str,
        message: str,
        history: list[dict] | None = None,
    ) -> dict:
        """
        One main-agent turn: the turn's instructions and live task-graph context are
        sent as a system message (not folded into the user text), and the history sent
        at connect is replayed exactly once so it does not duplicate what the
        checkpointer already holds.
        """
        prior: list[tuple[str, str]] = []
        if not self.history_restored:
            prior = self.historyMessages(history)
            self.history_restored = True
        messages: list[tuple[str, str]] = list(prior)
        if turn_prompt:
            messages.append(("system", turn_prompt))
        messages.append(("human", message))
        return await self.invokeMessages(messages)

    async def ainvoke(self, message: str) -> dict:
        """Single-message turn (sub-agents): the system prompt is baked into the agent."""
        return await self.invokeMessages([("human", message)])
