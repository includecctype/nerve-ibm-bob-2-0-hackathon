# nerve

Terminal-native, multi-agent coding orchestrator with a **persistent task graph**.

A main orchestrator agent decomposes each prompt into **categories** (independent
workstreams). Categories run in parallel as soon as their `depends_on`
dependencies are finished; tasks inside a category run sequentially. The graph
survives across prompts, so a new prompt **morphs** pending work instead of
re-planning from scratch, and running work is never mutated.

File and shell tools are **forwarded to the CLI** and executed on your machine —
the backend never touches your working directory.

## Repository layout

| Path | What it is |
|---|---|
| `backend/` | Python 3.13 Socket.IO gateway (`python-socketio` + uvicorn), LangChain/LangGraph agents, DAG scheduler |
| `terminal/` | Node 22 + pnpm CLI (Ink/React) — the two-pane TUI |
| `docker-compose.yml` | Runs the backend on `:8000` with a healthcheck |
| `justfile` | Shortcuts for backend, CLI, and Docker |
| `.github/workflows/ci.yml` | Lint / format / typecheck / security checks |
| `AGENTS.md`, `.opencode/`, `.bob/` | Agent working agreement and rules (see below) |

## Quickstart

### Prerequisites

| Tool | Version | Used by |
|---|---|---|
| Python | `>=3.13` | backend |
| [uv](https://docs.astral.sh/uv/) | `0.12.x` | backend deps/run |
| Node.js | `>=22` | terminal |
| pnpm | `12` (lockfile v9) | terminal deps — the version CI pins |
| Docker + Compose | current | optional backend hosting |

### 1. Backend

```bash
cd backend
uv sync --all-extras              # installs runtime + dev tools (ruff, black, bandit)
WEB_SEARCH_API=<your-exa-key> uv run main.py
# → Uvicorn listening on 0.0.0.0:8000
```

The gateway is a pure Socket.IO ASGI app: it exposes **no HTTP routes**, so a
`GET /` healthcheck does not apply (the Docker healthcheck opens a TCP socket).
Browser origins allowed to connect are controlled by `WEB_ALLOWED_ORIGINS`
(comma-separated); when unset any origin is accepted, which suits the CLI and the
web demo.

### 2. CLI

```bash
cd terminal
pnpm install
NERVE_BACKEND_URL=http://localhost:8000 pnpm dev     # tsx src/app.tsx
# production build:
pnpm build && pnpm start                             # tsup → dist/app.js → bin: nerve
```

Without `NERVE_BACKEND_URL` the CLI connects to the public deployment
(`https://nerve-boq5.onrender.com`).

### 3. Docker (backend only)

```bash
just docker-up        # build + start, detached
just docker-logs      # follow backend logs
just docker-down
```

`docker-compose.yml` maps `8000:8000`, reads `.env` if present (never required),
and healthchecks with a TCP connect. The backend has no PostgreSQL/Redis
dependency — nothing else needs to be running.

### justfile recipes

| Recipe | Does |
|---|---|
| `just backend` | uvicorn gateway on `:8000` (Doppler-wrapped) |
| `just frontend` | `pnpm install --frozen-lockfile && pnpm dev` |
| `just run` | `docker-up`, then the CLI in the foreground |
| `just docker-up` / `docker-down` / `docker-build` / `docker-build-no-cache` / `docker-logs` | Compose lifecycle |
| `just opencode` / `opencode-continue` / `bob` / `bob-run` / `bob-resume` | agent helpers (need Doppler) |

## Using the CLI

Type a prompt and press `Enter` to send it. A leading `/` on an empty prompt
enters command mode; `Esc` clears the prompt.

| Command | Opens |
|---|---|
| `/model` | model picker (Enter to choose) |
| `/key` | API-key entry for the current model |
| `/session` | session picker — restores a saved task graph + history |
| `/restart` | reconnect to the backend |
| `/exit` | flush config to disk and quit |

Models are selected by id (stored in `user_config/config.json`):

| Id | Model |
|---|---|
| 1 | OpenRouter Auto |
| 2 | Groq GPT-OSS 120B |
| 3 | Claude Fable 5 |
| 4 | Kimi K2.6 |
| 5 | DeepSeek Chat |

**Keys**

| Key | Action |
|---|---|
| `PageUp` / `PageDown` | scroll the chat pane half a page |
| `Home` / `End` | jump chat to oldest / newest |
| `↑` / `↓` | scroll chat while the prompt is a single line |
| `Ctrl+↑` / `Ctrl+↓` | scroll the Tasks pane |
| Mouse wheel | scrolls whichever pane the pointer is over |
| `Esc` | clear prompt / leave command mode |

Ambiguous prompts come back as a **questionnaire**: 2–5 options plus a write-in
`other` answer.

**Persistence** — API keys, the task graph, and display history are written to
`./user_config/config.json` (git-ignored), debounced, and flushed on exit.

## Environment variables

| Variable | Read by | Purpose |
|---|---|---|
| `WEB_SEARCH_API` | backend (`backend/systemconfig/websearch.py`) | Exa key for `webSearch` / `webFetch` |
| `NERVE_BACKEND_URL` | CLI (`terminal/src/socket/client.ts`) | gateway URL; defaults to the public deployment |
| `WEB_ALLOWED_ORIGINS` | backend (`backend/gateway/config.py`) | comma-separated browser origins allowed to connect; defaults to any (`*`) |
| `OCI_NAMESPACE` | backend (`backend/storage/oci/oci_client.py`) | Object Storage namespace |
| `OCI_BUCKET` | backend (`backend/storage/oci/oci_client.py`) | bucket that holds the web session folders |
| `OCI_CONFIG_FILE` | backend (`backend/storage/oci/oci_client.py`) | OCI API-key config path; defaults to `~/.oci/config` |
| `OCI_CONFIG_PROFILE` | backend (`backend/storage/oci/oci_client.py`) | OCI config profile; defaults to `DEFAULT` |

`.env` is git-ignored; `.env.example` lists the keys with blank values. OCI
region and API keys are read from `~/.oci/config`, so only the namespace and
bucket need to be set.

## Checks

Run locally (CI runs the same set on every PR):

```bash
cd terminal && pnpm lint && pnpm format:check && pnpm typecheck
cd backend  && uv sync --all-extras && uv run ruff check . && uv run black --check . && uv run bandit -r . -c pyproject.toml
```

| CI job | Command |
|---|---|
| Terminal Lint / Format / Typecheck | `pnpm lint` / `pnpm format:check` / `pnpm typecheck` |
| Backend Lint / Format / Security | `ruff check .` / `black --check .` / `bandit -r . -c pyproject.toml` |
| Secret Scan | `gitleaks` (allowlist: `.env.example`) |

There is **no automated test suite**; verification is lint + format + typecheck
+ secret scan, plus the manual end-to-end demo.

## How IBM Bob was used to build this

The agent configuration is committed and verifiable:

| File | Purpose |
|---|---|
| `AGENTS.md` | working agreement: plan first, ask before assuming, follow the rules |
| `.opencode/opencode.json` | agent runtime config (MCP servers, permissions, instruction files) |
| `.opencode/rules/*.md` | structure, naming, and documentation rules |
| `.bob/` | mirrored Bob rules and MCP config |

Process: one **git worktree per concern**, each landed through its own pull
request with green checks before merge; agents used for planning, bug hunting,
and documentation — not for runtime features. **There is no Bob integration in
the runtime code.**

## Known limitations

- Backend session state is in-process: a gateway restart drops live graphs (the
  CLI's saved session can resume them).
- No MCP server, IBM Bob integration, approval policies, or cross-prompt
  similarity/contradiction handling — those ideas are not implemented.
