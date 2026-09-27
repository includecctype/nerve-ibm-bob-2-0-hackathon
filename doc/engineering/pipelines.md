# Pipelines

Code-accurate flows. Terms: a **category** is an independent workstream with
`depends_on`; **tasks** inside a category run sequentially. See
[data_model](data_model.md) and [socket_protocol](socket_protocol.md).

## 1) Startup / connect pipeline

```
CLI starts
  ensureConfigFile()                 create user_config/config.json if absent
  readConfig()                       load api_keys + main_agent_id; start a NEW uncommitted session id
  setUserData(...)                   render saved graph from user_data
  connectSocket()                    socket.io auth = {api_keys, main_agent_id, client_kind, categories, history, api_key}
backend connect handler
  connect_limiter.allow(client_ip)   per-IP connection throttle (30 / 60s)
  validate api_key and main_agent_id (1..6); refuse provided (id 6) for non-web clients
  provided client  → api_key = providedModelKey() from the environment
  normalizeCategories(auth.categories)          OR normalizeLegacyTasks(pending_task, running_task)
  splitCategories()                  terminal (done/failed/blocked) → completed; rest → pending
  cascadeBlocked()                   pre-block dependents of already-failed work
  web client → makeSessionFolder() + ensureSession(...)   (OCI folder; best-effort)
  createMainAgent(...)               build model + LangChain agent with the session history
  startPromptQueue(sid)              one prompt worker for the session
  updateTaskDisplay(sid, ...)        publish the normalised graph
  emit storage_session (web only)    if a storage folder was created
  emit connection_status true|false
```

The client always begins a **new random `session_id`** (uncommitted) until the
first prompt calls `commitSession()`. Resuming a session via `/session` calls
`applySessionChoice`, which flushes, swaps id/graph/history, and reconnects.

> The backend's `connected_users[sid]` is in-process and rebuilt from the
> client's `categories` on each connect.

## 2) Prompt handling pipeline (queue → morph, never mutate running)

Prompts are handled by **one worker per session** so planning turns never
overlap:

```
CLI  user_prompt ─► backend
  promptRateLimited(sid, ip)                    per-IP prompt throttle (20 / 4h)
  resetErrorBounce(sid)
  mem.last_user_request = prompt
  emitPlanningPlaceholder(sid)                  task_update: real graph + "planning" row
  enqueuePrompt(sid, USER_PROMPT_SYSTEM, prompt, kind=user)

worker loop (single-flight):
  beginPlanning(sid)                             close the execution planning gate
  invokeMainAgent(sid, system_prompt, message)
  endPlanning(sid)
```

`invokeMainAgent` runs the main agent for one turn:

```
main agent (one turn):
  • issues [processNewTask(categories), executeCurrentTask()] as parallel tool_calls when idle
  • or only processNewTask when categories are already running
  • then ends the turn (execution results arrive later as their own message)
```

`processNewTask` is the morph step:

1. **Structural validation** — `validateCategoryInput`: non-empty; each
   `{name, tasks, depends_on}` well-formed; duplicate task descriptions within a
   category are dropped.
2. **Repair** — `repairGraph`: rename names colliding with running categories or
   duplicates in the call (`name (2)`), drop self/unknown `depends_on`. Notes are
   returned to the model.
3. **Cycle check** — `validateGraph`: Kahn's algorithm over incoming + running +
   completed; a cycle is an error. Running-name collisions are also rejected here.
4. **Merge** — `mergeCategoryLists(existing_pending, incoming)`: the incoming
   morphed list is authoritative; the pending list is **replaced** (exact-dedupe
   only). Fallback keeps the old list if the model returned nothing usable.
5. **Cascade & commit** — `cascadeBlocked`, then assign
   `user_data.pending_categories`, update `completed_categories`,
   `updateTaskDisplay`.

Key invariant: only `pending_categories` is ever replaced. `running_categories`
is untouchable, so a prompt that arrives mid-execution only reshapes pending
work and its categories join the running pass.

## 3) Task-graph scheduling pipeline (background execution)

`executeCurrentTask` is non-blocking. It calls
`gateway/state/exec_scheduler.py::startExecution(sid)`:

```
startExecution(sid)
  if a pass is already running → return "already in progress; new categories join the running pass"
  else → asyncio.create_task(_runExecution(sid)); return "started in the background"
```

`_runExecution(sid)` holds the per-session execution lock and drains the graph:

```
acquire execSidLock(sid)
loop:
  runTaskGraph(sid)                              # re-reads pending each call
  await waitPlanningIdle(sid)                    # let an in-flight planner morph
  if readyCategories(pending, status_map): continue   # work morphed in → keep draining
  else break
buildExecutionResults(totals, user)
finally: release lock; drop the pass
enqueuePrompt(sid, EXECUTION_RESULTS_SYSTEM, message, kind=results)
```

`runTaskGraph(sid)` — event-driven, no wave barriers:

```
loop:
  status_map = buildStatusMap(pending, running, completed)
  newly_blocked, pending = cascadeBlocked(pending, status_map)   # deps failed/blocked
  ready = readyCategories(pending, status_map)                    # all depends_on == "done"
  for each ready category:
      pending -= it; running += it; asyncio.create_task(runCategory(category))
  if no tasks running:
      recheck pending once (a morph may have arrived during an await); if ready → continue
      else break
  done, _ = await asyncio.wait(running_tasks, FIRST_COMPLETED)
  for each finished task: remove from running, append to completed, record done/failed
```

