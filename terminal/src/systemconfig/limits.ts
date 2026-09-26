export const COMMAND_TIMEOUT_MS = 30000;
export const OUTPUT_CHAR_CAP = 8000;
export const MAX_READ_BYTES = 100000;
export const DEFAULT_READ_LIMIT = 500;
export const GREP_MAX_MATCHES = 50;
export const GLOB_MAX_RESULTS = 100;

export const IGNORED_DIRS = new Set([
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
