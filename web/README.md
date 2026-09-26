# nerve web

Browser workspace built with Vite + React 19. The Ink terminal UI runs through
[ink-web](https://ink-web.dev) (real Ink components rendered into an xterm.js
terminal in the DOM), alongside an OCI-backed file explorer and a file viewer:

```
┌───────────┬───────────────┬──────────────┐
│ terminal  │ file explorer │ file viewer  │
└───────────┴───────────────┴──────────────┘
```

## How it works

- **`src/terminal/`** — the Ink app, ported from `terminal/`. Config and sessions
  live in `localStorage`; the backend URL comes from `NERVE_BACKEND_URL`.
  The client connects with `client_kind: "web"`.
- **`src/storage/`** — a typed Socket.IO client for the storage events
  (`storage_session`/`storage_listing`/`storage_content`/`storage_change`) plus
  React hooks (`useSessionFolder`, `useDirectory`, `useFileContent`).
- **`src/file_explorer/`**, **`src/file_viewer/`** — the two file panes.
- **`src/ide_shell.tsx`** — the three-pane layout.

Each visit gets a fresh `YYYY-MM-DD:<uuid>` folder. The **backend** owns the OCI
credentials and performs all reads/writes, and the agent's file tools run
server-side against the same folder — so files the agent writes show up in the
explorer in realtime. The browser never holds OCI secrets.

## Development

```bash
pnpm install
NERVE_BACKEND_URL=http://localhost:8000 pnpm dev
```

Without `NERVE_BACKEND_URL` the app connects to `http://localhost:8000`. The
backend needs `OCI_NAMESPACE` + `OCI_BUCKET` and an OCI API-key config (see the
root README); without them the terminal still works and the file panes show an
error.

## Environment

| Variable | Purpose |
|---|---|
| `NERVE_BACKEND_URL` | gateway URL baked into the build (defaults to `http://localhost:8000`) |

Copy `.env.example` to `.env` (git-ignored) for local development. Nothing here
is secret — Vite inlines the exposed `NERVE_*` / `VITE_*` values into the public
bundle.

## Checks

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm build
```

## Deploy

```bash
pnpm build     # → web/dist (relative asset paths)
```

Upload `web/dist` to any static host (GitHub Pages, Hostinger, ...). Make sure
the backend's `WEB_ALLOWED_ORIGINS` includes the deployed origin.
`.github/workflows/web-pages.yml` automates GitHub Pages: set the
`NERVE_BACKEND_URL` repository variable and enable Pages with the "GitHub
Actions" source.
