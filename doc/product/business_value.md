# Business Value

The argument below is built from what nerve actually does.

## The pain (and why it costs money)

Agentic coding tools (IBM Bob, Claude Code, Cursor, Copilot, Codex) all share
three costs that the developer pays in tokens and attention:

1. **Re-planning from scratch.** Each prompt is decomposed as if nothing came
   before. Overlapping and duplicate work gets redone; intent from earlier
   prompts is discarded.
2. **No steering.** Once agents spawn, changing course means restarting the
   prompt and losing in-flight work.
3. **Coordination overhead.** Parallel work is improvised by the model; dependent
   work can block or diverge, and multiple agents surface questions
   independently. The developer becomes the merge layer.

## What nerve does about it

| Value lever | Mechanism in nerve | Buyer's metric |
|---|---|---|
| **Stop redoing work** | Persistent task graph per session; `processNewTask` morphs pending work instead of re-planning (`mergeCategoryLists`, exact-dedupe) | tokens, wall-clock |
| **Safe parallelism** | Explicit `depends_on` DAG; categories run in parallel the moment dependencies are `done`; failure cascades to `blocked` (`validateGraph`, `readyCategories`, `cascadeBlocked`) | throughput, fewer broken builds |
| **Steer without restarting** | Running categories are immutable; a new prompt is planned immediately and its categories join the running pass (prompt queue + detached execution) | responsiveness |
| **Keep code private** | CLI file/shell tools execute **on the user's machine**; the server never reads the workspace (`delegation/`, `terminal/src/tool/`). Only model calls + optional web search leave the laptop | security review, procurement |
| **Cheap to run** | Server is a thin Socket.IO + model orchestrator; no database, queue, or filesystem state. Sessions persist as a local JSON file | infra cost |
| **Fewer context switches** | Main-agent-only structured questionnaire with a forced write-in option; one place to answer, not N sub-agent threads | attention |

The product is a **coordination layer**, not another executor: it is the memory +
scheduling + interaction shell around agents that already exist.

## Where the value compounds

- **Cost avoidance:** if a team spends on agent tokens and review time, even a
  small reduction in duplicate work and re-planning pays for the layer.
- **Onboarding:** a persistent graph is a readable record of "what was asked and
  why", which shortens handoffs.

## Who buys

- **Primary:** engineering teams (5–200 devs) already paying for one or more
  agentic tools, where a lead owns velocity and token spend.
- **Best fit:** teams with **security constraints** (code must not leave
  developer machines) and **cost constraints** (runaway agent spend) — nerve's
  client-side execution and thin server directly address both.

## Defensibility

- **The graph is data.** Merges, blocking, and reordering are inspectable state,
  not model prose.
- **Client-side execution as a trust story.** "Your code never reaches our
  servers" is a concrete, checkable property of the architecture.
- The moat is execution quality and distribution, not a patent.
