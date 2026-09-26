import { lstat, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { IGNORED_DIR_NAMES, MAX_READ_BYTES } from "../systemconfig/limits";
import { resolveSafePath } from "./workspace";

export async function writeFileTool(
  file_path: string,
  content: string,
  mode: string,
): Promise<string> {
  if (mode !== "overwrite" && mode !== "append") {
    return `Error: mode must be 'overwrite' or 'append', got: ${mode}`;
  }

  const safe = resolveSafePath(file_path);
  if ("error" in safe) return safe.error;

  await mkdir(dirname(safe.path), { recursive: true });
  await writeFile(safe.path, content, {
    encoding: "utf8",
    flag: mode === "overwrite" ? "w" : "a",
  });

  return `Successfully ${mode === "overwrite" ? "overwritten" : "appended to"} file: ${file_path}`;
}

export async function editTool(
  file_path: string,
  old_string: string,
  new_string: string,
): Promise<string> {
  if (!old_string) return "Error: old_string must be non-empty";

  const safe = resolveSafePath(file_path);
  if ("error" in safe) return safe.error;

  try {
    await lstat(safe.path);
  } catch {
    return `Error: Path does not exist: ${file_path}`;
  }
  if ((await stat(safe.path)).isDirectory()) {
    return `Error: Path is a directory, not a file: ${file_path}`;
  }

  const content = await readFile(safe.path, "utf8");
  const count = content.split(old_string).length - 1;
  if (count === 0) return "Error: old_string not found in file";
  if (count > 1) {
    return `Error: old_string found ${count} times; add more context to make it unique`;
  }

  await writeFile(safe.path, content.replace(old_string, new_string), "utf8");
  return `Successfully edited file: ${file_path}`;
}

// splitlines()-compatible for the line terminators found in real files.
function splitLines(text: string): string[] {
  const lines = text.split(/\r\n|\r|\n/);
  if (text.endsWith("\n") || text.endsWith("\r")) lines.pop();
  return lines;
}

export async function readFileTool(
  file_path: string,
  offset: number,
  limit: number,
): Promise<string> {
  const safe = resolveSafePath(file_path);
  if ("error" in safe) return safe.error;

  try {
    await lstat(safe.path);
  } catch {
    return `Error: Path does not exist: ${file_path}`;
  }
  if ((await stat(safe.path)).isDirectory()) {
    return `Error: Path is a directory, not a file: ${file_path}`;
  }
  if (offset < 1) return "Error: offset must be >= 1";
  if (limit < 1) return "Error: limit must be >= 1";

  const size = (await stat(safe.path)).size;
  const truncated_file = size > MAX_READ_BYTES;

  let raw = await readFile(safe.path, "utf8");
  if (truncated_file) raw = raw.slice(0, MAX_READ_BYTES);
  const lines = splitLines(raw);

  const window = lines.slice(offset - 1, offset - 1 + limit);
  if (window.length === 0) {
    return `Error: offset ${offset} is past end of file (${lines.length} lines)`;
  }

  let numbered = window.map((line, i) => `${offset + i}: ${line}`).join("\n");

  const notes: string[] = [];
  if (truncated_file) {
    notes.push(`Note: file truncated at ${MAX_READ_BYTES} bytes for reading.`);
  }
  const end = offset - 1 + window.length;
  if (end < lines.length) {
    notes.push(`Note: showed lines ${offset}-${end}; more lines remain (use offset/limit).`);
  }
  if (notes.length > 0) numbered = `${numbered}\n${notes.join("\n")}`;
  return numbered;
}

const TREE_ELBOW = "└── ";
const TREE_TEE = "├── ";
const TREE_PIPE_PREFIX = "│   ";
const TREE_SPACE_PREFIX = "    ";

async function walkTree(directory: string, prefix: string, lines: string[]): Promise<void> {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch {
    return;
  }

  const entries = names
    .filter((name) => !IGNORED_DIR_NAMES.has(name))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  if (entries.length === 0) return;

  const last_index = entries.length - 1;
  for (const [index, name] of entries.entries()) {
    const is_last = index === last_index;
    const entry_path = join(directory, name);
    let is_dir = false;
    try {
      is_dir = (await lstat(entry_path)).isDirectory();
    } catch {
      continue;
    }

    const connector = is_last ? TREE_ELBOW : TREE_TEE;
    lines.push(`${prefix}${connector}${name}${is_dir ? "/" : ""}`);

    if (is_dir) {
      const child_prefix = is_last ? TREE_SPACE_PREFIX : TREE_PIPE_PREFIX;
      await walkTree(entry_path, `${prefix}${child_prefix}`, lines);
      if (!is_last) lines.push(`${prefix}│`);
    }
  }
}

export async function listDirTool(directory_path: string): Promise<string> {
  const safe = resolveSafePath(directory_path);
  if ("error" in safe) return safe.error;

  try {
    await lstat(safe.path);
  } catch {
    return `Error: Path does not exist: ${directory_path}`;
  }
  if (!(await stat(safe.path)).isDirectory()) {
    return `Error: Path is not a directory: ${directory_path}`;
  }

  const root_name = basename(safe.path) || safe.path;
  const lines: string[] = [`${root_name}/`];
  let names: string[] = [];
  try {
    names = await readdir(safe.path);
  } catch {
    names = [];
  }
  if (names.some((name) => !IGNORED_DIR_NAMES.has(name))) lines.push("│");
  await walkTree(safe.path, "", lines);

  return lines.join("\n");
}
