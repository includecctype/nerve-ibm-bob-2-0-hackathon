import wrapAnsi from "wrap-ansi";

type DisplayEntryBlock = {
  entryIndex: number;
  role: string;
  content: string;
  lines: string[];
};

type DisplayRow =
  | {
      kind: "pad";
      entryIndex: number;
      role: string;
      content: string;
    }
  | {
      kind: "text";
      entryIndex: number;
      role: string;
      content: string;
      lineIndex: number;
      text: string;
    };

export type GroupedDisplayBlock = {
  entryIndex: number;
  role: string;
  content: string;
  paddingTop: number;
  paddingBottom: number;
  lines: { lineIndex: number; text: string }[];
};

const DISPLAY_ENTRY_PAD = 1;

export function wrapLines(text: string, width: number): string[] {
  if (width < 1) {
    return [text];
  }
  return wrapAnsi(text, width, { hard: true, trim: false }).split("\n");
}

export function flattenDisplayEntries(
  entries: { role: string; content: string }[],
  width: number,
): DisplayEntryBlock[] {
  return entries.map((entry, entryIndex) => {
    const prefix =
      entry.role === "user"
        ? "You: "
        : entry.role === "system" || entry.role === "error"
          ? ""
          : "Agent: ";
    const wrapped = wrapLines(`${prefix}${entry.content}`, width);
    return {
      entryIndex,
      role: entry.role,
      content: entry.content,
      lines: wrapped,
    };
  });
}

export function displayRowsFromEntries(blocks: DisplayEntryBlock[]): DisplayRow[] {
  const rows: DisplayRow[] = [];
  for (const block of blocks) {
    for (let pad = 0; pad < DISPLAY_ENTRY_PAD; pad++) {
      rows.push({
        kind: "pad",
        entryIndex: block.entryIndex,
        role: block.role,
        content: block.content,
      });
    }
    block.lines.forEach((text, lineIndex) => {
      rows.push({
        kind: "text",
        entryIndex: block.entryIndex,
        role: block.role,
        content: block.content,
        lineIndex,
        text,
      });
    });
    for (let pad = 0; pad < DISPLAY_ENTRY_PAD; pad++) {
      rows.push({
        kind: "pad",
        entryIndex: block.entryIndex,
        role: block.role,
        content: block.content,
      });
    }
  }
  return rows;
}

export function groupRowsIntoBlocks(rows: DisplayRow[]): GroupedDisplayBlock[] {
  const groups: GroupedDisplayBlock[] = [];
  let current: GroupedDisplayBlock | null = null;

  const flush = () => {
    if (current) {
      groups.push(current);
      current = null;
    }
  };

  for (const row of rows) {
    if (!current || current.entryIndex !== row.entryIndex) {
      flush();
      current = {
        entryIndex: row.entryIndex,
        role: row.role,
        content: row.content,
        paddingTop: 0,
        paddingBottom: 0,
        lines: [],
      };
    }
    if (row.kind === "pad") {
      if (current.lines.length === 0) {
        current.paddingTop += 1;
      } else {
        current.paddingBottom += 1;
      }
    } else {
      current.lines.push({ lineIndex: row.lineIndex, text: row.text });
      current.paddingBottom = 0;
    }
  }
  flush();
  return groups;
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
