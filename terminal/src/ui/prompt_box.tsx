import { Box, type Key, Text, useInput } from "ink";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isPasteActive, notePasteMarker } from "../hooks/use_bracketed_paste.js";
import { wrapLines } from "./text_window.js";

const MAX_PROMPT_CONTENT_ROWS = 5;

// Enter submits only after this delay; input arriving meanwhile means the CR
// was a paste boundary, not a deliberate submit.
const PASTE_SUBMIT_DELAY_MS = 20;

const ESC = String.fromCharCode(27);
const CSI_SEQUENCE_PATTERN = new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-~]`, "g");
const FE_SEQUENCE_PATTERN = new RegExp(`${ESC}[@-Z\\\\^_]`, "g");
const ESC_SEQUENCE_PATTERN = new RegExp(`${ESC}.`, "g");

function sanitizeInputText(text: string): string {
  return text
    .replace(CSI_SEQUENCE_PATTERN, "")
    .replace(FE_SEQUENCE_PATTERN, "")
    .replace(ESC_SEQUENCE_PATTERN, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

export function promptContentRows(
  value: string,
  width: number,
  max_rows: number = MAX_PROMPT_CONTENT_ROWS,
): number {
  const n = value ? wrapLines(value, Math.max(1, width)).length : 1;
  return Math.min(max_rows, Math.max(1, n));
}

export function promptHiddenLineCount(
  value: string,
  width: number,
  max_rows: number = MAX_PROMPT_CONTENT_ROWS,
): number {
  if (!value) return 0;
  return Math.max(0, wrapLines(value, Math.max(1, width)).length - max_rows);
}

type PromptBoxProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  width: number;
  maxContentRows?: number;
  bordered?: boolean;
  border_color?: string;
};

type CursorMetrics = {
  lines: string[];
  cursor_line: number;
  cursor_col: number;
  scroll: number;
  max_scroll: number;
  scrollable: boolean;
};

function measureCursor(
  value: string,
  cursor_offset: number,
  width: number,
  content_rows: number,
): CursorMetrics {
  const safe_width = Math.max(1, width);
  const lines = value ? wrapLines(value, safe_width) : [""];
  const prefix = value.slice(0, cursor_offset);
  const prefix_lines = prefix ? wrapLines(prefix, safe_width) : [""];
  const raw_cursor_line = Math.max(0, prefix_lines.length - 1);
  const cursor_line = Math.min(raw_cursor_line, Math.max(0, lines.length - 1));
  const display_line = lines[cursor_line] ?? "";
  const last_prefix = prefix_lines[prefix_lines.length - 1] ?? "";
  let cursor_col: number;
  if (cursor_offset >= value.length) {
    cursor_col = display_line.length;
  } else if (display_line.startsWith(last_prefix)) {
    cursor_col = last_prefix.length;
  } else {
    cursor_col = Math.min(last_prefix.length, display_line.length);
  }
  const max_scroll = Math.max(0, lines.length - content_rows);
  const scroll = Math.min(cursor_line, max_scroll);
  return {
    lines,
    cursor_line,
    cursor_col,
    scroll,
    max_scroll,
    scrollable: lines.length > content_rows,
  };
}

function prefixLineCount(value: string, offset: number, width: number): number {
  const prefix = value.slice(0, offset);
  return prefix ? wrapLines(prefix, width).length : 1;
}

function firstOffsetBeyondLine(value: string, line_index: number, width: number): number {
  let lo = 0;
  let hi = value.length + 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (prefixLineCount(value, mid, width) > line_index) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return lo;
}

function findOffsetForVisualLine(
  value: string,
  target_line: number,
  desired_col: number,
  width: number,
): number {
  const safe_width = Math.max(1, width);
  if (!value) return 0;
  const lines = wrapLines(value, safe_width);
  if (target_line >= lines.length) return value.length;

  const start = firstOffsetBeyondLine(value, target_line, safe_width);
  const end = firstOffsetBeyondLine(value, target_line + 1, safe_width);
  if (start >= end || start > value.length) return value.length;

  const display_line = lines[target_line] ?? "";
  let best_offset = start;
  let best_score = Number.POSITIVE_INFINITY;
  for (let offset = start; offset < end && offset <= value.length; offset++) {
    const prefix = value.slice(0, offset);
    const prefix_lines = prefix ? wrapLines(prefix, safe_width) : [""];
    const last_prefix = prefix_lines[prefix_lines.length - 1] ?? "";
    let col: number;
    if (offset >= value.length) {
      col = display_line.length;
    } else if (display_line.startsWith(last_prefix)) {
      col = last_prefix.length;
    } else {
      col = Math.min(last_prefix.length, display_line.length);
    }
    const score = Math.abs(col - desired_col);
    if (score < best_score) {
      best_score = score;
      best_offset = offset;
    }
  }
  return best_offset;
}

function moveCursorVertical(
  value: string,
  cursor_offset: number,
  width: number,
  direction: -1 | 1,
  metrics: CursorMetrics,
): number {
  const target_line = metrics.cursor_line + direction;
  if (target_line < 0 || target_line >= metrics.lines.length) {
    return cursor_offset;
  }
  return findOffsetForVisualLine(value, target_line, metrics.cursor_col, width);
}

export function PromptBox({
  value,
  onChange,
  onSubmit,
  placeholder = "",
  width,
  maxContentRows = MAX_PROMPT_CONTENT_ROWS,
  bordered = true,
  border_color = "cyan",
}: PromptBoxProps) {
  const [cursor_offset, setCursorOffset] = useState(() => value.length);

  // Refs mirror the latest draft/cursor so rapid input bursts (pastes split
  // across stdin reads) merge instead of overwriting each other from a stale
  // render closure.
  const draft_ref = useRef(value);
  const cursor_ref = useRef(cursor_offset);
  const submit_timer_ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const on_change_ref = useRef(onChange);
  const on_submit_ref = useRef(onSubmit);
  const handle_key_ref = useRef<(input: string, key: Key) => void>(() => {});

  draft_ref.current = value;
  cursor_ref.current = Math.min(cursor_offset, value.length);
  on_change_ref.current = onChange;
  on_submit_ref.current = onSubmit;

  useEffect(() => {
    if (cursor_offset > value.length) {
      setCursorOffset(value.length);
    }
  }, [value, cursor_offset]);

  useEffect(
    () => () => {
      if (submit_timer_ref.current !== null) {
        clearTimeout(submit_timer_ref.current);
        submit_timer_ref.current = null;
      }
    },
    [],
  );

  const content_rows = useMemo(
    () => promptContentRows(value, width, maxContentRows),
    [maxContentRows, value, width],
  );

  const metrics = useMemo(
    () => measureCursor(value, cursor_offset, width, content_rows),
    [value, cursor_offset, width, content_rows],
  );

  const multi_row_draft = metrics.lines.length > 1;

  const writeDraft = (next: string, next_cursor: number) => {
    const clamped = Math.max(0, Math.min(next.length, next_cursor));
    draft_ref.current = next;
    cursor_ref.current = clamped;
    on_change_ref.current(next);
    setCursorOffset(clamped);
  };

  const insertText = (text: string) => {
    const clean = sanitizeInputText(text);
    if (!clean) return;
    const current = draft_ref.current;
    const at = cursor_ref.current;
    const next = current.slice(0, at) + clean + current.slice(at);
    writeDraft(next, at + clean.length);
  };

  const deleteBackward = () => {
    const current = draft_ref.current;
    const at = cursor_ref.current;
    if (at <= 0) return;
    const next = current.slice(0, at - 1) + current.slice(at);
    writeDraft(next, at - 1);
  };

  const moveCursor = (next: number) => {
    const clamped = Math.max(0, Math.min(draft_ref.current.length, next));
    cursor_ref.current = clamped;
    setCursorOffset(clamped);
  };

  const clearSubmitTimer = (): boolean => {
    if (submit_timer_ref.current === null) return false;
    clearTimeout(submit_timer_ref.current);
    submit_timer_ref.current = null;
    return true;
  };

  const handleKey = (input: string, key: Key) => {
    if (notePasteMarker(input)) {
      return;
    }
    if (key.tab || (key.shift && key.tab) || (key.ctrl && input === "c")) {
      return;
    }
    // Input arriving right after Enter means the CR was part of a paste
    // burst — convert it to a newline instead of submitting a fragment.
    if (clearSubmitTimer()) {
      insertText("\n");
    }
    if (key.upArrow) {
      if (multi_row_draft) {
        moveCursor(moveCursorVertical(draft_ref.current, cursor_ref.current, width, -1, metrics));
      }
      return;
    }
    if (key.downArrow) {
      if (multi_row_draft) {
        moveCursor(moveCursorVertical(draft_ref.current, cursor_ref.current, width, 1, metrics));
      }
      return;
    }
    if (key.return) {
      if (key.shift || key.meta || isPasteActive()) {
        insertText("\n");
        return;
      }
      submit_timer_ref.current = setTimeout(() => {
        submit_timer_ref.current = null;
        on_submit_ref.current(draft_ref.current);
      }, PASTE_SUBMIT_DELAY_MS);
      return;
    }
    if (key.leftArrow) {
      moveCursor(cursor_ref.current - 1);
      return;
    }
    if (key.rightArrow) {
      moveCursor(cursor_ref.current + 1);
      return;
    }
    if (key.backspace || key.delete) {
      deleteBackward();
      return;
    }
    insertText(input);
  };

  handle_key_ref.current = handleKey;
  const stableInputHandler = useCallback(
    (input: string, key: Key) => handle_key_ref.current(input, key),
    [],
  );
  useInput(stableInputHandler);

  const height = content_rows + 2;
  const placeholder_line = wrapLines(placeholder, Math.max(1, width))[0] ?? "";
  const visible_lines = metrics.lines.slice(metrics.scroll, metrics.scroll + content_rows);

  const body = value ? (
    visible_lines.map((line, index) => {
      const absolute_line = metrics.scroll + index;
      if (absolute_line === metrics.cursor_line) {
        const col = Math.max(0, Math.min(metrics.cursor_col, line.length));
        const before = line.slice(0, col);
        const at = line.slice(col, col + 1);
        const after = line.slice(col + 1);
        return (
          <Text key={`line-${absolute_line}`}>
            {before}
            <Text inverse>{at === "" ? " " : at}</Text>
            {after}
          </Text>
        );
      }
      return <Text key={`line-${absolute_line}`}>{line}</Text>;
    })
  ) : (
    <Text>
      <Text inverse>{placeholder_line.charAt(0) || " "}</Text>
      <Text dimColor>{placeholder_line.slice(1)}</Text>
    </Text>
  );

  const indicator =
    metrics.max_scroll > 0 ? (
      <Text dimColor>
        {metrics.scroll > 0 ? `↑ ${metrics.scroll} ` : ""}
        {metrics.scroll < metrics.max_scroll ? `↓ ${metrics.max_scroll - metrics.scroll}` : ""}
      </Text>
    ) : null;

  const outer_width = Math.max(3, width + 2);

  if (!bordered) {
    return (
      <Box width={outer_width} flexDirection="column" display="flex" paddingX={1}>
        {body}
        {indicator}
      </Box>
    );
  }

  return (
    <Box
      width={outer_width}
      height={height}
      display="flex"
      flexDirection="column"
      flexShrink={0}
      borderStyle="round"
      borderColor={border_color}
    >
      {body}
      {indicator}
    </Box>
  );
}