`runCategory(category)`:

```
for index, item in enumerate(category.tasks):
  item.status = "running"; updateTaskDisplay()
  sub_agent = createSubAgentWithTools(main_agent_id, api_key, sid)   # fresh agent per task
  prompt = buildTaskPrompt(category, index, lookup, last_user_request, graph_overview)
  try:    result = await callWithRateLimitRetry(invoke, timeout=SUBAGENT_TIMEOUT_SECONDS)
  except: item.status=failed; remaining items=failed; category.status=failed
          emitAgentError + subAgentResponse("failed"); return
  item.result = content; item.status = "done"; subAgentResponse("done"); updateTaskDisplay()
category.status = "done"; updateTaskDisplay()
```

`buildTaskPrompt` assembles the overall user request + graph overview +
"task i of n" + prior same-category results + results from `depends_on`
categories. `truncateResult` caps each result at 600 chars. If the pass is
cancelled (e.g. disconnect), `runTaskGraph` cancels its in-flight sub-agent tasks
so nothing is left hanging.

## 4) Execution-results pipeline

When a pass drains, the results are delivered as a **separate prompt turn**:

```
buildExecutionResults(totals, user)
  → summary of completed / failed / blocked categories
  → per-category result excerpts (truncateResult, 600 chars)
  → note if pending categories remain undrained
enqueuePrompt(sid, EXECUTION_RESULTS_SYSTEM, message, kind=results)
main agent (results turn): reports the outcome in plain text, no tools
  → main_agent_response
```

This is why a prompt is acknowledged immediately and the results arrive as a
follow-up message.

## 5) Delegated tool round-trip pipeline (CLI sessions)

```
sub-agent calls e.g. edit(file_path, old, new)
  backend delegation wrapper → requestTool(sid, "edit", args, timeout=30)
      pending_requests[(sid, req_id)] = future
      emit tool_request {id, tool, args}
      await future                                   (timeout → "Error: ... timed out after 30s")
CLI listener receives tool_request
  executeToolRequest → file_ops.editTool            (runs in the user's cwd)
  emit tool_result {id, ok, output}
backend tool_result handler → resolveToolResult → future.set_result(output)
sub-agent receives the output string and continues
```

On disconnect, `cancelPendingRequests` resolves every in-flight future with a
clear error so no sub-agent hangs. This is the only path by which the server
causes file/shell work, and it always happens on the client.

## 6) Storage pipeline (web sessions)

Web sessions run file/shell tools server-side against an OCI folder:

```
agent tool (e.g. write) → ai_tool/file_ops/tool.py
  → storage/service/storage_service.py (list/read/write/delete on the OCI bucket)
  → emitStorageChange(sid, "write", path)         → storage_change
explorer/viewer in the browser:
  storage_list  → storage_listing {request_id, entries}
  storage_read  → storage_content {request_id, path, content, truncated}
  storage_write → storage_result {request_id, ok, path}
  storage_delete→ storage_result {request_id, ok, path, deleted}
  failures      → storage_error {request_id, message}
```

The browser never holds OCI credentials.

## 7) Display pipeline

Two independent output channels, both emitted per client session:

1. **Task graph** — `updateTaskDisplay` emits `task_update {categories}` (ordered
   running → pending → completed). The client replaces its stored categories and
   the Tasks pane renders category markers, `(waits: …)`, spinners, and per-task
   status.
2. **Conversation** — `main_agent_response` (final main-agent text) and
   `subagent_response` (per-category progress line). A transient `planning`
   category is emitted before the model starts so the pane is not blank.

Questions are a separate channel: the main agent emits `questionnaire`, the
client walks the questions one at a time and returns `questionnaire_answers`; the
backend enqueues a `QUESTIONNAIRE_SYSTEM` turn.

## 8) Failure, retry & recovery pipeline

```
every model call (main or sub):
  callWithRateLimitRetry(fn, attempts=3, timeout=MODEL_CALL_TIMEOUT_SECONDS)
    429 → sleep Retry-After → retry; timeout → raise; other → raise
agent turn: AGENT_TURN_TIMEOUT_SECONDS=600, sub-agent: SUBAGENT_TIMEOUT_SECONDS=120
provider failure after retries:
  emitAgentError(sid, msg)  (deduped within ERROR_COOLDOWN_SECONDS=15)
  client shows error → emits agent_error_response
  backend: while bounce count <= MAX_GIVE_UP_BOUNCES (2): enqueue a GIVE_UP_SYSTEM_PROMPT turn
           (answer plainly, no tools)
  past the cap: emit the exact provider text as main_agent_response, no model call
category failure:
  remaining tasks in the category marked failed; category failed; dependents cascade to blocked
disconnect:
  cancel pending tool futures, stop the prompt worker + execution pass, drop session,
  release locks, clear error counters
```

## 9) Session persistence pipeline

```
first prompt  → commitSession()  (marks session savable)
any task_update / main_agent_response / subagent_response / user prompt
              → saveDisplayHistory / saveTaskUpdate → debounced (50ms) writeUserDataToFile()
              → user_config/config.json (api_key, main_agent_id, session{id: {categories, history, last_updated}})
/exit | SIGINT | SIGTERM | socket disconnect
              → flush write queue, then exit / reconnect
/session      → writeUserDataToFile() → swap id/graph/history → socket reconnect
/isession load → migrateSessionCategories() upgrades legacy flat task lists
```
