# Architecture

Components, runtime topology, and the paths work takes through the system.

## Components

```
┌─────────────────────────────┐        Socket.IO         ┌──────────────────────────────────┐
│  terminal/  (nerve CLI)     │  ⇄  (events + ack)   ⇄   │  backend/  (Python 3.13 / uv)    │
│  Node 22 · Ink/React TUI    │                          │  python-socketio ASGI app        │
│                             │                          │                                  │
│  ┌───────────────────────┐  │  tool_request ─────────► │  main agent  (LangChain)         │
│  │ user_config/config.json│ │  ◄───────── tool_result  │   ├─ processNewTask              │
│  │  api_key, main_agent_id│ │                          │   ├─ executeCurrentTask          │
│  │  session{}             │ │                          │   ├─ checkRunningTasks           │
│  └───────────────────────┘  │                          │   └─ makeQuestion                │
│  ┌───────────────────────┐  │                          │                                  │
│  │ tool executor         │  │                          │  task graph per session:         │
│  │  (LOCAL file/shell)    │  │                          │   pending / running / completed  │
│  └───────────────────────┘  │                          │                                  │
│                             │                          │  sub agents (one per task)       │
└─────────────────────────────┘                          │   → web tools run here           │
                                                          │   → file/shell forwarded to CLI  │
                                                          │   → or run on the OCI folder     │
                                                          └──────────────────────────────────┘
```

- **Backend** — coordination, model calls, and web tools. Holds one
  `ConnectedUserMemory` per connected socket (`backend/gateway/config.py`).
- **CLI** — UI, persistence, and the actual execution of file/shell tools in the
  user's workspace.
- **Web workspace** — the same Ink UI plus an OCI-backed file explorer and
  viewer; file/shell tools run server-side against the session folder.
- **Transport** — Socket.IO (WebSocket with HTTP long-polling fallback). The
  client points at a gateway with `NERVE_BACKEND_URL`.

## Key design decision: execution runs on the user's machine

For CLI sessions, file and shell tools (`write`, `edit`, `readFile`, `listDir`,
`grep`, `glob`, `terminalCommand`) are never executed on the server. The backend
wrapper tool emits `tool_request` and awaits the CLI's `tool_result`:

- backend: `backend/ai_tool/delegation/tool.py` →
  `backend/ai_tool/delegation/pending_requests/pending_requests.py::requestTool`
  (a future keyed by `(sid, request_id)`).
- CLI: `terminal/src/socket/listener.ts` handles `tool_request` →
  `terminal/src/tool/executor.ts` → `terminal/src/tool/*`.

Consequences: secrets and file contents stay on the user's laptop; the server
only needs the model API key for the model call (supplied by the CLI at connect
time). Web tools (`webSearch`, `webFetch`) run server-side because they need the
hosted search key and network egress.

For **web** sessions, the same tool names are implemented server-side against
the session's OCI folder (`backend/ai_tool/file_ops/tool.py`), so files the
agent writes appear in the explorer.

## Runtime topology & deployment

| Piece | Runtime | Deploy |
|---|---|---|
| Backend | Python `>=3.13`, `uv`, Uvicorn | `backend/Dockerfile` (`python:3.13-slim` + uv); reference host Render |
| CLI | Node 22, pnpm, `tsup` → `dist/app.js` | npm package `nerves-cli`, bin `nerve` |
| Web | Vite + React 19, static build | any static host; `.github/workflows/web-pages.yml` publishes GitHub Pages |
| Dev orchestration | `justfile` | `just backend`, `just terminal`, `just web`, `just run` |

Reference deployment: `https://nerve-ibm-bob-2-0-hackathon.onrender.com`
(override with `NERVE_BACKEND_URL`).

## Agent construction

`buildAgent` (`backend/model/model_client.py`) wraps
`langchain.agents.create_agent` with:

- a model from `initModel(agent_id, api_key)` (6 providers; see
  [tech_stack](tech_stack.md)),
- `InMemorySaver` checkpointer + a `thread_id`,
- a `ToolErrorMiddleware` that returns a recoverable string to the model on tool
  failure,
- the system prompt (`backend/model/prompt/base.py` for main,
  `backend/model/prompt/sub_agent.py` for sub-agents).

The main agent is created once per connection (`createMainAgent`); a fresh
sub-agent is created per task execution (category tools →
`createSubAgentWithTools`), because each task is an isolated brief.

Model 6 is **provided** and **web-only**: it is funded by the operator through
`PROVIDED_MODEL_KEY`, the key is read server-side and never sent to clients, and
`connect` refuses it for non-web clients.

## Prompt handling and background execution

- `connect` starts one prompt worker per session (`gateway/state/prompt_queue.py`).
  User prompts, questionnaire answers, and error bounce-backs are enqueued as
  turns; the worker runs them **one at a time**, so turns never overlap on the
  shared agent session and graph.
