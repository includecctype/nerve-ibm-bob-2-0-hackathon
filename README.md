# nerve

**One living plan for your coding agents.**

nerve keeps multi-agent coding work in a single, persistent task graph. Keep
sending prompts: each one **incrementally re-plans** the work that's still ahead,
while work already running keeps running — no restarts, no lost progress.

Most agents run a task list. nerve runs a graph that remembers.

[![CI](https://github.com/includecctype/nerve-ibm-bob-2-0-hackathon/actions/workflows/ci.yml/badge.svg)](https://github.com/includecctype/nerve-ibm-bob-2-0-hackathon/actions/workflows/ci.yml)
· [Live web demo](https://includecctype.github.io/nerve-ibm-bob-2-0-hackathon/)
· [Documentation](doc/README.md)

![nerve — one living plan for your coding agents](doc/media/banner.svg)

> **Try it in 30 seconds.** Open the [live web demo](https://includecctype.github.io/nerve-ibm-bob-2-0-hackathon/),
> pick the provided model (6), and type **`/sample`**. Each scenario seeds a task graph, then
> sends five follow-up prompts that **incrementally re-plan** it — work already running is never
> interrupted.

## The problem: agents forget, and restarts waste work

Today's coding agents treat every prompt as a fresh start:

- **Restarts lose work.** Change your mind mid-run and you're told to restart the
  prompt — throwing away everything already in flight.
- **Every prompt re-plans from scratch.** Overlapping work gets redone and intent
  from earlier prompts is forgotten.
- **Parallel work has no structure.** Whether tasks depend on each other, overlap,
  or could run together lives only in the model's prose, and vanishes the moment
  the request ends.

## What nerve does

- **One living plan.** A persistent task graph that survives across prompts and
  sessions.
- **Incremental re-planning.** A new prompt reshapes the work that's still ahead;
  work already running is never disturbed.
- **Work as a graph, not a list.** First-class relationships: `depends_on`
  ordering, duplicate removal, and each category's results flowing into its
  dependents.
- **Dependency-aware parallelism.** Categories launch the moment their
  dependencies finish, and a failure cascades `blocked` to everything downstream.
- **In-flight protection.** Running work is immutable, so "keep sending prompts"
  can never race an executor mid-change.
- **Your code stays yours.** In the CLI, file and shell tools run on your machine;
  the server only makes model calls and optional web searches.

## See it: one plan, three prompts

```
prompt 1 · "fix the login bug"
        │
        ▼
   ┌──────────────────────┐
   │ login-fix       ▶ running │
   └──────────────────────┘
        │
prompt 2 · "also harden session handling"      (sent while login-fix is running)
        │
        ▼
   ┌──────────────────────┐   ┌──────────────────────┐
   │ login-fix       ▶ running │   │ session-hardening  pending │   ← added to the plan
   └──────────────────────┘   └──────────────────────┘
        │
prompt 3 · "actually, drop the session work"   (sent while login-fix is running)
        │
        ▼
   ┌──────────────────────┐        session-hardening removed from pending work;
   │ login-fix       ▶ running │   login-fix was never interrupted
   └──────────────────────┘
```

Each prompt is planned immediately and folded into the same running plan. When the
plan drains, nerve reports what finished — as its own message.

Watch it live: the web workspace ships ten scripted scenarios behind the **`/sample`** command.

## Why it's different

| | Typical coding agents | nerve |
|---|---|---|
| **Unit of work** | one prompt / one spawned agent | an entry in a persistent work graph |
| **Across prompts** | re-plans from scratch | **incremental re-planning** on one living plan |
| **Work relationships** | implicit in the model's prose | **first-class**: `depends_on`, dedupe, result flow |
| **Parallelism** | decided ad hoc | dispatched from explicit dependency readiness |
| **Changing course** | start the prompt over | keep going; only pending work changes |
| **Where code runs** (CLI) | a vendor server | on your machine |

## How it works

```
prompt ─▶ main agent (LangChain)
            ├─ processNewTask(categories)     categories = {name, tasks, depends_on}
            └─ executeCurrentTask()           starts or joins the background pass
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
  ready category            ready category          ← run in parallel
  (a fresh sub-agent per task) (a fresh sub-agent per task)
        │                         │
        └───────── results ───────┘
                     ▼
              results turn ─▶ main agent reports back
```

- One prompt worker per session turns prompts into planning turns, so turns never
  overlap.
- Execution runs in a **detached background pass**; a planning gate keeps it from
  exiting while a later prompt is still re-planning.
- Only `pending_categories` is ever replaced — `running_categories` is untouched by
  design.

Full detail: [architecture](doc/engineering/architecture.md) ·
[pipelines](doc/engineering/pipelines.md).

## Try it

**Web workspace (live demo):**
<https://includecctype.github.io/nerve-ibm-bob-2-0-hackathon/> — the same Ink
terminal plus an OCI-backed file explorer and viewer. Type **`/sample`** to run one of
ten scripted scenarios that build a task graph and incrementally re-plan it.

**Backend** (Python 3.13 + [uv](https://docs.astral.sh/uv/)):

```bash
cd backend
uv sync --all-extras
uv run main.py                     # → Uvicorn on 0.0.0.0:8000
```

**CLI** (Node 22 + pnpm):

```bash
cd terminal
pnpm install
NERVE_BACKEND_URL=http://localhost:8000 pnpm dev
```

**Web workspace**, or everything at once with the `justfile`:

```bash
cd web && pnpm install && NERVE_BACKEND_URL=http://localhost:8000 pnpm dev
just backend   # gateway on :8000
just terminal  # CLI
just web       # browser workspace
```

Models are selected by id: **model 1 is IBM Granite on watsonx.ai**, models 2–5 are
third-party providers, and model 7 is OpenRouter Auto. The web workspace also offers
model 6 (DeepSeek Flash), funded by the operator via `PROVIDED_MODEL_KEY` and refused
for non-web clients. Models 1 and 6 read their credentials from the server environment,
so clients never handle those keys. In the CLI, `↑`/`↓` and `PageUp`/`PageDown` scroll
the chat, `Ctrl+↑`/`Ctrl+↓` scroll the Tasks pane, and `Esc` clears the prompt.

Setup details — environment variables, OCI storage, rate limits, and checks —
live in [build_and_run](doc/engineering/build_and_run.md).

## Built with IBM Bob

IBM Bob was the engineering teammate that built this repository, not an
autocomplete. Its configuration is committed so the setup is reproducible:

| Artifact | Purpose |
|---|---|
| `AGENTS.md` | Working agreement: plan first, ask before assuming, follow the rules. |
| `.opencode/opencode.json` | Runtime config: the three MCP servers, permissions, and instruction files. |
| `.opencode/rules/*` | The structure, naming, Obsidian, and LibreOffice rules Bob follows. |
| `.bob/mcp.json` + `.bob/rules/*` | The same MCP servers and rules, mirrored for Bob. |

### One worktree and one pull request per concern

Every change lived in its own **git worktree**, created beside the main checkout
and named `nerve-ibm-bob-2-0-hackathon-<topic>` (`…-detached_execution`,
`…-web_storage_client`, `…-sample_command`). Bob implemented the change in the
worktree, committed a scoped message, opened a pull request with the `gh` CLI,
waited for the checks, and merged only when they were green. **84 concerns landed
as 84 branches and 84 pull requests**, so `main` never held unreviewed work — the
same "independent workstreams that never block each other" discipline the product
itself preaches.

### What Bob built

- **Backend** — the LangChain/LangGraph agent layer, the DAG task-graph scheduler
  (`backend/ai_tool/task/`), the Socket.IO gateway, prompt queuing, rate limiting,
  OCI object storage, and detached background execution.
- **CLI** — the two-pane Ink/React terminal, the slash-command menu, the
  questionnaire, and the scroll model.
- **Web** — the browser workspace: the Ink-in-xterm terminal, the IDE shell, the
  file explorer and viewer, and the `/sample` demo runner.
- **Review and hardening** — Bob reviewed diffs, hunted defects, and traced
  failures in tool round-trips, scheduler edge cases, and reconnect state.

### MCP tooling for everything that is not code

Bob was wired to three MCP servers, which covered the planning, documentation,
design, and presentation side of the project:

- **Obsidian — planning and documentation.** Bob maintained a project vault
  (`goal.md`, `project_map.md`, an engineering reference set, and the product
  notes) and kept it in sync as the code changed.
- **Penpot — design.** Bob produced the concept and architecture visuals and the
  layout of the web workspace.
- **LibreOffice — the submission deck.** Bob drafted and refreshed the
  presentation slides and PDF from the product notes.

The rules for each server are committed, so the tooling is reproducible.

### IBM watsonx.ai

The model layer is provider-agnostic — `backend/model/model_client.py` maps a
model id to a provider. That map includes **IBM watsonx.ai**: model 1 runs IBM
Granite on watsonx.ai, with credentials read from `WATSONX_API_KEY`,
`WATSONX_PROJECT_ID`, and `WATSONX_URL`. Because the gateway builds its agents
with LangChain, the same task graph, tools, scheduler, and prompt pipeline run
unchanged on Granite. (IBM watsonx Orchestrate was out of scope for this build.)

## Business value

nerve is a **coordination layer**, not another executor — the memory, scheduling,
and interaction shell around agents you already run.

- **Cost avoidance.** One living plan stops duplicate and re-planned work from
  burning tokens and wall-clock.
- **Security.** In the CLI, code and secrets never leave the developer's machine;
  the server is a thin Socket.IO + model orchestrator with no database.
- **Responsiveness.** Teams keep re-steering instead of restarting, which shortens
  the gap between intent and working code.

The full case is in [business_value](doc/product/business_value.md).

## Repository map

| Path | What it is |
|---|---|
| `backend/` | Python 3.13 Socket.IO gateway: LangChain/LangGraph agents, DAG scheduler, OCI storage |
| `terminal/` | Node 22 + pnpm CLI (Ink/React) — the two-pane TUI |
| `web/` | Vite + React browser workspace: Ink via ink-web, plus an OCI file explorer and viewer |
| `doc/` | Engineering and product reference documentation |
| `docker-compose.yml`, `justfile` | Backend hosting and dev shortcuts |

## Learn more

- [Problem](doc/product/problem.md) · [Solution](doc/product/solution.md) ·
  [Competition analysis](doc/product/competition_analysis.md)
- [Architecture](doc/engineering/architecture.md) ·
  [Pipelines](doc/engineering/pipelines.md) ·
  [Socket protocol](doc/engineering/socket_protocol.md) ·
  [AI tools](doc/engineering/ai_tools.md)
- [Build & run](doc/engineering/build_and_run.md) ·
  [Full documentation index](doc/README.md)
