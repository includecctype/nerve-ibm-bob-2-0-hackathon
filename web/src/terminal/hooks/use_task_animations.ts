import { useEffect, useMemo, useRef, useState } from "react";
import type { TaskCategoryDTO } from "../dto/wire";
import { taskAnimKey } from "../ui/task_graph";

const TICK_MS = 100;
const IN_MS = 500;
const PULSE_MS = 500;
const OUT_MS = 500;

export type TaskAnimPhase = "in" | "pulse" | "out";

type AnimEntry = { phase: TaskAnimPhase; expires: number };

type GhostEntry = {
  category: TaskCategoryDTO;
  insertAt: number;
  expires: number;
};

export type TaskAnimState = {
  frame: number;
  displayCategories: TaskCategoryDTO[];
  ghostNames: Set<string>;
  phaseOf: (animKey: string) => TaskAnimPhase | null;
};

function noteTaskDiffs(
  anims: Map<string, AnimEntry>,
  before: TaskCategoryDTO,
  after: TaskCategoryDTO,
  now: number,
): void {
  const beforeByNameIndex = new Map(before.tasks.map((t, i) => [t.description, i]));
  after.tasks.forEach((task, index) => {
    const priorIndex = beforeByNameIndex.get(task.description);
    const prior = priorIndex === undefined ? undefined : before.tasks[priorIndex];
    if (prior === undefined) {
      anims.set(taskAnimKey(after.name, index), { phase: "in", expires: now + IN_MS });
      return;
    }
    if (prior.status !== task.status) {
      anims.set(taskAnimKey(after.name, index), { phase: "pulse", expires: now + PULSE_MS });
    }
  });
}

export function useTaskAnimations(tasks: TaskCategoryDTO[]): TaskAnimState {
  const prevRef = useRef<{ categories: TaskCategoryDTO[]; indexes: Map<string, number> } | null>(
    null,
  );
  const animsRef = useRef(new Map<string, AnimEntry>());
  const ghostsRef = useRef(new Map<string, GhostEntry>());
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const prev = prevRef.current;
    if (!prev) {
      prevRef.current = {
        categories: tasks,
        indexes: new Map(tasks.map((c, i) => [c.name, i])),
      };
      return;
    }
    const now = Date.now();
    const prevByName = new Map(prev.categories.map((c) => [c.name, c]));
    const currByName = new Map(tasks.map((c) => [c.name, c]));

    for (const [name, category] of currByName) {
      const before = prevByName.get(name);
      if (!before) {
        animsRef.current.set(taskAnimKey(name), { phase: "in", expires: now + IN_MS });
        ghostsRef.current.delete(name);
        continue;
      }
      if (before.status !== category.status) {
        animsRef.current.set(taskAnimKey(name), { phase: "pulse", expires: now + PULSE_MS });
      }
      noteTaskDiffs(animsRef.current, before, category, now);
    }

    for (const [name, category] of prevByName) {
      if (currByName.has(name)) {
        continue;
      }
      const prevIndex = prev.indexes.get(name) ?? 0;
      const insertAt = tasks.filter(
        (c) => (prev.indexes.get(c.name) ?? Number.MAX_SAFE_INTEGER) < prevIndex,
      ).length;
      animsRef.current.set(taskAnimKey(name), { phase: "out", expires: now + OUT_MS });
      ghostsRef.current.set(name, { category, insertAt, expires: now + OUT_MS });
    }

    prevRef.current = {
      categories: tasks,
      indexes: new Map(tasks.map((c, i) => [c.name, i])),
    };
  }, [tasks]);

  useEffect(() => {
    // Restart the ticker whenever a new snapshot arrives so fresh animations run.
    void tasks;
    const hasActive = () => {
      const now = Date.now();
      for (const entry of animsRef.current.values()) {
        if (entry.expires > now) {
          return true;
        }
      }
      for (const ghost of ghostsRef.current.values()) {
        if (ghost.expires > now) {
          return true;
        }
      }
      return false;
    };
    if (!hasActive()) {
      return;
    }
    const timer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of animsRef.current) {
        if (entry.expires <= now) {
          animsRef.current.delete(key);
        }
      }
      for (const [key, ghost] of ghostsRef.current) {
        if (ghost.expires <= now) {
          ghostsRef.current.delete(key);
        }
      }
      setFrame((f) => f + 1);
      if (!hasActive()) {
        clearInterval(timer);
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [tasks]);

  const { displayCategories, ghostNames } = useMemo(() => {
    void frame;
    const now = Date.now();
    const ghosts = [...ghostsRef.current.entries()].filter(([, g]) => g.expires > now);
    const list = [...tasks];
    const sorted = ghosts.sort((a, b) => a[1].insertAt - b[1].insertAt);
    for (let i = sorted.length - 1; i >= 0; i--) {
      const ghost = sorted[i];
      if (ghost) {
        list.splice(Math.min(ghost[1].insertAt, list.length), 0, ghost[1].category);
      }
    }
    return {
      displayCategories: list,
      ghostNames: new Set(ghosts.map(([name]) => name)),
    };
    // frame forces recompute while animations tick
  }, [tasks, frame]);

  const phaseOf = (animKey: string): TaskAnimPhase | null => {
    void frame;
    const entry = animsRef.current.get(animKey);
    if (!entry || entry.expires <= Date.now()) {
      return null;
    }
    return entry.phase;
  };

  return { frame, displayCategories, ghostNames, phaseOf };
}
