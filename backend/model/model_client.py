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

    provider, model_name = PROVIDER_MAP.get(agent_id, PROVIDER_MAP[1])

    from langchain.chat_models import init_chat_model

    model = init_chat_model(model=model_name, model_provider=provider, api_key=api_key)
    model_cache[cache_key] = model
    return model


def toolErrorMessage(exc: Exception) -> str:
    """Convert any tool exception into a string the model can recover from."""
    return f"Tool error: {exc}. Please adjust and try again."


def buildAgent(
    agent_id: int,
    api_key: str,
    tools: list[Any],
    system_prompt: str,
    thread_id: str | None = None,
) -> AgentSession:
    model = initModel(agent_id, api_key)
    checkpointer = MemorySaver()
    tid = thread_id or str(uuid.uuid4())

    from langchain_core.messages import SystemMessage
    from langchain_core.prompts import ChatPromptTemplate
    from langgraph.prebuilt import ToolNode

    prompt = ChatPromptTemplate.from_messages(
        [
            # SystemMessage keeps JSON examples in the prompt literal: a ("system",
            # ...) tuple would be parsed as a template and choke on its braces.
            SystemMessage(system_prompt),
            ("placeholder", "{messages}"),
            ("placeholder", "{agent_scratchpad}"),
        ]
    )
    tool_node = ToolNode(tools, handle_tool_errors=toolErrorMessage)

    agent = create_react_agent(model=model, tools=tool_node, prompt=prompt, checkpointer=checkpointer)  # type: ignore[arg-type]
    return AgentSession(agent=agent, thread_id=tid)
