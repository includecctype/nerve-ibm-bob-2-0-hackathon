// Limits enforced on this machine for the tools the CLI executes.
// Mirrors backend/systemconfig/limits.py for the values that moved here.
export const COMMAND_TIMEOUT_MS = 30_000;
export const OUTPUT_CHAR_CAP = 8_000;
export const MAX_READ_BYTES = 100_000;
export const DEFAULT_READ_LIMIT = 500;
export const GREP_MAX_MATCHES = 50;
export const GLOB_MAX_RESULTS = 100;

// Heavy directories grep/glob/listDir never walk into.
export const IGNORED_DIR_NAMES: ReadonlySet<string> = new Set([
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
