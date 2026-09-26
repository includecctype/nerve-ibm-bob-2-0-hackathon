import os from "node:os";
import path from "node:path";

const WORKSPACE = path.resolve(process.cwd());

export function resolveSafePath(raw_path: string): string | null {
  let expanded = raw_path;
  if (expanded.startsWith("~")) {
    expanded = os.homedir() + expanded.slice(1);
  }
  const resolved = path.resolve(WORKSPACE, expanded);
  if (resolved !== WORKSPACE && !resolved.startsWith(WORKSPACE + path.sep)) {
    return null;
  }
  return resolved;
}
