# Web Reference (nerve browser workspace)

Root: `web/`. Vite + React 19 + TypeScript. The Ink terminal UI runs through
[ink-web](https://ink-web.dev) — real Ink components rendered into an xterm.js
terminal in the DOM — alongside an OCI-backed file explorer and file viewer.

## Layout

```
┌───────────┬───────────────┬──────────────┐
│ terminal  │ file explorer │ file viewer  │
└───────────┴───────────────┴──────────────┘
```

- `src/web_app.tsx` → `src/ide_shell.tsx` — the three-pane shell. `IdeShell` owns
  the selected file path and renders `InkXterm` + `FileExplorer` + `FileViewer`.
- `src/terminal/` — the Ink app ported from `terminal/` and the socket layer.
  Config and sessions live in `localStorage`.
- `src/terminal/xterm_host.tsx` — the xterm.js host that renders the Ink tree.
- `src/storage/` — the storage socket client and React hooks.
- `src/file_explorer/`, `src/file_viewer/` — the two file panes.
- `src/styles/` — `global.css`, `ide_shell.css`, `file_browser.css`,
  `file_viewer.css`.

Terminal look is set in `TERMINAL_OPTIONS` (`src/ide_shell.tsx`): `fontSize: 13`
with a green-on-black theme.

## Connection

`src/terminal/socket/client.ts`:

```ts
BACKEND_URL =
  import.meta.env.NERVE_BACKEND_URL ??
  import.meta.env.VITE_NERVE_BACKEND_URL ??
  "http://localhost:8000";
```

The auth payload sets `client_kind: "web"` plus `main_agent_id`, `api_keys`,
`categories`, `history`, and the selected `api_key`. `vite.config.ts` sets
`envPrefix: ["VITE_", "NERVE_"]`, so both prefixes are inlined at build time.

Web clients default to the **provided model** (id 6), which the backend funds via
`PROVIDED_MODEL_KEY`; the key is never sent to the browser. A web visit also
receives a fresh OCI session folder over `storage_session`.

## Storage client

`src/storage/storage_socket.ts` speaks the request/response storage protocol:

- Requests carry a `request_id` (`crypto.randomUUID()`) and a 30 s timeout.
- `listDirectory` → `storage_list`, `readFileContent` → `storage_read`,
  `writeFileContent` → `storage_write`, `deleteStoragePath` → `storage_delete`.
- Responses: `storage_listing`, `storage_content`, `storage_result`,
  `storage_error`; changes arrive as `storage_change`.

`src/storage/storage_store.ts` exposes the React hooks: `useSessionFolder()`,
`useDirectory(path)`, `useFileContent(path)`. The backend owns all OCI
credentials and performs every read/write.

## Environment

| Variable | Purpose |
|---|---|
| `NERVE_BACKEND_URL` / `VITE_NERVE_BACKEND_URL` | Gateway URL baked into the build (defaults to `http://localhost:8000`) |

`web/.env.example` documents the backend URL. Everything here is public — Vite
inlines the exposed `NERVE_*` / `VITE_*` values into the bundle.

## Checks

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm build
```

## Deploy

```bash
pnpm build     # → web/dist (relative asset paths)
```

Upload `web/dist` to any static host. Make sure the backend's
`WEB_ALLOWED_ORIGINS` includes the deployed origin.
`.github/workflows/web-pages.yml` automates GitHub Pages: set the
`NERVE_BACKEND_URL` repository variable and enable Pages with the "GitHub
Actions" source.
