import fs from "node:fs";
import path from "node:path";
import { DEFAULT_READ_LIMIT, MAX_READ_BYTES } from "../systemconfig/limits.js";
import { resolveSafePath } from "./workspace.js";

export function writeTool(file_path: string, content: string, mode = "overwrite"): string {
  const resolved = resolveSafePath(file_path);
  if (!resolved) return "Error: path outside workspace";
  try {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    const flag = mode === "append" ? "a" : "w";
    fs.writeFileSync(resolved, content, { encoding: "utf8", flag });
    return `Written: ${file_path}`;
  } catch (e) {
    return `Error: ${e}`;
  }
}

export function editTool(file_path: string, old_string: string, new_string: string): string {
  const resolved = resolveSafePath(file_path);
  if (!resolved) return "Error: path outside workspace";
  try {
    const content = fs.readFileSync(resolved, "utf8");
    const count = content.split(old_string).length - 1;
    if (count === 0) return `Error: old_string not found in ${file_path}`;
    if (count > 1) return `Error: old_string matches ${count} times — must be unique`;
    fs.writeFileSync(resolved, content.replace(old_string, new_string), "utf8");
    return `Edited: ${file_path}`;
  } catch (e) {
    return `Error: ${e}`;
  }
}

export function readFileTool(file_path: string, offset = 1, limit = DEFAULT_READ_LIMIT): string {
  const resolved = resolveSafePath(file_path);
  if (!resolved) return "Error: path outside workspace";
  try {
    const raw = fs.readFileSync(resolved);
    const truncated = raw.slice(0, MAX_READ_BYTES);
    const text = truncated.toString("utf8");
    const lines = text.split("\n");
    const start = Math.max(0, offset - 1);
    const end = Math.min(lines.length, start + limit);
    const slice = lines.slice(start, end);
    const numbered = slice.map((l, i) => `${start + i + 1}: ${l}`).join("\n");
    const remaining = lines.length - end;
    const suffix = remaining > 0 ? `\n... ${remaining} more lines` : "";
    return numbered + suffix;
  } catch (e) {
    return `Error: ${e}`;
  }
}

export function listDirTool(directory_path: string): string {
  const resolved = resolveSafePath(directory_path);
  if (!resolved) return "Error: path outside workspace";
  try {
    return buildTree(resolved, "");
  } catch (e) {
    return `Error: ${e}`;
  }
}

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "__pycache__",
  ".venv",
  "venv",
  "dist",
  "build",
  ".next",
  ".pytest_cache",
  ".ruff_cache",
]);

function buildTree(dir: string, prefix: string): string {
  let result = "";
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach((entry, i) => {
    if (SKIP_DIRS.has(entry.name)) return;
    const connector = i === entries.length - 1 ? "└── " : "├── ";
    result += `${prefix}${connector}${entry.name}\n`;
    if (entry.isDirectory()) {
      const next_prefix = prefix + (i === entries.length - 1 ? "    " : "│   ");
      result += buildTree(path.join(dir, entry.name), next_prefix);
    }
  });
  return result;
}
