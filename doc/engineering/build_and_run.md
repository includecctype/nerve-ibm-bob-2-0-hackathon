# Build & Run

Exact commands and files for running, checking, and deploying the project.

## Prerequisites

| Tool | Version | Used by |
|---|---|---|
| Python | `>=3.13` (`backend/.python-version`) | backend |
| uv | `0.12.x` (pinned in Dockerfile as `uv==0.12.15`) | backend deps/run |
| Node.js | 22 | terminal, web, CI |
| pnpm | 12.5.1 (`packageManager`), lockfile v9 | terminal, web deps |
| Docker + Docker Compose | current | optional backend hosting |
| Doppler (optional) | current | secret injection in `justfile` |

## Environment variables

| Variable | Read by | Purpose |
|---|---|---|
| `WEB_SEARCH_API` | backend (`systemconfig/websearch.py`) | Exa key for `webSearch` / `webFetch` |
| `NERVE_BACKEND_URL` | CLI (`terminal/src/socket/client.ts`), web (`web/src/terminal/socket/client.ts`) | gateway URL |
| `WEB_ALLOWED_ORIGINS` | backend (`gateway/config.py`) | comma-separated browser origins allowed to connect; defaults to any (`*`) |
| `PROVIDED_MODEL_KEY` | backend (`model/model_client.py`) | operator-funded key for model 6 (DeepSeek Flash, web-only); used server-side and never sent to clients |
| `WATSONX_API_KEY` / `WATSONX_PROJECT_ID` | backend (`model/model_client.py`) | watsonx.ai credentials for model 1 (IBM Granite, operator-funded); used server-side and never sent to clients |
| `WATSONX_URL` | backend (`model/model_client.py`) | watsonx.ai endpoint (defaults to `https://us-south.ml.cloud.ibm.com`) |
| `OCI_TENANCY` / `OCI_USER` / `OCI_FINGERPRINT` / `OCI_REGION` | backend (`storage/oci/oci_client.py`) | OCI API-key identity and region |
| `OCI_KEY_FILE` / `OCI_KEY_CONTENT` | backend (`storage/oci/oci_client.py`) | private key: a mounted PEM path, or inline PEM with `\n` escapes |
| `OCI_PRIVATE_KEY_PASSPHRASE` | backend (`storage/oci/oci_client.py`) | passphrase for an encrypted private key (optional) |
| `OCI_NAMESPACE` | backend (`storage/oci/oci_client.py`) | Object Storage namespace |
| `OCI_BUCKET` | backend (`storage/oci/oci_client.py`) | bucket that holds the web session folders |

`.env` and `web/.env` are git-ignored; `.env.example` and `web/.env.example`
list the keys with blank values. OCI credentials are read entirely from the
environment.

## Run the backend

```bash
cd backend
uv sync --all-extras            # install (incl. dev: ruff, black, bandit)
WEB_SEARCH_API=... uv run main.py
# → Uvicorn on 0.0.0.0:8000; uvicorn "main:app" also works
```

The gateway is a pure Socket.IO ASGI app: it exposes no HTTP routes, so a
`GET /` healthcheck does not apply (the Docker healthcheck opens a TCP socket).

## Run the CLI

```bash
cd terminal
pnpm install
pnpm dev                        # tsx src/app.tsx
# or a production build:
pnpm build && pnpm start        # tsup → dist/app.js → bin: nerve
```

Point it at a local backend with `NERVE_BACKEND_URL=http://localhost:8000`.

## Run the web workspace

```bash
cd web
pnpm install
NERVE_BACKEND_URL=http://localhost:8000 pnpm dev
```

## Justfile shortcuts

`justfile` (run from the repo root; most recipes wrap commands in
`doppler run --`):

| Recipe | Does |
|---|---|
| `just backend` | uvicorn gateway on `:8000` (Doppler-wrapped) |
| `just terminal` | `pnpm install --frozen-lockfile && pnpm dev` for the CLI (`frontend` is an alias) |
| `just web` | `pnpm install --frozen-lockfile && pnpm dev` for the web workspace |
| `just web-build` | `pnpm install --frozen-lockfile && pnpm build` for the web workspace |
| `just run` | `docker-up`, then the CLI in the foreground |
| `just docker-up` / `docker-down` / `docker-build` / `docker-build-no-cache` / `docker-logs` | Compose lifecycle |
| `just opencode` / `opencode-continue` / `bob` / `bob-run` / `bob-resume` | agent helpers (need Doppler) |

## Docker

`docker-compose.yml` runs the backend only:

- builds `backend/Dockerfile` (`python:3.13-slim` + uv), maps `8000:8000`,
  reads `.env` if present (never required), and healthchecks with a TCP connect.

The backend has no PostgreSQL/Redis dependency — nothing else needs to be
running.

## Rate limits

Enforced per client IP (`backend/systemconfig/limits.py`):

| Limit | Value |
|---|---|
| Connect | 30 connections / 60 s |
| Prompts | 20 prompts / 4 h |

A throttled client receives `rate_limited {retry_after}` on the prompt path, or
`connection_status: false` on connect.

## CI (`.github/workflows/ci.yml`)

Triggers on push/PR to `main`, `master`, `**github-workflow**`.

| Job | Command |
|---|---|
| Terminal Lint / Format / Typecheck | `pnpm lint` / `pnpm format:check` / `pnpm typecheck` |
| Web Lint / Format / Typecheck / Build | `pnpm lint` / `pnpm format:check` / `pnpm typecheck` / `pnpm build` |
| Backend Lint / Format / Security | `ruff check .` / `black --check .` / `bandit -r . -c pyproject.toml` |
| Secret Scan | `gitleaks` (allowlist: `.env.example`) |

Run the same checks locally:

```bash
cd terminal && pnpm lint && pnpm format:check && pnpm typecheck
cd web      && pnpm lint && pnpm format:check && pnpm typecheck && pnpm build
cd backend  && uv sync --all-extras && uv run ruff check . && uv run black --check . && uv run bandit -r . -c pyproject.toml
```

## Deploy

- **Backend:** any Docker host. Reference deployment:
  `https://nerve-ibm-bob-2-0-hackathon.onrender.com`. Secrets (`WEB_SEARCH_API`,
  `PROVIDED_MODEL_KEY`, OCI credentials) are injected by the host or Doppler.
- **CLI:** publish the built `dist/app.js` as `nervous-cli`; `tsup` bakes the
  gateway URL from `NERVE_BACKEND_URL` at build time (default:
  `https://nerve-ibm-bob-2-0-hackathon.onrender.com`). Users install it and run
  `nerve`, overriding the baked URL with `NERVE_BACKEND_URL` at runtime.
- **Web:** `pnpm build` then upload `web/dist`; `.github/workflows/web-pages.yml`
  deploys to GitHub Pages on pushes that touch `web/`.

## Session cleanup

Web session folders older than 2 hours are removed by
`.github/workflows/oci_cleanup.yml`, which runs every 2 hours on GitHub Actions
(and can be triggered manually). The module also runs standalone:

```bash
cd backend && uv run python -m storage.oci.cleanup
```

## Style & conventions

- Backend: `ruff` + `black`, line length 100, `py313`; camelCase functions
  allowed (`N802` ignored). `bandit` config excludes `tests`, `.venv`.
- Terminal / web: Biome (lint + format), strict TypeScript, ESM only.
- Project rules: snake_case file names, camelCase functions, PascalCase
  classes/enums, `FULL_CAPS` env vars (`AGENTS.md`, `.opencode/rules/*`).
