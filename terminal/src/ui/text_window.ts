import wrapAnsi from "wrap-ansi";

/**
 * Wrap text to a given column width, preserving ANSI escape codes.
 */
export function wrapText(text: string, width: number): string {
  return wrapAnsi(text, width, { hard: true, trim: false });
}

/**
 * Truncate text to the last `max_lines` lines.
 */
export function truncateToLines(text: string, max_lines: number): string {
  const lines = text.split("\n");
  return lines.slice(Math.max(0, lines.length - max_lines)).join("\n");
}