- A turn calls `invokeMainAgent`, which has the main agent plan (and morph the
  pending graph) via `processNewTask` and start/join execution via
  `executeCurrentTask`.
- Task-graph execution is **detached** (`gateway/state/exec_scheduler.py`): it
  runs in a background task, `executeCurrentTask` returns immediately, and the
  next prompt is planned right away. The background pass re-reads
  `pending_categories` each iteration, so categories a later prompt morphs in
  **join the running pass**.
- A **planning gate** (`beginPlanning` / `waitPlanningIdle`) keeps the pass from
  finishing while a prompt turn is still morphing, so mid-flight work is never
  stranded.
- When the pass drains it builds a results message
  (`ai_tool/task/execution_results.py`) and enqueues an **execution-results
  turn**, which the main agent reports to the user as a separate message.

## In-flight work immutability

The invariant that makes "keep typing prompts" safe:

- `processNewTask` only replaces `pending_categories`; `runTaskGraph` only
  dequeues from pending.
- `validateGraph`/`repairGraph` reject or rename any incoming category whose name
  collides with a running one.
- `connected_users[sid].running_categories` is therefore never touched by a new
  prompt.

## Error handling & resilience

- Per model call: `callWithRateLimitRetry` — 3 attempts, 429-aware
  `Retry-After`, per-attempt timeout (`backend/gateway/retry/rate_limit.py`).
- Agent turn caps: `MODEL_CALL_TIMEOUT_SECONDS=60`,
  `AGENT_TURN_TIMEOUT_SECONDS=600`, `SUBAGENT_TIMEOUT_SECONDS=120`
  (`backend/systemconfig/limits.py`).
- Provider failure after retries → `emitAgentError`; the client bounces
  `agent_error_response`; the main agent gets a limited "give up tools and ask
  plainly" loop (`MAX_GIVE_UP_BOUNCES=2`, `ERROR_COOLDOWN_SECONDS=15`).
- Session locks: one prompt worker per session serialises planning turns; the
  background pass holds a per-session execution lock so only one pass runs.
- Disconnect: pending forwarded tool calls are failed with a clear error, the
  prompt worker and execution pass are stopped, and the session is dropped
  (`cancelPendingRequests`, `stopPromptQueue`, `disconnect` handler).

## Rate limits

Per client IP (`backend/systemconfig/limits.py`, enforced in
`gateway/connect/socket_handlers.py`):

- **Connect:** 30 connections / 60 s.
- **Prompts:** 20 prompts / 4 h (covers user prompts, questionnaire answers, and
  bounce-backs). A throttled client receives `rate_limited {retry_after}`.

## Where state lives

| State | Location | Lifetime |
|---|---|---|
| API keys, model choice | client config (`user_config/config.json` or localStorage) | durable (per workspace) |
| Saved sessions (categories + history) | client config | durable |
| Task graph, main agent, history | backend `connected_users[sid]` | in-process, per connection |
| In-flight forwarded tool calls | backend `pending_requests` dict | per call |
| Prompt queue / execution pass | backend `prompt_queue` / `exec_scheduler` | per connection |

See [data_model](data_model.md) for shapes.

## File map

```
backend/
  main.py                     entry: registers handlers, uvicorn(gateway.config.app)
  gateway/
    config.py                 sio, app, ConnectedUserMemory, connected_users
    connect/socket_handlers.py   event handlers (connect/user_prompt/...)
    agent/                    invokeMainAgent, withTaskContext
    prompt/                   system prompts + task-context + exec-results suffix
    retry/                    rate-limit + error/give-up
    ratelimit/                per-IP inbound limiter
    state/                    prompt_queue, exec_scheduler, locks, counters
    storage/                  OCI storage socket handlers/emitters
    dto/                      wire parsing + legacy migration
    observability/timing.py   [timing] logs
  model/                      agent factory, sessions, provider selection, prompts
  ai_tool/
    task/                     graph logic, scheduler, tools, emit, results
    delegation/               forwarded file/shell tools + pending requests
    file_ops/                 server-side (OCI) file/shell tools
    question/                 makeQuestion
    network/                  webSearch / webFetch
    tool_registry.py          the main/sub tool sets
  storage/                    OCI client, service, session folders, cleanup
  systemconfig/               limits.py, websearch.py
terminal/
  src/app.tsx                 TUI composition + input handling
  src/socket/                 client, listener, handler_registry, emitters
  src/tool/                   local file/shell executor + workspace sandbox
  src/save/                   config read/write/create
  src/session/user_data.ts    in-memory user state
  src/command/                slash commands + overlays
  src/ui/                     panes, viewport, prompt box, theme
  src/systemconfig/           limits.ts, model.ts, file.ts
web/
  src/ide_shell.tsx           three-pane layout
  src/terminal/               Ink UI ported through ink-web
  src/storage/                storage socket client + React hooks
  src/file_explorer/, file_viewer/
```
