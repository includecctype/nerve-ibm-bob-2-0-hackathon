# Submission

> Submission checklist for the IBM Bob 2.0 Hackathon.

## Hard constraints

- **The presentation must be no longer than 5 minutes.** Same cap for the demo
  video.
- **Do not expose IBM Bob secrets** (API keys, tokens, credentials) anywhere in
  the repo, notes, screenshots, or video. The repo's gitleaks CI job is the
  enforcement of this rule: keep keys in environment variables, never committed.

## The three things judged

1. How well IBM Bob is applied to build this project.
2. Originality of the idea and solution.
3. Business value.

## IBM Bob usage for this project

IBM Bob did not autocomplete this project — it built it. Bob ran as the
engineering agent behind every change, and its configuration is committed so the
setup is reproducible.

### AI config in the repo

| Artifact | Purpose |
|---|---|
| `AGENTS.md` | Working agreement: plan first, ask before assuming, follow the rules. |
| `.opencode/opencode.json` | Runtime config: MCP servers, permissions, instruction files. |
| `.opencode/rules/*` | Structure, naming, Obsidian, and LibreOffice rules. |
| `.bob/mcp.json` + `.bob/rules/*` | The same MCP servers and rules, mirrored for Bob. |

### One worktree and one pull request per concern

Every change lived in its own **git worktree**, created beside the main checkout
and named `nerve-ibm-bob-2-0-hackathon-<topic>` (for example
`...-detached_execution`, `...-web_storage_client`, `...-sample_command`). Bob
implemented the change in the worktree, committed a scoped message, opened a pull
request with the `gh` CLI, waited for the checks, and merged only when they were
green. **84 concerns landed as 84 branches and 84 pull requests**, so `main`
never held unreviewed work. This is deliberate: it mirrors the product's own
message that independent workstreams should never block each other.

### What Bob built

- **Backend** — the LangChain/LangGraph agent layer, the DAG task-graph scheduler
  (`backend/ai_tool/task/`), the Socket.IO gateway, prompt queuing, rate limiting,
  OCI object storage, and detached background execution.
- **CLI** — the two-pane Ink/React terminal, the slash-command menu, the
  questionnaire, and the scroll model.
- **Web** — the Ink-in-xterm terminal, the IDE shell, the file explorer and
  viewer, and the `/sample` demo runner.
- **Review and hardening** — Bob reviewed diffs, hunted defects, and traced
  failures in tool round-trips, scheduler edge cases, and reconnect state; it
  explored alternatives (see [competition_analysis](competition_analysis.md))
  before committing to the task-graph design, and enforced the checks in
  [build_and_run](../engineering/build_and_run.md) (lint, format, typecheck,
  secret scan).

### MCP tooling for everything that is not code

Three MCP servers covered planning, documentation, design, and the presentation:

- **Obsidian — planning and documentation.** Bob maintained the project vault
  (`goal.md`, `project_map.md`, the engineering reference set, and the product
  notes) and kept it in sync as the code changed.
- **Penpot — design.** Bob produced the concept and architecture visuals and the
  web-workspace layout.
- **LibreOffice — the submission deck.** Bob drafted and refreshed the slides and
  PDF from the product notes.

### IBM watsonx.ai

The model layer is provider-agnostic: `backend/model/model_client.py` maps a model
id to a provider. That map includes **IBM watsonx.ai** — model 1 runs IBM Granite
on watsonx.ai, with credentials read from `WATSONX_API_KEY`,
`WATSONX_PROJECT_ID`, and `WATSONX_URL`. Because the gateway builds its agents
with LangChain, the same task graph, tools, scheduler, and prompt pipeline run
unchanged on Granite. (IBM watsonx Orchestrate was out of scope for this build.)

## Slides

- Start with the problem ([problem](problem.md)).
- Slide deck link (fill in).
- Competition analysis ([competition_analysis](competition_analysis.md)).
- Target users ([business_value](business_value.md)).
- Conceptual diagrams (see [architecture](../engineering/architecture.md)).
- How the product is used: the `/model → prompt → Tasks pane → questionnaire`
  loop, and the follow-up message that reports finished execution.
- A strong, real problem example: three prompts that change intent
  ("fix login" → "rethink auth" → "revert that") and how the persistent graph
  handles each.
- What IBM Bob does not have: Bob re-plans per request and keeps no cross-prompt
  task graph.

## Video

- Start with the problem.
- AI voice for clarity; video link (fill in).
- Same beats as the slides, demo-driven.
- **≤ 5 minutes.**

## PDF

- Problem → conceptual diagrams → competition → target users → how it is used →
  real example.

## Repo

- Show the AI config and Bob usage (above).
- Clean code, good algorithms (the DAG scheduler in `backend/ai_tool/task/`),
  good structure.
- Markdown docs under [`doc/`](../README.md).

## Demo

- Everything working end-to-end.
- Show the two-pane TUI and parallel categories in the Tasks pane; send a second
  prompt while work runs to show morphing into the running pass.

## Website

- Docs, link to the GitHub repo.
