# Backend Reference

Root: `backend/`. Python `>=3.13`, managed with **uv**. For behavior see
[pipelines](pipelines.md); for the protocol see
[socket_protocol](socket_protocol.md).

## Entry & gateway

| File | Responsibility | Key symbols |
|---|---|---|
| `main.py` | Entrypoint; registers handlers, then `uvicorn.run(app, 0.0.0.0:8000)` | — |
| `gateway/config.py` | Socket.IO server + ASGI app; per-session memory model; allowed origins | `sio`, `app`, `AgentBinding`, `ConnectedUserMemory`, `connected_users`, `allowedOrigins` |
| `gateway/connect/socket_handlers.py` | Socket.IO handlers | `connect`, `user_prompt`, `questionnaire_answers`, `agent_error_response`, `tool_result`, `disconnect`, `promptRateLimited` |
| `gateway/agent/invoke_main_agent.py` | Run one main-agent turn under the prompt lock, with retry/timeout and timing logs | `invokeMainAgent`, `describeTurnSteps` |
| `gateway/agent/with_task_context.py` | Append the live task-graph snapshot to the system prompt | `withTaskContext` |

## Prompts

| File | Purpose |
|---|---|
| `model/prompt/base.py` | `BASE_SYSTEM_PROMPT` for the main orchestrator (graph rules, parallel tool calls, background execution) |
| `model/prompt/sub_agent.py` | `SUB_AGENT_SYSTEM_PROMPT` for executors (tool list, edit-over-write, answer-in-report, never ask the user) |
| `gateway/prompt/user_prompt.py` | Prompt used when a normal user message arrives |
| `gateway/prompt/questionnaire.py` | Prompt used to turn answers into a plan |
| `gateway/prompt/give_up.py` | Prompt forcing a tool-free, plain-text reply after provider failure |
| `gateway/prompt/execution_results.py` | `EXECUTION_RESULTS_SYSTEM` — report a finished background pass |
| `gateway/prompt/task_context.py` | `TASK_CONTEXT_SUFFIX` template injected by `withTaskContext` |

## Model & agents

| File | Responsibility | Key symbols |
|---|---|---|
| `model/model_client.py` | Build a cached chat model and a LangChain agent; provided-model and watsonx keys; tool-error middleware | `initModel`, `buildAgent`, `toolErrorMiddleware`, `model_cache`, `PROVIDER_MAP`, `providedModelKey`, `PROVIDED_AGENT_ID`, `WATSONX_AGENT_ID`, `watsonxSettings` |
| `model/main_agent.py` | Main agent factory (agent ids 1–7) | `createMainAgent` |
| `model/sub_agent.py` | Sub-agent factory (same ids) | `createSubAgent` |
| `model/agent_session.py` | Thin wrapper around a compiled agent + `thread_id` | `AgentSession` |

`initModel` provider map (`agent_id → provider/model`): 1 IBM
`ibm/granite-3-3-8b-instruct` (watsonx.ai, operator-funded), 2 Groq
`openai/gpt-oss-120b`, 3 Anthropic `claude-fable-5`, 4 Baseten
`moonshotai/Kimi-K2.6`, 5 DeepSeek `deepseek-chat`, 6 DeepSeek `deepseek-flash`
(provided, web-only), 7 OpenRouter `auto`. Models are cached by
`(agent_id, api_key)`.

## Task graph & scheduling (`ai_tool/task/`)

| File | Purpose | Key symbols |
|---|---|---|
| `task_models.py` | Pydantic models | `TaskItem`, `TaskCategory`, `TaskStatus` |
| `task_graph.py` | Pure graph logic | `validateCategoryInput`, `repairGraph`, `validateGraph`, `buildStatusMap`, `readyCategories`, `cascadeBlocked`, `normalizeName`, `truncateResult` |
| `merge_task_lists.py` | Pending-list replacement (authoritative, no LLM) | `mergeCategoryLists` |
| `task_runner.py` | Event-driven scheduler | `runTaskGraph`, `runCategory` |
| `execution_results.py` | Build the pass summary for the results turn | `buildExecutionResults` |
| `prompt_format.py` | Render graph/task context for prompts | `buildTaskPrompt`, `buildGraphOverview`, `format{Pending,Running,Finished}ForPrompt` |
| `tool.py` | Main-agent graph tools | `makeTaskTools`, `processNewTask`, `executeCurrentTask`, `checkRunningTasks` |
| `emit/task.py` | Serialize + emit graph | `updateTaskDisplay`, `categoryToWire`, `sessionCategoriesToWire` |
| `emit/sub_agent.py` | Sub-agent progress line | `subAgentResponse` |
| `emit/planning_placeholder.py` | Transient "planning" row | `emitPlanningPlaceholder`, `isPlaceholderDescription` |

## Tools (`ai_tool/`)

