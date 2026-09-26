from __future__ import annotations

import re
from typing import Any


def replaceOnce(text: str, old_string: str, new_string: str) -> str:
    """Replace old_string once; it must occur exactly once in the text."""
    count = text.count(old_string)
    if count == 0:
        raise ValueError("old_string not found in the file")
    if count > 1:
        raise ValueError(f"old_string appears {count} times; it must be unique")
    return text.replace(old_string, new_string, 1)


def globToRegex(pattern: str) -> re.Pattern[str]:
    """Translate a glob (supporting '*', '?' and '**/') into a regex."""
    parts: list[str] = ["^"]
    index = 0
    length = len(pattern)
    while index < length:
        char = pattern[index]
        if char == "*":
            if index + 1 < length and pattern[index + 1] == "*":
                index += 2
                if index < length and pattern[index] == "/":
                    parts.append("(?:.*/)?")
                    index += 1
                else:
                    parts.append(".*")
                continue
            parts.append("[^/]*")
        elif char == "?":
            parts.append("[^/]")
        else:
            parts.append(re.escape(char))
        index += 1
    parts.append("$")
    return re.compile("".join(parts))


def matchesGlob(pattern: str, path: str) -> bool:
    return globToRegex(pattern).match(path) is not None


def renderTree(root_name: str, tree: dict[str, Any]) -> str:
    """Render a nested folder tree (leaves are None) as an ASCII tree."""
    lines: list[str] = [f"{root_name}/"]

    def walk(node: dict[str, Any], prefix: str) -> None:
        names = sorted(node, key=lambda name: (node[name] is None, name.lower()))
        for position, name in enumerate(names):
            last = position == len(names) - 1
            child = node[name]
            connector = "└── " if last else "├── "
            lines.append(f"{prefix}{connector}{name}{'/' if child is not None else ''}")
            if child is not None:
                walk(child, prefix + ("    " if last else "│   "))

    walk(tree, "")
    return "\n".join(lines)
