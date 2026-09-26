from __future__ import annotations

from typing import Any


def lastTextFromResult(result: dict) -> str:
    """Return the text of the final assistant message in an agent ainvoke result."""
    messages = result.get("messages", []) if isinstance(result, dict) else []
    for msg in reversed(messages):
        content = getattr(msg, "content", None)
        if isinstance(content, str) and content.strip():
            return content
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
        prepended to the user message, and the history sent at connect is replayed
        exactly once so it does not duplicate what the checkpointer already holds.
        """
        prior: list[tuple[str, str]] = []
        if not self.history_restored:
            prior = self.historyMessages(history)
            self.history_restored = True
        human = f"{turn_prompt}\n\n{message}" if turn_prompt else message
        return await self.invokeMessages([*prior, ("human", human)])

    async def ainvoke(self, message: str) -> dict:
        """Single-message turn (sub-agents): the system prompt is baked into the agent."""
        return await self.invokeMessages([("human", message)])
