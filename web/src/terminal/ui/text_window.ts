import wrapAnsi from "wrap-ansi";

/**
 * Wrap text to a given column width, preserving ANSI escape codes.
 */
export function wrapText(text: string, width: number): string {
  return wrapAnsi(text, width, { hard: true, trim: false });
}

/**
 * Wrap text to a given column width and return the individual display lines.
 */
export function wrapLines(text: string, width: number): string[] {
  if (width < 1) {
    return [text];
  }
  return wrapAnsi(text, width, { hard: true, trim: false }).split("\n");
}

/**
 * Truncate text to the last `max_lines` lines.
 */
export function truncateToLines(text: string, max_lines: number): string {
  const lines = text.split("\n");
  return lines.slice(Math.max(0, lines.length - max_lines)).join("\n");
}

export type ChatRow = { role: string; text: string; is_pad: boolean };

/**
 * Expand the display history into wrapped terminal rows (one blank row between
 * messages) so the viewport can scroll in visual rows rather than messages.
 */
export function chatRows(entries: { role: string; content: string }[], width: number): ChatRow[] {
  const rows: ChatRow[] = [];
  const safe_width = Math.max(1, width);
  entries.forEach((entry, index) => {
    const prefix = entry.role === "user" ? "> " : "  ";
    for (const line of wrapLines(`${prefix}${entry.content}`, safe_width)) {
      rows.push({ role: entry.role, text: line, is_pad: false });
    }
    if (index < entries.length - 1) {
      rows.push({ role: entry.role, text: "", is_pad: true });
    }
  });
  return rows;
}

export function windowFromBottom<T>(
  lines: T[],
  viewport_rows: number,
  scroll_from_bottom: number,
): { visible: T[]; startIndex: number; maxScroll: number } {
  const maxScroll = Math.max(0, lines.length - viewport_rows);
  const scroll = Math.min(Math.max(0, scroll_from_bottom), maxScroll);
  const startIndex = Math.max(0, lines.length - scroll - viewport_rows);
  const end_index = Math.min(lines.length, startIndex + viewport_rows);
  return { visible: lines.slice(startIndex, end_index), startIndex, maxScroll };
}

export function windowFromTop<T>(
  lines: T[],
  viewport_rows: number,
  scroll_top: number,
): { visible: T[]; startIndex: number; maxScroll: number } {
  const maxScroll = Math.max(0, lines.length - viewport_rows);
  const scroll = Math.min(Math.max(0, scroll_top), maxScroll);
  const start = Math.max(0, scroll);
  const end = Math.min(lines.length, start + viewport_rows);
  return { visible: lines.slice(start, end), startIndex: start, maxScroll };
}
