import fs from "node:fs";
import path from "node:path";
import { GLOB_MAX_RESULTS, GREP_MAX_MATCHES, IGNORED_DIRS } from "../systemconfig/limits.js";
import { resolveSafePath } from "./workspace.js";

export function grepTool(
  pattern: string,
  search_path = ".",
  file_glob: string | null = null,
): string {
  const resolved = resolveSafePath(search_path);
  if (!resolved) return "Error: path outside workspace";

  const results: string[] = [];
  let regex: RegExp;
  try {
    regex = new RegExp(pattern);
  } catch {
    return `Error: invalid regex pattern: ${pattern}`;
  }

  walkDir(resolved, file_glob, (file_path) => {
    if (results.length >= GREP_MAX_MATCHES) return;
    try {
      const content = fs.readFileSync(file_path, "utf8");
      const lines = content.split("\n");
      for (const [line_index, line] of lines.entries()) {
        if (results.length >= GREP_MAX_MATCHES) break;
        if (regex.test(line)) {
          const rel = path.relative(process.cwd(), file_path);
          results.push(`${rel}:${line_index + 1}: ${line}`);
        }
      }
    } catch {
      // skip unreadable files
    }
  });

  return results.length > 0 ? results.join("\n") : "No matches found.";
}

export function globTool(pattern: string, search_path = "."): string {
  const resolved = resolveSafePath(search_path);
  if (!resolved) return "Error: path outside workspace";

  const results: string[] = [];
  const regex = globToRegex(pattern);

  walkDir(resolved, null, (file_path) => {
    if (results.length >= GLOB_MAX_RESULTS) return;
    const rel = path.relative(process.cwd(), file_path);
    if (regex.test(rel)) {
      results.push(rel);
    }
  });

  return results.length > 0 ? results.join("\n") : "No files found.";
}

function walkDir(dir: string, file_glob: string | null, cb: (file_path: string) => void): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, file_glob, cb);
    } else if (entry.isFile()) {
      if (file_glob && !globToRegex(file_glob).test(entry.name)) continue;
      cb(full);
    }
  }
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "___DOUBLE___")
    .replace(/\*/g, "[^/]*")
    .replace(/___DOUBLE___/g, ".*")
    .replace(/\?/g, "[^/]");
  return new RegExp(`^${escaped}$`);
}
