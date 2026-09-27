# Competition Analysis

> Competitor statements are **EXTERNAL** (public docs, linked at the bottom).

## Thesis

Agentic tools like IBM Bob nailed the *execution* half of agentic coding but
treat every prompt as a fresh start. nerve targets the *continuity* half: a
persistent task graph that remembers, re-steers, and coordinates parallel work.

## Head-to-head: IBM Bob vs. nerve

| Capability | IBM Bob (external) | nerve |
|---|---|---|
| Main agent spawns isolated parallel subagents | Yes (`explore` read-only, `general` read/write) | Yes — fresh sub-agent per task |
| Consolidated view of parallel runs | Collapsible panel with aggregate stats | Two-pane TUI: live graph + conversation; per-category progress lines |
| Cross-prompt task memory and dedupe | Re-plans every request | Persistent graph; `processNewTask` morphs pending work; exact-dedupe |
| Re-steering while work runs | Amendments require restarting the prompt | Pending work reorganised live; running categories immutable |
| Dependency scheduling (sequential vs. simultaneous) | Model decides ad hoc | Explicit `depends_on` DAG, topological readiness, failure cascade |
| Automatic parallel dispatch | User approves each spawn | `executeCurrentTask` dispatches automatically |
| Runs file/shell work on the user's machine | n/a | Forwarded over Socket.IO to the CLI |

## The real difference: execution vs. structure

| | IBM Bob (external) | nerve |
|---|---|---|
| Unit of work | one ad-hoc subagent brief | persistent graph entry (category) |
| Task relationships | none as data | `depends_on` DAG, exact-dedupe, failure cascade |
| Lifespan | single request | across all prompts/sessions |
| Parallelism | improvised by the model | dispatched from explicit dependency readiness |

Bob solved *"how do I run isolated tasks in parallel?"* nerve solves *"what is
the structure of all the work, and how does it relate?"* Context isolation and
intent continuity are different axes.

## Distinct claims: mechanism → outcome

1. **Persistent task graph** → you don't re-explain; identical work is deduped.
2. **Live re-steering** → keep sending prompts while agents work; running work is
   never mutated, and new categories join the running pass.
3. **Dependency-aware dispatch** → parallel work coordinated by `depends_on`, not
   guessed.

## Wider field

Parallel subagents are standard across agentic coding tools (IBM Bob subagents,
Claude Code Task/subagents, OpenAI Codex). Few, if any, ship a cross-prompt task
graph that both remembers and re-steers; that memory is nerve's differentiation.

## Other agentic coding tools

The mainstream agentic coding tools are **request-scoped executors** (Claude
Code, OpenAI Codex, Cursor, Aider, OpenHands, Copilot): each prompt is planned on
its own, and steering means restarting the prompt. (Competitor statements are
external and descriptive, not endorsements.)

| Capability | Request-scoped agents (external) | nerve |
|---|---|---|
| Unit of work | one prompt / one spawned agent | an entry in a persistent work graph |
| Across prompts | re-plans from scratch | incremental re-planning on one living plan |
| Task relationships | implicit in the model's prose | first-class `depends_on`, dedupe, result flow |
| Re-steering while work runs | restart the prompt | pending work re-planned; running work untouched |
| Parallel dispatch | ad hoc / user-approved | triggered by dependency readiness |
| Where code runs (CLI) | per-tool (vendor or local) | on the user's machine; server is a thin orchestrator |

## Why not "just a scheduler"?

Airflow, Temporal, CI, and build systems already do scheduling, dedupe, and
dependency ordering. The claim is narrower: cross-prompt *memory for coding
agents*, because memory is what enables re-steering without restarting. The DAG is
the mechanism, not the story.

## Sources (external)

- https://bob.ibm.com/docs/ide — "Bob can break complex tasks into parallel workstreams by spawning specialized subagents."
- https://bob.ibm.com/docs/ide/features/subagents — subagent types, spawn approval, parallel panel.
- https://heidloff.net/article/workflows-sub-agents-ibm-bob — "Sub-agents are independent agent instances spawned by the primary agent."
