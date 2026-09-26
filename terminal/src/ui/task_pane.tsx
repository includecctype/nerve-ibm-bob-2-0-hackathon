import { Spinner } from "@inkjs/ui";
import { Box, Text } from "ink";
import type { TaskCategoryDTO } from "../dto/wire";
import { StatusFooter } from "./status_footer";
import { wrapLines } from "./text_window";
import { BG_PANEL } from "./theme";

export type TaskLine =
  | {
      type: "category";
      key: string;
      label: string;
      status: TaskCategoryDTO["status"];
      waitsOn: string;
    }
  | {
      type: "task_line";
      key: string;
      status: "pending" | "running" | "done" | "failed";
      text: string;
      showGutter: boolean;
    }
  | { type: "blank"; key: string };

export type TaskWindow = {
  visible: TaskLine[];
  startIndex: number;
  maxScroll: number;
};

export function buildTaskLines(tasks: TaskCategoryDTO[], task_text_width: number): TaskLine[] {
  if (tasks.length === 0) {
    return [];
  }

  const lines: TaskLine[] = [];
  tasks.forEach((category, category_index) => {
    lines.push({
      type: "category",
      key: `c-${category_index}`,
      label: category.name,
      status: category.status,
      waitsOn:
        category.status === "pending" && category.depends_on.length > 0
          ? category.depends_on.join(", ")
          : "",
    });
    category.tasks.forEach((task, task_index) => {
      const wrapped = wrapLines(task.description, task_text_width);
      wrapped.forEach((text, line_index) => {
        lines.push({
          type: "task_line",
          key: `t-${category_index}-${task_index}:${line_index}`,
          status: task.status,
          text,
          showGutter: line_index === 0,
        });
      });
    });
    lines.push({ type: "blank", key: `b-${category_index}` });
  });
  return lines;
}

type TaskPaneProps = {
  taskWindow: TaskWindow;
  taskScroll: number;
  taskGutterWidth: number;
  width: number;
  cwd: string;
  modelLabel: string;
};

export function TaskPane({
  taskWindow,
  taskScroll,
  taskGutterWidth,
  width,
  cwd,
  modelLabel,
}: TaskPaneProps) {
  return (
    <Box width={width} height="100%" flexDirection="column" display="flex" flexShrink={0}>
      <Box
        width="100%"
        flexGrow={1}
        flexShrink={1}
        minHeight={0}
        flexDirection="column"
        display="flex"
        backgroundColor={BG_PANEL}
        paddingX={1}
        paddingY={1}
        overflow="hidden"
      >
        <Text bold>Tasks</Text>
        {taskWindow.visible.length === 0 ? (
          <Text dimColor>No tasks yet</Text>
        ) : (
          taskWindow.visible.map((line) => {
            if (line.type === "blank") {
              return <Text key={line.key}> </Text>;
            }
            if (line.type === "category") {
              const marker =
                line.status === "done"
                  ? "✓ "
                  : line.status === "failed"
                    ? "✗ "
                    : line.status === "blocked"
                      ? "⊘ "
                      : "▶ ";
              const color =
                line.status === "done"
                  ? "green"
                  : line.status === "failed"
                    ? "red"
                    : line.status === "blocked"
                      ? "yellow"
                      : undefined;
              return (
                <Text key={line.key} bold color={color}>
                  {marker}
                  {line.label}
                  {line.status === "running" ? " …" : ""}
                  {line.waitsOn ? <Text dimColor>{` (waits: ${line.waitsOn})`}</Text> : null}
                </Text>
              );
            }
            if (line.status === "running") {
              return (
                <Box key={line.key} flexDirection="row">
                  <Box width={taskGutterWidth} flexShrink={0}>
                    {line.showGutter ? <Spinner /> : null}
                  </Box>
                  <Text color="green">{line.text}</Text>
                </Box>
              );
            }
            if (line.status === "done" || line.status === "failed") {
              const failed = line.status === "failed";
              return (
                <Box key={line.key} flexDirection="row">
                  <Box width={taskGutterWidth} flexShrink={0}>
                    <Text color={failed ? "red" : "green"}>
                      {line.showGutter ? (failed ? "✗" : "✓") : " "}
                    </Text>
                  </Box>
                  <Text dimColor={failed ? undefined : true} color={failed ? "red" : undefined}>
                    {line.text}
                  </Text>
                </Box>
              );
            }
            return (
              <Box key={line.key} flexDirection="row">
                <Box width={taskGutterWidth} flexShrink={0}>
                  <Text> </Text>
                </Box>
                <Text dimColor>{line.text}</Text>
              </Box>
            );
          })
        )}
        {taskWindow.maxScroll > 0 && (
          <Text dimColor>
            {taskScroll > 0 ? `↑ ${taskScroll} ` : ""}
            {taskScroll < taskWindow.maxScroll ? "↓" : ""}
          </Text>
        )}
      </Box>
      <StatusFooter width={width} cwd={cwd} modelLabel={modelLabel} />
    </Box>
  );
}
