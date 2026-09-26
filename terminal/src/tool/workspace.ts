import { homedir } from "node:os";
import { isAbsolute, resolve, sep } from "node:path";

export type SafePathResult = { path: string } | { error: string };

// The workspace is wherever the user launched the CLI.
function getWorkspaceRoot(): string {
  return resolve(process.cwd());
}

// Resolve a path inside the workspace, or return the same Error: string the
// model used to see.
export function resolveSafePath(user_path: string): SafePathResult {
  if (!user_path?.trim()) {
    return { error: "Error: path must be a non-empty string" };
  }

  const root = getWorkspaceRoot();
  let candidate = user_path;
  if (candidate === "~") {
    candidate = homedir();
  } else if (candidate.startsWith("~/") || candidate.startsWith(`~${sep}`)) {
    candidate = `${homedir()}/${candidate.slice(2)}`;
  }

  try {
    const resolved = isAbsolute(candidate) ? resolve(candidate) : resolve(root, candidate);
    if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) {
      return { error: `Error: path outside workspace: ${user_path}` };
    }
    return { path: resolved };
  } catch (e) {
    return {
      error: `Error: cannot resolve path '${user_path}': ${String(e)}`,
    };
  }
}
