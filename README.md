# nerve

Terminal-native, multi-agent coding orchestrator with a **persistent task graph**.

A main orchestrator agent decomposes each prompt into **categories** (independent
workstreams). Categories run in parallel as soon as their `depends_on`
dependencies are finished; tasks inside a category run sequentially. The graph
survives across prompts, so a new prompt **morphs** pending work instead of
re-planning from scratch, and running work is never mutated.

Prompts are handled by one worker per session, and task-graph execution runs in a
**detached background pass**: `executeCurrentTask` starts or joins the pass and
returns immediately, so a prompt sent while work is running is planned right away
and its categories **join the running pass**. When the pass drains, the main
agent reports the outcome as a separate message.

In the terminal client, file and shell tools are **forwarded to the CLI** and
executed on your machine — the backend never touches your working directory. In
the web workspace they run on the backend against the session's OCI Object
Storage folder instead.

Full reference documentation lives in [`doc/`](doc/README.md) (engineering and
product).

## Repository layout

| Path | What it is |
|---|---|
| `backend/` | Python 3.13 Socket.IO gateway (`python-socketio` + uvicorn), LangChain/LangGraph agents, DAG scheduler |
| `terminal/` | Node 22 + pnpm CLI (Ink/React) — the two-pane TUI |
| `web/` | Vite + React browser workspace: Ink via ink-web, plus an OCI file explorer and viewer |
| `doc/` | Engineering and product reference documentation |
| `docker-compose.yml` | Runs the backend on `:8000` with a healthcheck |
| `justfile` | Shortcuts for backend, CLI, web, and Docker |
| `.github/workflows/ci.yml` | Lint / format / typecheck / build / security checks |
| `.github/workflows/web-pages.yml` | Publishes `web/dist` to GitHub Pages |
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

Without `NERVE_BACKEND_URL` the CLI falls back to its built-in deployment URL;
set it to target a specific gateway, e.g.
`https://nerve-ibm-bob-2-0-hackathon.onrender.com` (reference deployment) or
`http://localhost:8000` (local backend).

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
| `just terminal` | `pnpm install --frozen-lockfile && pnpm dev` for the CLI (`frontend` is an alias) |
| `just web` / `just web-build` | install + `pnpm dev` / `pnpm build` for the web workspace |
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

Models are selected by id (stored in `user_config/config.json`). The CLI offers
ids 1–5; the web workspace adds the provided model 6 and defaults to it:

| Id | Model |
|---|---|
| 1 | OpenRouter Auto |
| 2 | Groq GPT-OSS 120B |
| 3 | Claude Fable 5 |
| 4 | Kimi K2.6 |
| 5 | DeepSeek Chat |
| 6 | DeepSeek Flash (provided) |

Model 6 is **provided** and **web-only**: the operator funds it via
`PROVIDED_MODEL_KEY`, the web workspace defaults to it, and the CLI does not
offer it (the gateway refuses it for non-web clients).

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

## Web workspace

