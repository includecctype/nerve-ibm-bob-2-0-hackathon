import { Box, Text } from "ink";
import React from "react";
import type { DisplayHistoryDTO } from "../dto/wire.js";
import { theme } from "./theme.js";

interface ChatViewportProps {
  displays: DisplayHistoryDTO[];
  /** Lines scrolled up from the newest message; 0 keeps the view pinned to the bottom. */
  scroll_offset: number;
  height: number;
  width: number;
}

export function ChatViewport({ displays, scroll_offset, height }: ChatViewportProps) {
  const line_keys = React.useRef(new WeakMap<DisplayHistoryDTO, string>());
  const next_key = React.useRef(0);
  const lines: React.ReactElement[] = [];

  for (const entry of displays) {
    let key = line_keys.current.get(entry);
    if (key === undefined) {
      key = `message-${next_key.current}`;
      next_key.current += 1;
      line_keys.current.set(entry, key);
    }
    const color = entry.role === "user" ? theme.primary : "white";
    const prefix = entry.role === "user" ? "> " : "  ";
    lines.push(
      <Text key={key} color={color} wrap="wrap">
        {prefix}
        {entry.content}
      </Text>,
    );
  }

  const end = Math.max(0, displays.length - scroll_offset);
  const start = Math.max(0, end - height);
  const visible = lines.slice(start, end);

  return (
    <Box flexDirection="column" height={height} overflow="hidden">
      {visible.length > 0 ? visible : <Text color={theme.muted}>No messages yet.</Text>}
    </Box>
  );
}
