import { Box, Text } from "ink";
import React from "react";
import type { DisplayHistoryDTO } from "../dto/wire.js";
import { chatRows, windowFromBottom } from "./text_window.js";
import { theme } from "./theme.js";

interface ChatViewportProps {
  displays: DisplayHistoryDTO[];
  /** Rows scrolled up from the newest message; 0 keeps the view pinned to the bottom. */
  scroll_offset: number;
  height: number;
  width: number;
}

export function ChatViewport({ displays, scroll_offset, height, width }: ChatViewportProps) {
  const rows = chatRows(displays, width);
  const { visible, startIndex } = windowFromBottom(rows, height, scroll_offset);

  return (
    <Box flexDirection="column" height={height} overflow="hidden">
      {visible.length > 0 ? (
        visible.map((row, index) => {
          const color = row.role === "user" ? theme.primary : "white";
          return (
            <Text key={`row-${startIndex + index}`} color={color}>
              {row.is_pad ? " " : row.text}
            </Text>
          );
        })
      ) : (
        <Text color={theme.muted}>No messages yet.</Text>
      )}
    </Box>
  );
}
