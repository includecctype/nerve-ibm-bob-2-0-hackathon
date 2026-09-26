from __future__ import annotations

from typing import Any


class AgentSession:
    def __init__(self, agent: Any, thread_id: str) -> None:
        self.agent = agent
        self.thread_id = thread_id

    async def ainvoke(self, message: str) -> dict:
        config = {"configurable": {"thread_id": self.thread_id}}
        return await self.agent.ainvoke({"messages": [("human", message)]}, config=config)
