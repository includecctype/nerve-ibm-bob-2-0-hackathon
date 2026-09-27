from __future__ import annotations

import os
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
    1: ("ibm", "ibm/granite-3-3-8b-instruct"),
    2: ("groq", "openai/gpt-oss-120b"),
    3: ("anthropic", "claude-fable-5"),
    4: ("baseten", "moonshotai/Kimi-K2.6"),
    5: ("deepseek", "deepseek-chat"),
    6: ("deepseek", "deepseek-flash"),
    7: ("openrouter", "auto"),
}

# Model 6 is "provided" and web-only: the operator funds it, so its key comes
# from the environment instead of the client, and the funded key is never sent
# to clients.
PROVIDED_AGENT_ID = 6
PROVIDED_MODEL_ENV = "PROVIDED_MODEL_KEY"

# Model 1 runs IBM Granite through watsonx.ai. The operator funds it too: the
# credentials always come from the environment, so clients never handle them.
WATSONX_AGENT_ID = 1
WATSONX_API_KEY_ENV = "WATSONX_API_KEY"
WATSONX_PROJECT_ENV = "WATSONX_PROJECT_ID"
WATSONX_URL_ENV = "WATSONX_URL"
WATSONX_DEFAULT_URL = "https://us-south.ml.cloud.ibm.com"
WATSONX_MAX_NEW_TOKENS = 2048


def providedModelKey() -> str:
    key = os.getenv(PROVIDED_MODEL_ENV, "").strip()
    if not key:
        raise ValueError(f"{PROVIDED_MODEL_ENV} is not set")
    return key


def watsonxSettings() -> tuple[str, str, str]:
    """Return (apikey, project_id, url) for watsonx.ai, all from the environment."""
    apikey = os.getenv(WATSONX_API_KEY_ENV, "").strip()
    project_id = os.getenv(WATSONX_PROJECT_ENV, "").strip()
    if not apikey or not project_id:
        raise ValueError(f"{WATSONX_API_KEY_ENV} and {WATSONX_PROJECT_ENV} must be set")
    url = os.getenv(WATSONX_URL_ENV, "").strip() or WATSONX_DEFAULT_URL
    return apikey, project_id, url


def buildWatsonxModel(model_name: str) -> BaseChatModel:
    from langchain_ibm import ChatWatsonx

    apikey, project_id, url = watsonxSettings()
    return ChatWatsonx(
        model_id=model_name,
        apikey=apikey,
        project_id=project_id,
        url=url,
        params={"max_new_tokens": WATSONX_MAX_NEW_TOKENS},
    )


def initModel(agent_id: int, api_key: str) -> BaseChatModel:
    if agent_id == PROVIDED_AGENT_ID:
        api_key = providedModelKey()
    elif agent_id == WATSONX_AGENT_ID:
        api_key, _, _ = watsonxSettings()

    cache_key = (agent_id, api_key)
    if cache_key in model_cache:
        return model_cache[cache_key]

    if agent_id not in PROVIDER_MAP:
        raise ValueError(f"Invalid agent_id: {agent_id}")
    provider, model_name = PROVIDER_MAP[agent_id]

    if provider == "ibm":
        model = buildWatsonxModel(model_name)
    else:
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