`web/` is a static SPA that renders the same Ink UI through
[ink-web](https://ink-web.dev) and adds two cloud-backed panes:

```
┌───────────┬───────────────┬──────────────┐
│ terminal  │ file explorer │ file viewer  │
└───────────┴───────────────┴──────────────┘
```

Each visit creates a fresh `YYYY-MM-DD:<uuid>` folder in OCI Object Storage. The
backend owns the OCI credentials and performs every read and write; the web
client asks for a listing or a file over Socket.IO, and the agent's file tools
run server-side against that same folder, so files appear in the explorer as the
agent writes them.

```bash
# backend (needs OCI credentials, see below)
cd backend && uv sync --all-extras && uv run main.py

# web workspace
cd web && pnpm install
NERVE_BACKEND_URL=http://localhost:8000 pnpm dev
```

### OCI setup

1. Create a bucket in OCI Object Storage.
2. Create an API key for a user with an `object-family` policy, then put the
   key's fields in the root `.env`: `OCI_TENANCY`, `OCI_USER`,
   `OCI_FINGERPRINT`, `OCI_REGION`, and the private key — either
   `OCI_KEY_FILE` (a mounted `.pem` path) or `OCI_KEY_CONTENT` (the PEM inline
   with `\n` escapes). Add `OCI_PRIVATE_KEY_PASSPHRASE` if the key is encrypted.
3. Set `OCI_NAMESPACE` and `OCI_BUCKET`.

Without OCI credentials the terminal still works; the explorer and viewer show a
clear error until the bucket is configured.

### Session cleanup

Web session folders are removed once they are older than 6 hours.
`.github/workflows/oci_cleanup.yml` runs that sweep every 6 hours on GitHub
Actions (and can be triggered manually); the module runs standalone as
`cd backend && uv run python -m storage.oci.cleanup`. Add the same OCI
credentials (`OCI_TENANCY`, `OCI_USER`, `OCI_FINGERPRINT`, `OCI_REGION`,
`OCI_KEY_CONTENT`, `OCI_NAMESPACE`, `OCI_BUCKET`) as repository secrets for the
workflow. Only `YYYY-MM-DD:<uuid>` folders are considered, and each folder's age
comes from its objects' creation timestamps.

### Hosting the web workspace

```bash
cd web && pnpm build     # → web/dist (relative asset paths)
```

Upload `web/dist` to any static host (GitHub Pages, Hostinger, ...). The backend
must be reachable, and its `WEB_ALLOWED_ORIGINS` should include the web origin.
`.github/workflows/web-pages.yml` deploys `web/dist` to GitHub Pages on pushes
that touch `web/`; set the `NERVE_BACKEND_URL` repository variable and
enable Pages with the "GitHub Actions" source first.

## Environment variables

| Variable | Read by | Purpose |
|---|---|---|
| `WEB_SEARCH_API` | backend (`backend/systemconfig/websearch.py`) | Exa key for `webSearch` / `webFetch` |
| `NERVE_BACKEND_URL` | CLI (`terminal/src/socket/client.ts`) and web (`web/src/terminal/socket/client.ts`) | gateway URL; the CLI falls back to its built-in deployment, the web build to `http://localhost:8000` |
| `WEB_ALLOWED_ORIGINS` | backend (`backend/gateway/config.py`) | comma-separated browser origins allowed to connect; defaults to any (`*`) |
| `PROVIDED_MODEL_KEY` | backend (`backend/model/model_client.py`) | operator-funded key for model 6 (DeepSeek Flash, web-only); used server-side and never sent to clients |
| `OCI_TENANCY` / `OCI_USER` / `OCI_FINGERPRINT` / `OCI_REGION` | backend (`backend/storage/oci/oci_client.py`) | OCI API-key identity and region |
| `OCI_KEY_FILE` / `OCI_KEY_CONTENT` | backend (`backend/storage/oci/oci_client.py`) | private key: a mounted PEM path, or inline PEM with `\n` escapes |
| `OCI_PRIVATE_KEY_PASSPHRASE` | backend (`backend/storage/oci/oci_client.py`) | passphrase for an encrypted private key (optional) |
| `OCI_NAMESPACE` | backend (`backend/storage/oci/oci_client.py`) | Object Storage namespace |
| `OCI_BUCKET` | backend (`backend/storage/oci/oci_client.py`) | bucket that holds the web session folders |

`.env` and `web/.env` are git-ignored; `.env.example` and `web/.env.example`
list the keys with blank values. OCI credentials are read entirely from the
environment.

## Rate limits

The public gateway protects itself per client IP (`backend/systemconfig/limits.py`):

| Limit | Value |
|---|---|
| Connect | 30 connections / 60 s |
| Prompts | 20 prompts / 4 h |

A throttled client receives `rate_limited {retry_after}` for prompts, or
`connection_status: false` on connect.

## Checks

Run locally (CI runs the same set on every PR):

```bash
cd terminal && pnpm lint && pnpm format:check && pnpm typecheck
cd web      && pnpm lint && pnpm format:check && pnpm typecheck && pnpm build
cd backend  && uv sync --all-extras && uv run ruff check . && uv run black --check . && uv run bandit -r . -c pyproject.toml
```

| CI job | Command |
|---|---|
| Terminal Lint / Format / Typecheck | `pnpm lint` / `pnpm format:check` / `pnpm typecheck` |
| Web Lint / Format / Typecheck / Build | `pnpm lint` / `pnpm format:check` / `pnpm typecheck` / `pnpm build` |
| Backend Lint / Format / Security | `ruff check .` / `black --check .` / `bandit -r . -c pyproject.toml` |
| Secret Scan | `gitleaks` (allowlist: `.env.example`) |

Verification is lint + format + typecheck + build + secret scan, plus the manual
end-to-end demo.

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
and documentation — not as a runtime dependency.
