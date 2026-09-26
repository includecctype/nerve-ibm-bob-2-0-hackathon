from __future__ import annotations

import uuid
from typing import Any

from langchain_core.language_models import BaseChatModel
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent

from model.agent_session import AgentSession

# Cache models by (agent_id, api_key) to avoid rebuilding on every sub-agent creation
model_cache: dict[tuple[int, str], BaseChatModel] = {}

PROVIDER_MAP = {
    1: ("openrouter", "openai/auto"),
    2: ("groq", "openai/gpt-oss-120b"),
    3: ("anthropic", "claude-fable-5"),
    4: ("baseten", "moonshotai/Kimi-K2.6"),
    5: ("deepseek", "deepseek-chat"),
}


def initModel(agent_id: int, api_key: str) -> BaseChatModel:
    cache_key = (agent_id, api_key)
    if cache_key in model_cache:
        return model_cache[cache_key]

    provider, model_name = PROVIDER_MAP.get(agent_id, PROVIDER_MAP[1])

    from langchain.chat_models import init_chat_model

    model = init_chat_model(model=model_name, model_provider=provider, api_key=api_key)
    model_cache[cache_key] = model
    return model


class ToolErrorMiddleware:
    """Wraps a tool to convert exceptions into recoverable error strings."""

    def __init__(self, tool: Any) -> None:
        self._tool = tool

    def __getattr__(self, name: str) -> Any:
        return getattr(self._tool, name)

    async def ainvoke(self, *args: Any, **kwargs: Any) -> Any:
        try:
            return await self._tool.ainvoke(*args, **kwargs)
        except Exception as exc:  # noqa: BLE001
            return f"Tool error: {exc}. Please adjust and try again."

    def invoke(self, *args: Any, **kwargs: Any) -> Any:
        try:
            return self._tool.invoke(*args, **kwargs)
        except Exception as exc:  # noqa: BLE001
            return f"Tool error: {exc}. Please adjust and try again."


def buildAgent(
    agent_id: int,
    api_key: str,
    tools: list[Any],
    system_prompt: str,
    thread_id: str | None = None,
) -> AgentSession:
    model = initModel(agent_id, api_key)
    wrapped_tools = [ToolErrorMiddleware(t) for t in tools]
    checkpointer = MemorySaver()
    tid = thread_id or str(uuid.uuid4())

    from langchain_core.prompts import ChatPromptTemplate

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            ("placeholder", "{messages}"),
            ("placeholder", "{agent_scratchpad}"),
        ]
    )

    agent = create_react_agent(model=model, tools=wrapped_tools, prompt=prompt, checkpointer=checkpointer)  # type: ignore[arg-type]
    return AgentSession(agent=agent, thread_id=tid)
