from __future__ import annotations

import uuid
from typing import Any

from langchain.agents import create_agent
from langchain.agents.middleware import ToolErrorMiddleware
from langchain_core.language_models import BaseChatModel
from langgraph.checkpoint.memory import InMemorySaver

from model.agent_session import AgentSession

# Cache models by (agent_id, api_key) to avoid rebuilding on every sub-agent creation
model_cache: dict[tuple[int, str], BaseChatModel] = {}

PROVIDER_MAP = {
    1: ("openrouter", "auto"),
    2: ("groq", "openai/gpt-oss-120b"),
    3: ("anthropic", "claude-fable-5"),
    4: ("baseten", "moonshotai/Kimi-K2.6"),
    5: ("deepseek", "deepseek-chat"),
}


def initModel(agent_id: int, api_key: str) -> BaseChatModel:
    cache_key = (agent_id, api_key)
    if cache_key in model_cache:
        return model_cache[cache_key]

    if agent_id not in PROVIDER_MAP:
        raise ValueError(f"Invalid agent_id: {agent_id}")
    provider, model_name = PROVIDER_MAP[agent_id]

    from langchain.chat_models import init_chat_model

    model = init_chat_model(model=model_name, model_provider=provider, api_key=api_key)
    model_cache[cache_key] = model
    return model


def toolErrorMiddleware() -> ToolErrorMiddleware:
    """Convert any tool exception into a string the model can recover from."""

    def on_error(exc: Exception, request: Any) -> str:
        return (
            f"Tool failed: {type(exc).__name__}: {exc}. "
            "Adjust inputs and retry once, or report the failure to the user and continue."
        )

    async def aon_error(exc: Exception, request: Any) -> str:
        return on_error(exc, request)

    return ToolErrorMiddleware(on_error=on_error, aon_error=aon_error)


def buildAgent(
    agent_id: int,
    api_key: str,
    tools: list[Any],
    system_prompt: str,
    thread_id: str | None = None,
) -> AgentSession:
    model = initModel(agent_id, api_key)
    checkpointer = InMemorySaver()
    tid = thread_id or str(uuid.uuid4())

    agent = create_agent(
        model=model,
        tools=tools,
        checkpointer=checkpointer,
        system_prompt=system_prompt,
        middleware=[toolErrorMiddleware()],
    )
    return AgentSession(agent=agent, thread_id=tid)
