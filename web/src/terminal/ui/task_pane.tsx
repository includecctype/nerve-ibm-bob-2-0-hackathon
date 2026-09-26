import { Box, Text } from "ink";
import React from "react";
import type { TaskCategoryDTO } from "../dto/wire.js";
import { wrapLines, windowFromTop } from "./text_window.js";
import { theme } from "./theme.js";

interface TaskPaneProps {
  categories: TaskCategoryDTO[];
  scroll_offset: number;
  height: number;
  width: number;
}

type TaskRow = {
  text: string;
  color: string;
};

function categoryIcon(status: TaskCategoryDTO["status"]): string {
  switch (status) {
    case "done":
      return "✓";
    case "failed":
      return "✗";
    case "blocked":
      return "⊘";
    case "running":
      return "▶";
    default:
      return "○";
  }
}

function categoryColor(status: TaskCategoryDTO["status"]): string {
  switch (status) {
    case "done":
      return theme.success;
    case "failed":
      return theme.error;
    case "blocked":
      return theme.blocked;
    case "running":
      return theme.running;
    default:
      return theme.muted;
  }
}

function taskColor(status: string): string {
  switch (status) {
    case "running":
      return theme.running;
    case "done":
      return theme.success;
    case "failed":
      return theme.error;
    default:
      return theme.muted;
  }
}

export function TaskPane({ categories, scroll_offset, height, width }: TaskPaneProps) {
  const rows: TaskRow[] = [];
  const safe_width = Math.max(1, width);

  for (const cat of categories) {
    const icon = categoryIcon(cat.status);
    const color = categoryColor(cat.status);
    const waits = cat.depends_on.length > 0 ? ` (waits: ${cat.depends_on.join(", ")})` : "";
    for (const line of wrapLines(`${icon} ${cat.name}${waits}`, safe_width)) {
      rows.push({ text: line, color });
    }

    for (const task of cat.tasks) {
      const spinner = task.status === "running" ? " ⠿" : "";
      for (const line of wrapLines(`  ${task.description}${spinner}`, safe_width)) {
        rows.push({ text: line, color: taskColor(task.status) });
      }
    }
  }

  const { visible, startIndex } = windowFromTop(rows, height, scroll_offset);

  return (
    <Box flexDirection="column" height={height} overflow="hidden">
      {visible.map((row, index) => (
        <Text key={`task-row-${startIndex + index}`} color={row.color}>
          {row.text}
        </Text>
      ))}
    </Box>
  );
}
