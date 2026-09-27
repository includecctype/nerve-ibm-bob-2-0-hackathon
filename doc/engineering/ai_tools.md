# AI Tools

> Registry: `backend/ai_tool/tool_registry.py`. This note lists every tool as
> implemented, its real signature, and **where it runs**.

## Tool sets

```python
# main agent (orchestrator) — no file/shell/web tools
[makeQuestion, processNewTask, executeCurrentTask, checkRunningTasks]

# sub-agent (executor)
[write, edit, listDir, readFile, grep, glob, webSearch, webFetch, terminalCommand]
```

The main agent only manages the graph and asks questions. Sub-agents do the work
and cannot ask the user (no `makeQuestion`).

`getSubAgentTools(sid)` returns file tools that run against the session's OCI
folder for web clients (`makeOciFileTools`) or forwarded to the CLI for local
execution (`makeFileTool`), plus `webSearch`/`webFetch`.

## Execution location

| Tool | Runs on | Why |
|---|---|---|
| `write`, `edit`, `readFile`, `listDir`, `grep`, `glob`, `terminalCommand` (CLI) | **The user's machine** | Forwarded over Socket.IO via `backend/ai_tool/delegation/`; implemented in `terminal/src/tool/` |
| `write`, `edit`, `readFile`, `listDir`, `grep`, `glob`, `terminalCommand` (web) | **Backend, on the session's OCI folder** | `backend/ai_tool/file_ops/tool.py` |
| `webSearch`, `webFetch` | **Backend** | Need the hosted `WEB_SEARCH_API` and network egress |
| `makeQuestion` | Backend (emits over socket) | Main agent only |
| `processNewTask`, `executeCurrentTask`, `checkRunningTasks` | Backend (graph) | Main agent only |

For CLI sessions the server never touches the user's disk. Paths are confined
client-side by `terminal/src/tool/workspace.ts::resolveSafePath` (workspace =
`process.cwd()`); escaping paths return `Error: path outside workspace`.

## Main-agent tools

### `processNewTask(categories: list[dict]) -> str`
Replace the pending graph with the complete morphed graph for the turn.
- Each item: `{"name": str, "tasks": [str], "depends_on": [str]}`.
- Validated structurally (`validateCategoryInput`), auto-repaired (`repairGraph`:
  rename colliding names, drop unknown/self deps), then cycle-checked
  (`validateGraph`, Kahn). Only cycles error out.
- Merges via `mergeCategoryLists` (the incoming list wins; exact-dedupe inside
  it), cascades blocked categories, emits `task_update`.
- **Never includes running or finished categories.**

### `executeCurrentTask() -> str`
Start or join the background execution pass (`startExecution`). Non-blocking:
- returns `"Execution started in the background. …"` when it starts a pass;
- returns `"Execution already in progress; new categories join the running pass."`
  when one is already running;
- returns `"No tasks to execute."` when there is nothing ready.

Results are delivered later as a dedicated execution-results turn.

### `checkRunningTasks() -> str`
One line per running category with per-task status, or the list of pending
categories. Use before planning more work.

### `makeQuestion(question_json: str) -> str`
- Input: JSON array `[{"question": "...", "options": ["a","b"]}, ...]`.
- Enforces **2–5 non-empty options** per question. Never include an "other"
  option — the client appends a write-in "other".
- Emits `questionnaire` and returns immediately; the answer arrives later as
  `questionnaire_answers`.

## Sub-agent tools

### Local (CLI, forwarded)

| Tool | Signature | Local notes |
|---|---|---|
| `write` | `(file_path, content, mode="overwrite")` | `mode` must be `overwrite`/`append`; creates parent dirs |
| `edit` | `(file_path, old_string, new_string)` | `old_string` must be unique; fails loudly with the match count otherwise |
| `readFile` | `(file_path, offset=1, limit=500)` | Line-numbered `N: content`; 100 KB read cap; notes remaining lines |
| `listDir` | `(directory_path)` | ASCII tree; skips ignored dirs |
| `grep` | `(pattern, path=".", file_glob=None)` | Up to 50 matches `file:line: content`; skips heavy dirs |
| `glob` | `(pattern, path=".")` | Up to 100 paths, newest first |
| `terminalCommand` | `(bash_command)` | `exec` with `cwd=process.cwd()`, 30 s kill, ~8000-char output cap; returns `Exit code: N` + stdout/stderr |

Limits (`terminal/src/systemconfig/limits.ts`): `GREP_MAX_MATCHES=50`,
`GLOB_MAX_RESULTS=100`, `MAX_READ_BYTES=100000`, `OUTPUT_CHAR_CAP=8000`,
`COMMAND_TIMEOUT_MS=30000`. Ignored dirs: `.git, node_modules, __pycache__,
.venv, venv, dist, build, .next, .pytest_cache, .ruff_cache`.

### Server-side (web, OCI folder)

Same tool names and signatures as the local set, implemented in
`backend/ai_tool/file_ops/tool.py` against the session's OCI folder. Limits
(`backend/storage/service/storage_limits.py`): `MAX_READ_BYTES=100_000`,
`DEFAULT_READ_LIMIT=500`, `GREP_MAX_MATCHES=50`, `GLOB_MAX_RESULTS=100`,
`MAX_TREE_DEPTH=4`, `MAX_TREE_ENTRIES=200`, `LIST_PAGE_LIMIT=500`,
`LIST_MAX_PAGES=20`.

### Backend (web)

| Tool | Signature | Behavior |
|---|---|---|
| `webSearch` | `(search_word)` | Exa, 5 results with title/URL/highlight/500-char excerpt; `Error: WEB_SEARCH_API is not configured` if missing |
| `webFetch` | `(url)` | `http(s)` only; HTML→text (scripts/styles stripped); 15 s timeout; body capped at 200 KB |

## Error contract

Every tool returns a **string**. Failures are returned as `Error: ...` rather
than raised to the agent loop, and `ToolErrorMiddleware`
(`backend/model/model_client.py`) converts any Python exception into a
recoverable message telling the model to adjust once or report and continue.
Forwarded calls time out at 30 s and return an error string so the model is never
left waiting.
