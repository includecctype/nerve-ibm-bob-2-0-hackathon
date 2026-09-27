# Tech Stack

Exact stack used by **nerve**.

## Backend

| Layer | Technology |
|---|---|
| Language | Python 3.13 |
| Package manager | uv |
| Server | python-socketio ASGI app served by Uvicorn |
| Transport | Socket.IO (WebSocket with HTTP long-polling fallback) |
| Agent framework | LangChain `create_agent` + LangGraph `InMemorySaver` checkpointer |
| Model providers | IBM watsonx.ai (IBM Granite), OpenRouter, Groq, Anthropic, Baseten, DeepSeek (`init_chat_model` + `langchain-ibm`) |
| Web search | Exa (`exa-py`) |
| HTTP | httpx + stdlib `HTMLParser` |
| Validation | Pydantic |
| Async | asyncio (`asyncio.Task`, `asyncio.wait`, futures, `asyncio.Queue`) |
| Object storage | OCI Object Storage (`oci` SDK) |

## CLI (frontend)

| Layer | Technology |
|---|---|
| Runtime | Node.js 22, ESM |
| Package manager | pnpm 12.5.1 (`packageManager`), lockfile v9 |
| TUI | Ink 6 + React 19 |
| UI widgets | @inkjs/ui, fullscreen-ink, ink-big-text, wrap-ansi |
| Transport | socket.io-client |
| State | React `useState` |
| Bundler | tsup |
| Static checks | Biome (lint/format) + tsc (typecheck) |

## Web workspace

| Layer | Technology |
|---|---|
| Build | Vite + React 19 + TypeScript |
| Terminal | Ink components rendered into an xterm.js terminal via ink-web |
| File panes | React + xterm style theming; OCI-backed explorer and viewer |
| Transport | socket.io-client (terminal events + storage events) |
| State | React `useState` / hooks |
| Static checks | Biome + tsc |

## Infrastructure & tooling

| Layer | Technology |
|---|---|
| Containers | Docker + Docker Compose (backend only) |
| Backend host | Render (reference deployment) |
| Web host | static host (GitHub Pages via Actions) |
| CLI distribution | npm package `nerves-cli`, bin `nerve` |
| Secrets | Doppler (dev) / host environment (prod) |
| CI | GitHub Actions (`ruff`, `black`, `bandit`, Biome, `tsc`, `gitleaks`) |

See [architecture](architecture.md) for how these fit together and
[build_and_run](build_and_run.md) for commands.
