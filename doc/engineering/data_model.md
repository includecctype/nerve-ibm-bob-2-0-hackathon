# Data Model

> Source of truth: `backend/ai_tool/task/task_models.py`,
> `backend/gateway/config.py`, `terminal/src/dto/wire.ts`,
> `terminal/src/systemconfig/file.ts`.

## Task graph (the core model)

Backend Pydantic models (`backend/ai_tool/task/task_models.py`):

```python
TaskStatus = Literal["pending", "running", "done", "failed", "blocked"]
TERMINAL_STATUSES = ("done", "failed", "blocked")   # category-level

class TaskItem(BaseModel):
    description: str
    status: TaskStatus = "pending"
    result: str = ""

class TaskCategory(BaseModel):
    name: str                          # free-form, unique (normalized: lower, collapsed whitespace)
    tasks: list[TaskItem] = []         # run SEQUENTIALLY, in order
    depends_on: list[str] = []         # category names; CATEGORIES run in PARALLEL when ready
    status: TaskStatus = "pending"
```

Rules:

- A **category** is an independent workstream/phase. It becomes runnable the
  moment **all** `depends_on` are `done`.
- A **task** is one job description; tasks inside a category run one after
  another, and each task's result is fed into the next task of the same category
  (`buildTaskPrompt` in `backend/ai_tool/task/prompt_format.py`).
- `depends_on` must form a **DAG** (Kahn's algorithm in `validateGraph`).
  Unknown/self deps are dropped by `repairGraph`; cycles are an error.
- A `failed` or `blocked` category **cascades** `blocked` to its dependents
  (`cascadeBlocked`).
- `normalizeName` = strip + lowercase + collapse whitespace, used for all name
  matching.

### Status meanings

| Category status | Meaning |
|---|---|
| `pending` | Not started; waiting on dependencies or dispatch |
| `running` | Its tasks are executing; **immutable to new prompts** |
| `done` | All tasks finished |
| `failed` | A task/model call failed after retries |
| `blocked` | A dependency failed/was blocked (transitive) |

| Task status | Meaning |
|---|---|
| `pending` / `running` / `done` / `failed` | Same idea, per task inside a category |

## Backend session memory

`ConnectedUserMemory` (`backend/gateway/config.py`), one per socket id:

```python
class ConnectedUserMemory(BaseModel):
    api_key: str
    main_agent: AgentBinding          # {agent_id, AgentSession}
    pending_categories: list[TaskCategory]
    running_categories: list[TaskCategory]
    completed_categories: list[TaskCategory]   # done/failed/blocked, kept for depends_on lookups
    history: list[dict]
    last_user_request: str            # passed to sub-agents as overall context
    client_kind: str = "cli"          # "cli" or "web"
    client_ip: str = ""               # used by the inbound rate limiter
    storage_folder: str | None = None # OCI folder for web sessions, None for CLI
```

`connected_users: dict[str, ConnectedUserMemory]` is **in process**; the client
holds the saved copy and reconnects with it.

## On-disk config (CLI)

Path: `<cwd>/user_config/config.json` (`terminal/src/save/config_path.ts`,
`terminal/src/systemconfig/file.ts`). Default shape:

```json
{
  "api_key": { "1": "sk-..." },
  "main_agent_id": 1,
  "session": {
    "<uuid>": {
      "categories": [TaskCategoryDTO],
      "history": [DisplayHistoryDTO],
      "last_updated": 1726000000000
    }
  }
}
```

Notes:

- `api_key` and `main_agent_id` are global; `session` holds named saved sessions.
- On first run `ensureConfigFile` writes the default; `readConfig` starts a **new
  random `session_id`** (not committed) unless `/session` is used.
- `commitSession()` marks a session to be saved on the next write; writes are
  serialized and debounced by 50 ms (`config_writer.ts`).
- `main_agent_id` is validated against `MODEL_OPTIONS`; invalid → fallback `1`.
- The web workspace stores the same shape in `localStorage`; its default model is
  the provided model 6.

## Wire DTOs (client side, `terminal/src/dto/wire.ts`)

```ts
type TaskItemStatus = "pending" | "running" | "done" | "failed";
type TaskCategoryStatus = "pending" | "running" | "done" | "failed" | "blocked";

type TaskItemDTO     = { description: string; status: TaskItemStatus; result: string };
type TaskCategoryDTO = { name: string; status: TaskCategoryStatus; depends_on: string[]; tasks: TaskItemDTO[] };
type TaskUpdatePayload = { categories: TaskCategoryDTO[] };

type DisplayHistoryDTO = { role: string; content: string };
type StructuredQuestionDTO = { question: string; options: string[] };
type QuestionnaireAnswerDTO = { question: string; answer: string };
type SubagentResponseDTO = { category: string; status: "done" | "failed"; report: string };
type ToolRequestDTO  = { id: string; tool: string; args: Record<string, unknown> };
type ToolResultDTO   = { id: string; ok: boolean; output: string };
type RateLimitedDTO  = { retry_after: number };
type SessionData     = { categories: TaskCategoryDTO[]; history: DisplayHistoryDTO[]; last_updated?: number };
```

## Wire format emitted by the backend

`categoryToWire` (`backend/ai_tool/task/emit/task.py`) serializes categories as:

```json
{
  "name": "research",
  "status": "running",
  "depends_on": [],
  "tasks": [{ "description": "...", "status": "running", "result": "" }]
}
```

`sessionCategoriesToWire` orders them **running → pending → completed** before
emission. The client's `saveTaskUpdate` replaces its whole `user_data.categories`
array with the payload, then the UI re-renders.

## Legacy shapes (still handled)

Older sessions/clients used flat lists:

- `pending_task: { simultaneous: boolean, description: string }[]` or
  `[boolean, string][]`
- `running_task: { model_id: number, description: string }[]` or
  `[number, string][]`

On reconnect the backend collapses them into a single category named `tasks`
(`backend/gateway/dto/legacy_task_migration.py`); the client does the same when
reading old saved sessions (`terminal/src/dto/migrate_session.ts`). On restore,
any `running` category/task is downgraded to `pending`
(`backend/gateway/dto/task_auth.py`) because nothing is actually running after a
reconnect.

## Transient UI placeholder

While the model plans, the backend emits a synthetic category named `planning`
with the task `Planning your request…`
(`backend/ai_tool/task/emit/planning_placeholder.py`). It is filtered out of
restored/persisted state via `isPlaceholderDescription`.
