# Problem

Agentic AI development workflows suffer from a **continuity gap**: every prompt
is treated as if nothing happened before it, and once work is running you cannot
change course.

1. **One-shot prompts, forced restarts** — If you miss a detail or change your
   mind mid-task, you are expected to restart the whole prompt and lose the
   running work. There is no way to keep sending prompts that steer work already
   in progress.

2. **Re-planned from scratch** — Each prompt is decomposed into tasks as if
   nothing were remembered across prompts. Overlapping work accumulates,
   identical work gets redone, and there is no cross-session memory of what was
   already asked.

3. **No coordination across parallel work** — Independent work blocks behind
   dependent work, and divergent streams drift out of alignment (for example,
   parallel tasks on git worktrees for backend, frontend, and docs finish
   inconsistent and are painful to merge).

4. **Fragmented interaction** — When multiple agents run in parallel, their
   outputs and questions arrive uncoordinated, and the developer becomes the
   manual merge layer.

**The root cause: tasks have no relationship model.** Tools judge each task in
isolation ("is this self-contained enough to spawn?") — but *relationships
between tasks* — depends-on, duplicates, can-run-with — never exist as data.
Ordering, at best, lives implicitly in the model's prose inside a single request
and is discarded the moment the request ends. Parallelism without a relationship
model is improvisation: independent work blocks behind dependent work, and
divergent streams finish inconsistent.

## What nerve builds from this

A **persistent task graph** where those relationships *are* the data:
`depends_on` (a DAG), status, and results survive across prompts and sessions,
and only pending work is ever reshaped. That is the concrete answer to the
continuity gap: keep sending prompts, and they steer the plan forward instead of
restarting it.
