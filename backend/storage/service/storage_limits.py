from __future__ import annotations

MAX_READ_BYTES = 100_000
DEFAULT_READ_LIMIT = 500

LIST_PAGE_LIMIT = 500
LIST_MAX_PAGES = 20

GREP_MAX_MATCHES = 50
GLOB_MAX_RESULTS = 100

MAX_TREE_DEPTH = 4
MAX_TREE_ENTRIES = 200

TRUNCATE_RESULT_LIMIT = 600

IGNORED_DIRS = frozenset(
    {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build", ".next"}
)
