# nerve web

Browser workspace: the Ink terminal is rendered with
[ink-web](https://ink-web.dev) (real Ink components inside an xterm.js terminal
in the DOM). File explorer and file viewer panes are being added on top.

## Development

```bash
pnpm install
VITE_NERVE_BACKEND_URL=http://localhost:8000 pnpm dev
```

Without `VITE_NERVE_BACKEND_URL` the app connects to the public deployment.

## Checks

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm build
```

Build output goes to `web/dist/`; deploy it to any static host (GitHub Pages,
Hostinger, ...).
