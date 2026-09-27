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

This section explains how IBM Bob was used to build the project, and where the
instructions live. The AI config files are verifiable in the repo.

### AI config in the repo

| Artifact | Purpose |
|---|---|
| `AGENTS.md` | Top-level working agreement: coding instincts, plan-first, ask-before-assuming, follow the rules. |
| `.opencode/opencode.json` | Agent runtime config: MCP servers (Obsidian, LibreOffice, Penpot), permissions, instruction file list. |
| `.opencode/rules/structure.md` | Project structure and naming rules (snake_case files, specific folders, no generic names). |
| `.opencode/rules/variable.md` | Naming conventions (camelCase functions, PascalCase classes/enums, FULL_CAPS env vars). |
| `.opencode/rules/obsidian.md` | Rules for writing into the Obsidian vault (the documentation set). |
| `.opencode/rules/libreoffice.md` | Rules for generating documents/PDF via LibreOffice. |
| `.bob/mcp.json` + `.bob/rules/*` | Mirrored Bob agent configuration (same rules and MCP servers). |

MCP servers wired into the agent: **Obsidian** (write and maintain the notes),
**LibreOffice** (generate the submission PDF/deck), **Penpot**
(concept/architecture visuals).

### How Bob was directed to work

- **Git worktrees per workstream** — separate worktrees and pull requests per
  concern, so parallel work never collides and merges stay clean. This mirrors the
  product's own message: independent workstreams should not block each other.
- **Bug checking** — Bob reviewed code, hunted defects, and traced failures (for
  example tool round-trips and scheduler edge cases).
- **Solution and idea generation** — Bob explored approaches and alternatives
  (see [competition_analysis](competition_analysis.md)) before committing to the
  task-graph design.
- **Documentation** — Bob maintains the vault via the Obsidian MCP, producing the
  project map and the engineering references from the code.
- **Assets** — Bob generated the submission PDF/deck through the LibreOffice MCP
  and concept visuals via Penpot.
- **Rules enforcement** — Bob followed the checks in
  [build_and_run](../engineering/build_and_run.md) (lint, format, typecheck,
  secret scan) and the naming/structure rules in `.opencode/rules/`.

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
