# Socket.IO Protocol

> Backend handlers: `backend/gateway/connect/socket_handlers.py` and
> `backend/gateway/storage/storage_handlers.py`. Client wiring:
> `terminal/src/socket/listener.ts` (receives), `terminal/src/socket/emitters.ts`
> (sends), `web/src/terminal/socket/*`. Types: `terminal/src/dto/wire.ts`.

## Auth (sent on connect)

```ts
{
  api_key: string,            // key for the selected main model (empty for the provided model)
  main_agent_id: number,      // 1..6
  client_kind: "cli" | "web", // defaults to "cli"
  categories?: TaskCategory[],// current task graph (preferred)
  pending_task?: ...,         // legacy flat list (migrated server-side)
  running_task?: ...,         // legacy flat list (migrated server-side)
  history?: { role: string; content: string }[]
}
```

On success the server emits `connection_status: true`; on any failure (bad/missing
key, provided model requested by a non-web client, rate-limited connect,
exception) it emits `connection_status: false`.

## Backend → client (listeners)

| Event | Payload | Meaning |
|---|---|---|
| `connection_status` | `boolean` | Connected / rejected |
| `main_agent_response` | `string` | Main agent's final text for the turn |
| `subagent_response` | `{ category, status: "done"\|"failed", report }` | Progress line for a category |
| `task_update` | `{ categories: TaskCategory[] }` | Full graph snapshot; client replaces its stored categories and re-renders the Tasks pane |
| `questionnaire` | `StructuredQuestion[]` → `{ question, options[] }` | Structured questions from the main agent |
| `agent_error` | `string` | Provider/model error after retries; client shows it and auto-bounces |
| `rate_limited` | `{ retry_after: number }` | Prompt rejected by the per-IP limit; seconds until a retry is allowed |
| `tool_request` | `{ id, tool, args }` | A file/shell call to execute **on the user's machine**; tools: `write`, `edit`, `readFile`, `listDir`, `grep`, `glob`, `terminalCommand` |
| `storage_session` | `{ folder: string }` | OCI session folder for a web session (web only) |
| `storage_listing` | `{ request_id, path, entries: StorageEntry[] }` | Directory listing response |
| `storage_content` | `{ request_id, path, content, truncated }` | File content response |
| `storage_result` | `{ request_id, ok, path, deleted? }` | Write/delete acknowledgment |
| `storage_error` | `{ request_id, message }` | Storage request failed |
| `storage_change` | `{ op, path }` | A file changed (agent or client) |

## Client → backend (emits)

| Event | Payload | Meaning |
|---|---|---|
| `user_prompt` | `string` | User's prompt (queued as a planning turn; also triggers a planning placeholder) |
| `questionnaire_answers` | `QuestionnaireAnswer[]` `{ question, answer }` | Answers to `questionnaire` |
| `agent_error_response` | `string` | Bounce-back; triggers the limited give-up loop |
| `tool_result` | `{ id, ok, output }` | Result of a `tool_request`; `output` is a string, `Error:`-prefixed on failure |
| `storage_list` | `{ request_id, path }` | List a directory in the session folder (web) |
| `storage_read` | `{ request_id, path }` | Read a file's content (web) |
| `storage_write` | `{ request_id, path, content }` | Overwrite a file (web) |
| `storage_delete` | `{ request_id, path }` | Delete a file/folder (web) |

## Event flows

### New user prompt

```
client --user_prompt─────────────────────────►  backend
backend: promptRateLimited (per-IP) → resetErrorBounce → emitPlanningPlaceholder → task_update
backend: enqueuePrompt(USER_PROMPT_SYSTEM, prompt)        # one worker per session
worker:  beginPlanning → invokeMainAgent(USER_PROMPT_SYSTEM, prompt)
  main agent issues parallel tool_calls: [processNewTask(categories), executeCurrentTask()]
    processNewTask → validate/repair/merge → task_update
    executeCurrentTask → startExecution(sid)              # background pass, returns immediately
        per ready category → sub-agent per task
            file/shell tool → tool_request ──► CLI
            CLI executes → tool_result ──► backend (future resolves)
        sub-agent result → subagent_response + task_update
  main agent final text → main_agent_response
  worker:  endPlanning
pass drains → buildExecutionResults → enqueuePrompt(EXECUTION_RESULTS_SYSTEM, kind=results)
  main agent reports results → main_agent_response
```

### Questionnaire round-trip

```
main agent calls makeQuestion(question_json)
  → backend validates 2..5 options per question
  → emit questionnaire
client renders questions one at a time; appends "other" write-in option
  → user answers
  → emit questionnaire_answers
backend: enqueuePrompt(QUESTIONNAIRE_SYSTEM, formatted answers) → processNewTask → executeCurrentTask
```

### Forwarded tool round-trip

```
backend requestTool(sid, tool, args, timeout):
  create future keyed (sid, request_id); emit tool_request
  await future (timeout → returns "Error: ... timed out after Xs")
CLI executeToolRequest → local implementation → emit tool_result
backend resolveToolResult → future.set_result(output)
```

Timeouts: `TOOL_TIMEOUT_SECONDS = 30` and `COMMAND_TIMEOUT_SECONDS = 30`
(`backend/systemconfig/limits.py`). If the CLI disconnects first,
`cancelPendingRequests` resolves every in-flight future with an error so the
model is never left hanging.

### Storage round-trip (web)

```
client storage_list/read/write/delete {request_id, ...}
backend: storageFolder(sid) → storage service (OCI) → storage_listing/content/result
         on failure → storage_error; on write/delete → storage_change
```

### Error give-up loop

```
model/provider failure after 3 retries
backend emitAgentError → client shows error, emits agent_error_response
backend (count <= MAX_GIVE_UP_BOUNCES=2): enqueuePrompt(GIVE_UP_SYSTEM_PROMPT)
   → model answers plainly with NO tools
when count exceeds cap: backend emits the exact provider text as main_agent_response (no model call)
```

### Lifecycle

- `disconnect(sid)` → `cancelPendingRequests(sid)`, `stopPromptQueue(sid)` (stops
  the worker and the execution pass), drop `connected_users[sid]`, release locks,
  clear error counters.
- The client flushes `user_data` to disk on disconnect, SIGINT, and SIGTERM.

## Compatibility notes

- `questionnaire` delivers questions; replies use `questionnaire_answers`. A
  `sio.call`-style response path is not used.
- Events are not versioned; DTO changes are kept backward-compatible through the
  legacy migration shims ([data_model](data_model.md)).