| File | Purpose | Key symbols |
|---|---|---|
| `tool_registry.py` | The two tool sets | `getMainAgentTools(sid)`, `getSubAgentTools(sid)`, `createSubAgentWithTools` |
| `delegation/tool.py` | Forwarded file/shell tool wrappers (CLI) | `makeFileTool` (→ `write`, `edit`, `readFile`, `listDir`, `grep`, `glob`, `terminalCommand`) |
| `delegation/pending_requests/pending_requests.py` | Round-trip future channel | `requestTool`, `resolveToolResult`, `cancelPendingRequests` |
| `file_ops/tool.py` | Server-side (OCI) file/shell tools (web) | `makeOciFileTools` (same tool names) |
| `question/tool.py` | `makeQuestion` (main agent only) | `makeQuestionTool` |
| `question/emit.py` | Emit questionnaire | `sendStructuredQuestion` |
| `network/tool.py` | Backend-executed web tools | `webSearch`, `webFetch`, `TextExtractor` |
| `network/web_search_sync.py` | Exa search call | `webSearchSync` |

## State, rate limiting, retry, DTO, observability

| File | Purpose | Key symbols |
|---|---|---|
| `gateway/state/prompt_queue.py` | One prompt worker per session; turn kinds | `startPromptQueue`, `enqueuePrompt`, `stopPromptQueue`, `PROMPT_KIND_*` |
| `gateway/state/exec_scheduler.py` | Detached execution pass + planning gate | `startExecution`, `stopExecution`, `isExecutionRunning`, `beginPlanning`, `endPlanning`, `waitPlanningIdle` |
| `gateway/state/session_locks.py` | Prompt lock + per-session execution lock | `acquirePromptLock`, `finishPromptLock`, `sidLock`, `execSidLock` |
| `gateway/state/runtime_state.py` | Module-level mutable state | `sid_locks`, `exec_locks`, error bounce/cooldown maps |
| `gateway/ratelimit/inbound_limiter.py` | Per-IP sliding-window limiter | `SlidingWindowLimiter`, `clientIp`, `connect_limiter`, `prompt_limiter` |
| `gateway/retry/rate_limit.py` | 429-aware retry with per-attempt timeout | `callWithRateLimitRetry`, `isRateLimitError`, `retryAfterSeconds` |
| `gateway/retry/agent_error.py` | Error emit + give-up counters/cooldown | `emitAgentError`, `bumpErrorBounce`, `resetErrorBounce`, `clearErrorState` |
| `gateway/dto/task_auth.py` | Parse wire categories; downgrade running→pending; split terminal | `normalizeCategories`, `splitCategories`, `parseTaskItems` |
| `gateway/dto/legacy_task_migration.py` | Collapse legacy flat lists into one category | `normalizeLegacyTasks` |
| `gateway/observability/timing.py` | `[timing]` logs | `logStep`, `elapsedMsSince`, `timedStep` |

## Storage (`gateway/storage/`, `storage/`)

| File | Purpose | Key symbols |
|---|---|---|
| `gateway/storage/storage_handlers.py` | Socket handlers for the web file panes | `onStorageList`, `onStorageRead`, `onStorageWrite`, `onStorageDelete` |
| `gateway/storage/storage_events.py` | Storage emitters + folder lookup | `storageFolder`, `emitStorageChange`, `emitStorageError` |
| `storage/oci/oci_client.py` | OCI API-key client (all from env) | — |
| `storage/oci/object_ops.py` | Object put/get/delete/list | — |
| `storage/oci/session_folder.py` | `YYYY-MM-DD:<uuid>` folder per web visit | `makeSessionFolder` |
| `storage/oci/cleanup.py` | Standalone 6-hour sweep of old session folders | `main` |
| `storage/service/storage_service.py` | List/read/write/delete on the bucket | `ensureSession`, `listTree`, `readRaw`, `readText`, `writeText`, `deletePath`, `fileExists` |
| `storage/service/storage_limits.py` | Storage caps | `MAX_READ_BYTES`, `LIST_PAGE_LIMIT`, `IGNORED_DIRS`, … |

## Config

| File | Contents |
|---|---|
| `systemconfig/limits.py` | `MAX_MODEL_ATTEMPTS=3`, `DEFAULT_RETRY_AFTER_SECONDS=10`, `MAX_GIVE_UP_BOUNCES=2`, `ERROR_COOLDOWN_SECONDS=15`, `MODEL_CALL_TIMEOUT_SECONDS=60`, `AGENT_TURN_TIMEOUT_SECONDS=600`, `SUBAGENT_TIMEOUT_SECONDS=120`, `TOOL_TIMEOUT_SECONDS=30`, `COMMAND_TIMEOUT_SECONDS=30`, `DEFAULT_READ_LIMIT=500`, `WEB_FETCH_TIMEOUT_SECONDS=15`, `WEB_FETCH_MAX_BYTES=200000`, `RATE_LIMIT_CONNECT_MAX=30`, `RATE_LIMIT_CONNECT_WINDOW_SECONDS=60`, `RATE_LIMIT_PROMPT_MAX=20`, `RATE_LIMIT_PROMPT_WINDOW_SECONDS=14400` |
| `systemconfig/websearch.py` | `WEB_SEARCH_API = os.getenv("WEB_SEARCH_API")` |

## Request path in one line

`socket event → promptRateLimited → enqueuePrompt → prompt worker → invokeMainAgent → main agent tool calls → processNewTask / executeCurrentTask → startExecution → runTaskGraph → sub-agents → forwarded tools (CLI) or OCI tools/web tools (backend) → task_update + subagent_response → main_agent_response → results turn`.
