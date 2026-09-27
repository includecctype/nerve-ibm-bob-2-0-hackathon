# Solution

Engineering detail: [pipelines](../engineering/pipelines.md),
[data_model](../engineering/data_model.md),
[architecture](../engineering/architecture.md).

## Positioning: close the continuity gap

Agentic tools assume every prompt is a fresh start: miss a detail and you restart
the whole prompt; once agents spawn you cannot change course; every request
re-plans from nothing.

nerve closes that gap with a **persistent task graph** built around agents that
already exist. The graph and its ordering are the *mechanism*; continuity and
safe re-steering are the *point*.

## 1) Persistent task graph

### Core principle: running work is never touched

Work an agent has already begun is immutable. When a new prompt arrives, only
**pending** categories are re-matched, merged, re-ordered, or re-validated. This
is what makes the "keep sending prompts" model safe: amendments steer the plan
forward; they never race an executor mid-change. Implemented by rejecting or
renaming name collisions with running categories (`repairGraph`, `validateGraph`)
and by replacing only `pending_categories`.

### Relationships are first-class data

Every graph entry carries its relationships as inspectable fields:

- **depends-on** → explicit DAG edges (`depends_on`)
- **duplicates** → exact-dedupe when the model returns the morphed pending list
- **results** → each category's task results are stored and fed to its dependents

| | Question asked | Where it lives | Lifespan |
|---|---|---|---|
| Typical agent tool | "Can this run in parallel right now?" | ad hoc, in the model's head | one request |
| nerve | "What should run, in what order, given everything already asked?" | graph fields (`name`, `tasks`, `depends_on`, `status`, `result`) | across prompts and sessions |

### Algorithm

When a prompt arrives:

1. **Decomposition** — the main agent breaks it into categories
   `{name, tasks, depends_on}`. Running work is untouched.
2. **Morph, not re-plan** — the agent returns the **complete pending graph**;
   `mergeCategoryLists` treats that list as authoritative (exact-dedupe inside
   it). Structural issues are auto-repaired, cycles rejected.
3. **Dependency marking** — `depends_on` is validated as a DAG (Kahn). Categories
   run in parallel as soon as dependencies finish.
4. **Dispatch** — `executeCurrentTask` starts a background pass; ready categories
   begin immediately, and a failure cascades `blocked` to dependents.
5. **Results** — when the pass drains, the main agent reports the outcome in a
   dedicated follow-up message.

### Why this is not IBM Bob

Bob re-plans each request in isolation and keeps no cross-prompt graph. The
persistent graph is the core difference. See
[competition_analysis](competition_analysis.md).

## 2) Execution

nerve uses the standard pattern — a main agent spawning isolated parallel
sub-agents — but dispatch is **driven by the graph**, not by a per-request model
decision.

- **Automatic dispatch** — `executeCurrentTask` starts every ready category and
  runs the pass in the background.
- **Non-blocking planning** — because execution is detached, a new prompt is
  planned immediately, and categories it morphs in **join the running pass**
  (a planning gate closes the exit race).
- **Isolation** — each task gets a fresh sub-agent with file/shell/web tools.
- **Safety** — running categories are immutable; only pending work changes.

## 3) Client-side execution

In the CLI, file and shell tools are forwarded over Socket.IO and executed on the
user's machine, so code and secrets never leave the laptop. In the web workspace
the same tools run server-side against the session's OCI folder, so the browser
never holds storage credentials.

## 4) Alternatives weighed

- **Bigger context windows only** — extend the per-prompt horizon but cannot
  steer already-spawned work and create no cross-prompt memory.
- **Better multi-agent UI / tabs** — improve visibility but do not resolve
  duplication or ordering.

The graph is deliberately not a general-purpose scheduler (Airflow/Temporal/CI).
It is the simplest structure that gives agents cross-prompt memory, because that
memory is what makes re-steering possible.
