import { Box, Text } from "ink";
import React from "react";
import type { TaskCategoryDTO } from "../dto/wire.js";
import { theme } from "./theme.js";

interface TaskPaneProps {
  categories: TaskCategoryDTO[];
  scroll_offset: number;
  height: number;
}

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

export function TaskPane({ categories, scroll_offset, height }: TaskPaneProps) {
  const lines: React.ReactElement[] = [];

  for (const cat of categories) {
    const icon = categoryIcon(cat.status);
    const color = categoryColor(cat.status);
    const waits = cat.depends_on.length > 0 ? ` (waits: ${cat.depends_on.join(", ")})` : "";

    lines.push(
      <Text key={`cat-${cat.name}`} color={color}>
        {icon} {cat.name}
        {waits}
      </Text>,
    );

    for (const task of cat.tasks) {
      const task_color =
        task.status === "running"
          ? theme.running
          : task.status === "done"
            ? theme.success
            : task.status === "failed"
              ? theme.error
              : theme.muted;
      const spinner = task.status === "running" ? " ⠿" : "";
      lines.push(
        <Text key={`task-${cat.name}-${task.description}`} color={task_color}>
          {"  "}
          {task.description}
          {spinner}
        </Text>,
      );
    }
  }

  const start = Math.min(scroll_offset, Math.max(lines.length - height, 0));
  const visible = lines.slice(start, start + height);

  return (
    <Box flexDirection="column" height={height} overflow="hidden">
      {visible}
    </Box>
  );
}
