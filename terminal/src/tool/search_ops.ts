import type { Stats } from "node:fs";
import { glob as fsGlob, readFile, stat } from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";
import { GLOB_MAX_RESULTS, GREP_MAX_MATCHES, IGNORED_DIR_NAMES } from "../systemconfig/limits";
import { resolveSafePath } from "./workspace";

function hasIgnoredPart(relative_path: string): boolean {
  return relative_path.split(sep).some((part) => IGNORED_DIR_NAMES.has(part));
}

// Python walked with rglob: the pattern is matched at any depth.
function recursivePattern(pattern: string): string {
  return pattern.startsWith("**/") ? pattern : `**/${pattern}`;
}

async function collectMatchingFiles(root: string, pattern: string): Promise<string[]> {
  const matches: string[] = [];
  for await (const entry of fsGlob(recursivePattern(pattern), { cwd: root })) {
    const full = resolve(root, entry);
    if (hasIgnoredPart(relative(root, full))) continue;
    try {
      if ((await stat(full)).isFile()) matches.push(full);
    } catch {
      // unreadable entry: skip it
    }
  }
  return matches.sort();
}

export async function grepTool(
  pattern: string,
  path: string,
  file_glob: string | null,
): Promise<string> {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern);
  } catch (e) {
    return `Error: invalid regex pattern: ${e instanceof Error ? e.message : String(e)}`;
  }

  const safe = resolveSafePath(path);
  if ("error" in safe) return safe.error;

  let root_stat: Stats;
  try {
    root_stat = await stat(safe.path);
  } catch {
    return `Error: Path does not exist: ${path}`;
  }

  let files: string[];
  if (root_stat.isFile()) {
    files = [safe.path];
  } else if (root_stat.isDirectory()) {
    files = await collectMatchingFiles(safe.path, file_glob ?? "*");
  } else {
    return `Error: Path does not exist: ${path}`;
  }

  const matches: string[] = [];
  for (const file_path of files) {
    let text: string;
    try {
      text = await readFile(file_path, "utf8");
    } catch {
      continue;
    }

    const lines = text.split(/\r\n|\r|\n/);
    if (text.endsWith("\n") || text.endsWith("\r")) lines.pop();

    for (const [index, line] of lines.entries()) {
      if (!regex.test(line)) continue;
      const label = root_stat.isFile() ? basename(file_path) : relative(safe.path, file_path);
      matches.push(`${label}:${index + 1}: ${line.trimEnd()}`);
      if (matches.length >= GREP_MAX_MATCHES) {
        return `${matches.join("\n")}\n... [stopped at ${GREP_MAX_MATCHES} matches]`;
      }
    }
  }

  return matches.length > 0 ? matches.join("\n") : "No matches found";
}

export async function globTool(pattern: string, path: string): Promise<string> {
  const safe = resolveSafePath(path);
  if ("error" in safe) return safe.error;

  let root_stat: Stats;
  try {
    root_stat = await stat(safe.path);
  } catch {
    return `Error: Path is not a directory: ${path}`;
  }
  if (!root_stat.isDirectory()) {
    return `Error: Path is not a directory: ${path}`;
  }

  const results: { path: string; modified: number }[] = [];
  for await (const entry of fsGlob(pattern, { cwd: safe.path })) {
    const full = resolve(safe.path, entry);
    if (hasIgnoredPart(relative(safe.path, full))) continue;
    try {
      const entry_stat = await stat(full);
      if (entry_stat.isFile()) {
        results.push({ path: full, modified: entry_stat.mtimeMs });
      }
    } catch {
      // unreadable entry: skip it
    }
  }

  if (results.length === 0) return "No files matched";

  // Newest first, as the tool description promises.
  results.sort((a, b) => b.modified - a.modified);
  const shown = results.slice(0, GLOB_MAX_RESULTS);
  const lines = shown.map((entry) => entry.path);
  if (results.length > GLOB_MAX_RESULTS) {
    lines.push(`... [showing ${GLOB_MAX_RESULTS} of ${results.length} matches]`);
  }
  return lines.join("\n");
}
