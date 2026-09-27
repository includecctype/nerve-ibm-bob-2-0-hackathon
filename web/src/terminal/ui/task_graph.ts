import type { TaskCategoryDTO, TaskItemStatus } from "../dto/wire";
import { wrapLines } from "./text_window";

export function taskAnimKey(category: string, taskIndex?: number): string {
  return taskIndex === undefined ? category : `${category}::t#${taskIndex}`;
}

export type TaskGraphRow =
  | {
      type: "category";
      key: string;
      animKey: string;
      prefix: string;
      label: string;
      status: TaskCategoryDTO["status"];
      waitsOn: string;
      doneCount: number;
      totalCount: number;
      ghost: boolean;
    }
  | {
      type: "task_line";
      key: string;
      animKey: string;
      prefix: string;
      status: TaskItemStatus;
      text: string;
      showGutter: boolean;
      ghost: boolean;
    }
  | { type: "blank"; key: string };

export type TaskGraph = {
  rows: TaskGraphRow[];
  maxHScroll: number;
};

type CategoryNode = {
  category: TaskCategoryDTO;
  ghost: boolean;
};

const TASK_GUTTER = 2;

export function statusMarker(status: TaskCategoryDTO["status"]): string {
  switch (status) {
    case "done":
      return "✓";
    case "failed":
      return "✗";
    case "blocked":
      return "⊘";
    case "running":
      return "▶";
    default:
      return "·";
  }
}

function categoryRowLength(node: CategoryNode, prefix: string): number {
  const { category } = node;
  const done = category.tasks.filter((t) => t.status === "done").length;
  const progress = category.tasks.length > 0 ? ` (${done}/${category.tasks.length})` : "";
  const running = category.status === "running" ? " …" : "";
  const waits =
    (category.status === "pending" || category.status === "blocked") &&
    category.depends_on.length > 0
      ? ` (waits: ${category.depends_on.join(", ")})`
      : "";
  return prefix.length + 2 + category.name.length + progress.length + running.length + waits.length;
}

export function buildTaskGraphRows(
  categories: TaskCategoryDTO[],
  textWidth: number,
  ghostNames: ReadonlySet<string> = new Set(),
): TaskGraph {
  if (categories.length === 0) {
    return { rows: [], maxHScroll: 0 };
  }

  const nodes = new Map<string, CategoryNode>(
    categories.map((category) => [
      category.name,
      { category, ghost: ghostNames.has(category.name) },
    ]),
  );

  const indegree = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const category of categories) {
    const deps = category.depends_on.filter((d) => nodes.has(d) && d !== category.name);
    indegree.set(category.name, deps.length);
    for (const dep of deps) {
      children.set(dep, [...(children.get(dep) ?? []), category.name]);
    }
  }
  const originalIndegree = new Map(indegree);

  const order: string[] = [];
  const queue = categories.filter((c) => (indegree.get(c.name) ?? 0) === 0).map((c) => c.name);
  let queueCursor = 0;
  while (queueCursor < queue.length) {
    const name = queue[queueCursor];
    if (name === undefined) {
      break;
    }
    queueCursor += 1;
    order.push(name);
    for (const child of children.get(name) ?? []) {
      const next = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, next);
      if (next === 0) {
        queue.push(child);
      }
    }
  }
  const cyclic = order.length !== categories.length;

  // Pass 1: assign each category at most one parent so the DAG renders as a forest.
  // Sibling positions are fixed here so connectors are correct even when a node
  // has multiple dependencies (it is claimed by the first one encountered).
  const parentOf = new Map<string, string | null>();
  const treeChildren = new Map<string, string[]>();
  const claim = (name: string, parent: string | null, descend: boolean): void => {
    if (parentOf.has(name)) {
      return;
    }
    parentOf.set(name, parent);
    const kids: string[] = [];
    treeChildren.set(name, kids);
    if (!descend) {
      return;
    }
    for (const kid of children.get(name) ?? []) {
      if (parentOf.has(kid)) {
        continue;
      }
      parentOf.set(kid, name);
      kids.push(kid);
    }
    for (const kid of kids) {
      claim(kid, name, true);
    }
  };

  if (cyclic) {
    for (const category of categories) {
      claim(category.name, null, false);
    }
  } else {
    for (const root of order.filter((name) => (originalIndegree.get(name) ?? 0) === 0)) {
      claim(root, null, true);
    }
    for (const name of order) {
      claim(name, null, true);
    }
  }

  // Pass 2: render the forest with box-drawing connectors.
  const rows: TaskGraphRow[] = [];
  let maxRowLength = 0;

  const renderCategory = (name: string, ancestorClosers: string[], connector: string): void => {
    const node = nodes.get(name);
    if (!node) {
      return;
    }
    const { category } = node;
    const prefix = `${ancestorClosers.join("")}${connector}`;
    const done = category.tasks.filter((t) => t.status === "done").length;
    const waitsOn =
      !cyclic &&
      (category.status === "pending" || category.status === "blocked") &&
      category.depends_on.length > 0
        ? category.depends_on.filter((d) => nodes.has(d)).join(", ")
        : "";
    rows.push({
      type: "category",
      key: `c-${name}`,
      animKey: taskAnimKey(name),
      prefix,
      label: category.name,
      status: category.status,
      waitsOn,
      doneCount: done,
      totalCount: category.tasks.length,
      ghost: node.ghost,
    });
    maxRowLength = Math.max(maxRowLength, categoryRowLength(node, prefix));

    const closer = connector === "" ? "" : connector.endsWith("└─ ") ? "   " : "│  ";
    const childClosers = [...ancestorClosers, closer];

    if (category.status === "running" || category.status === "failed") {
      const taskPrefix = childClosers.join("");
      category.tasks.forEach((task, taskIndex) => {
        const wrapWidth = Math.max(4, textWidth - taskPrefix.length - TASK_GUTTER);
        const wrapped = wrapLines(task.description, wrapWidth);
        wrapped.forEach((text, lineIndex) => {
          rows.push({
            type: "task_line",
            key: `t-${name}-${taskIndex}:${lineIndex}`,
            animKey: taskAnimKey(name, taskIndex),
            prefix: taskPrefix,
            status: task.status,
            text,
            showGutter: lineIndex === 0,
            ghost: node.ghost,
          });
        });
      });
    }

    const kids = treeChildren.get(name) ?? [];
    kids.forEach((kid, kidIndex) => {
      renderCategory(kid, childClosers, kidIndex === kids.length - 1 ? "└─ " : "├─ ");
    });
  };

  const roots = order.filter((name) => parentOf.get(name) === null);
  const rootNames = roots.length > 0 ? roots : categories.map((c) => c.name);
  for (const root of rootNames) {
    renderCategory(root, [], "");
    rows.push({ type: "blank", key: `b-${root}` });
  }

  return { rows, maxHScroll: Math.max(0, maxRowLength - textWidth) };
}
