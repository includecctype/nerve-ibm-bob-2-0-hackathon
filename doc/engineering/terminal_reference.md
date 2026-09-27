# Terminal Reference (nerve CLI)

Root: `terminal/`. Node 22, pnpm, ESM, **Ink 6 + React 19**. Bin: `nerve`
(`dist/app.js`, built by `tsup`). Scripts: `dev` (`tsx src/app.tsx`), `build`
(`tsup`), `start`, `typecheck` (`tsc --noEmit`), `lint`/`format` (Biome).

## Composition

`src/app.tsx` is the whole screen: it owns all React state (`displays`, `tasks`,
`questions`, `command_mode`, `input_value`), computes layout via `useLayout`,
handles keyboard in a single `useInput`, and renders either the logo view or the
two-pane workspace.

| Area | Files | Notes |
|---|---|---|
| UI panes | `ui/task_pane.tsx`, `ui/chat_viewport.tsx`, `ui/prompt_box.tsx`, `ui/logo_view.tsx`, `ui/command_overlay.tsx`, `ui/status_footer.tsx`, `ui/text_window.ts`, `ui/theme.ts` | Tasks pane shows category markers (✓ ✗ ⊘ ▶), per-category `(waits: …)`, and a spinner on running tasks. Footer shows `NERVE`, cwd (uppercased), model label. |
| Commands | `command/*` | Slash commands + selection overlays |
| Hooks | `hooks/use_layout.ts`, `hooks/use_bracketed_paste.ts`, `hooks/use_mouse_wheel.ts` | Layout math, safe multi-line paste, wheel scrolling |
| Socket | `socket/*` | Client, listeners, handler registry, emitters |
| Tools | `tool/*` | Local execution of forwarded file/shell calls |
| Persistence | `save/*`, `session/user_data.ts` | JSON config read/write |
| Config | `systemconfig/limits.ts`, `systemconfig/model.ts`, `systemconfig/file.ts` | Local limits, model list, config path/name |

## Slash commands

| Command | Behavior |
|---|---|
| `/model` | Pick a model (current first); if a key is missing, prompt for it, then reconnect |
| `/key` | Pick a model and (re)enter its API key; reconnects if it is the active model |
| `/session` | Choose a saved session or start a new one; reloads graph + history and reconnects |
| `/restart` | Flush config, reconnect socket, clear the UI back to the logo |
| `/exit` | Flush config and quit |

Unknown `/...` input prints a hint listing the valid commands
(`terminal/src/app.tsx`). Suggestions appear as you type `/`.

## Keybindings & input

- **Chat scroll:** PageUp/PageDown (viewport), Home/End (top/bottom), ↑/↓ (1 line,
  suppressed when the prompt is multi-line).
- **Tasks scroll:** Ctrl+↑ / Ctrl+↓.
- **Mouse wheel:** scrolls chat, or the Tasks pane when the pointer is over it.
- **Esc:** cancels an overlay or exits the questionnaire write-in box.
- **Bracketed paste:** paste markers are stripped and CR→LF normalised so
  multi-line paste never auto-submits (`hooks/use_bracketed_paste.ts`).
- **SIGINT/SIGTERM:** flush `user_data` to disk then exit.

## Questionnaire UX

`command/questionnaire_box.tsx` renders one question at a time with `@inkjs/ui`
`Select`. It always appends an `other` option and reroutes model-supplied options
matching `/other|custom|none of the above|…/i` to a free-text box, so "other" is
never shown twice (`isOtherLikeOption`, `buildQuestionOptions`). Answers are
accumulated then emitted together via `questionnaire_answers`; each answer is also
appended to the chat as a `Q: ... / A: ...` system entry.

## Local tool execution

`tool/executor.ts` dispatches a `tool_request` to one of:

- `write` / `edit` / `readFile` / `listDir` → `tool/file_ops.ts`
- `grep` / `glob` → `tool/search_ops.ts`
- `terminalCommand` → `tool/shell.ts`

All paths go through `tool/workspace.ts::resolveSafePath`: the workspace is
`resolve(process.cwd())`; `~` is expanded; a resolved path outside the workspace
returns `Error: path outside workspace`. It never throws to the model — every
outcome is a string (`Error:`-prefixed on failure).

Local limits (`systemconfig/limits.ts`): `COMMAND_TIMEOUT_MS=30000`,
`OUTPUT_CHAR_CAP=8000`, `MAX_READ_BYTES=100000`, `DEFAULT_READ_LIMIT=500`,
`GREP_MAX_MATCHES=50`, `GLOB_MAX_RESULTS=100`; ignored dirs `.git, node_modules,
__pycache__, .venv, venv, dist, build, .next, .pytest_cache, .ruff_cache`.
`shell.ts` uses `child_process.exec` with `cwd = process.cwd()` and a `maxBuffer`
of 10 MB, killing the child at the timeout.

## Persistence

- File: `<cwd>/user_config/config.json` (`save/config_path.ts`).
- `ensureConfigFile()` creates it with the default on first run; `readConfig()`
  loads API keys + model and starts a fresh, uncommitted session id.
- `commitSession()` is called on the first prompt; only committed sessions are
  written into `session{}`.
- Writes are serialized and debounced 50 ms (`save/config_writer.ts`);
  `waitForWrites()` is awaited before reconnects and exit to avoid losing data.
- Loading a session runs `migrateSessionCategories` to upgrade legacy flat task
  lists into a single `tasks` category.

## Environment

| Var | Purpose | Default |
|---|---|---|
| `NERVE_BACKEND_URL` | Backend Socket.IO URL | the CLI's built-in deployment fallback when unset |

Set `NERVE_BACKEND_URL` explicitly to target a gateway, e.g.
`https://nerve-ibm-bob-2-0-hackathon.onrender.com` (reference deployment) or
`http://localhost:8000` (local backend).

Authentication sends `api_key`, `main_agent_id`, `client_kind: "cli"`,
`categories`, and `history` (`socket/client.ts`). The CLI offers models 1–5; the
provided model 6 is web-only.

## Build & packaging

`tsup.config.ts` bundles `src/app.tsx` to ESM with a `#!/usr/bin/env node`
banner; `package.json` maps `bin.nerve` → `./dist/app.js`.
