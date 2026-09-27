import type { TaskCategoryDTO } from "../terminal/dto/wire";

export type MermaidGraph = {
  code: string;
  idToName: Map<string, string>;
};

const MAX_LABEL = 30;

function slug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return base.length > 0 ? base : "node";
}

function marker(status: TaskCategoryDTO["status"]): string {
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

function escapeLabel(label: string): string {
  return label.replace(/"/g, "'").replace(/\s+/g, " ").trim();
}

export function buildTaskMermaid(categories: TaskCategoryDTO[]): MermaidGraph {
  const idToName = new Map<string, string>();
  const nameToId = new Map<string, string>();
  const used = new Set<string>();

  for (const category of categories) {
    const base = slug(category.name);
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}_${suffix}`;
      suffix += 1;
    }
    used.add(id);
    idToName.set(id, category.name);
    nameToId.set(category.name, id);
  }

  const lines: string[] = ["graph LR"];

  for (const category of categories) {
    const id = nameToId.get(category.name);
    if (!id) {
      continue;
    }
    const done = category.tasks.filter((t) => t.status === "done").length;
    const progress = category.tasks.length > 0 ? ` ${done}/${category.tasks.length}` : "";
    let label = `${marker(category.status)} ${category.name}${progress}`;
    if (label.length > MAX_LABEL) {
      label = `${label.slice(0, MAX_LABEL - 1)}…`;
    }
    lines.push(`  ${id}["${escapeLabel(label)}"]`);
  }

  for (const category of categories) {
    const to = nameToId.get(category.name);
    if (!to) {
      continue;
    }
    for (const dep of category.depends_on) {
      const from = nameToId.get(dep);
      if (from && from !== to) {
        lines.push(`  ${from} --> ${to}`);
      }
    }
  }

  return { code: lines.join("\n"), idToName };
}
