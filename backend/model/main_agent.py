from __future__ import annotations

import uuid

from model.agent_session import AgentSession
from model.model_client import buildAgent
from model.prompt.base import BASE_SYSTEM_PROMPT


def createMainAgent(
    agent_id: int,
    api_key: str,
    tools: list,
    thread_id: str | None = None,
) -> AgentSession:
    tid = thread_id or str(uuid.uuid4())
    session = buildAgent(
        agent_id=agent_id,
        api_key=api_key,
        tools=tools,
        system_prompt=BASE_SYSTEM_PROMPT,
        thread_id=tid,
    )
    return session
