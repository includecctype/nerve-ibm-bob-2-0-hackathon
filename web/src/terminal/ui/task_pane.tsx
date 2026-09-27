import { Spinner } from "@inkjs/ui";
import { Box, Text } from "ink";
import { useEffect } from "react";
import type { TaskCategoryDTO, TaskItemStatus } from "../dto/wire";
import { useTaskAnimations } from "../hooks/use_task_animations";
import { StatusFooter } from "./status_footer";
import type { TaskGraphRow } from "./task_graph";
import { buildTaskGraphRows, statusMarker } from "./task_graph";
import { windowFromTop } from "./text_window";
import { BG_PANEL } from "./theme";

const ACCENT = "#00ff41";
const ERROR = "#ff3b3b";
const WARN = "#ffcc00";

function categoryColor(status: TaskCategoryDTO["status"]): string | undefined {
  switch (status) {
    case "done":
      return ACCENT;
    case "failed":
      return ERROR;
    case "blocked":
      return WARN;
    default:
      return undefined;
  }
}

function taskGutterIcon(status: TaskItemStatus): string {
  if (status === "done") {
    return "✓ ";
  }
  if (status === "failed") {
    return "✗ ";
  }
  return "  ";
}

function taskTextColor(status: TaskItemStatus): string | undefined {
  if (status === "failed") {
    return ERROR;
  }
  if (status === "done") {
    return ACCENT;
  }
  return undefined;
}

type AnimStyle = {
  bold?: boolean;
  dimColor?: boolean;
  strikethrough?: boolean;
};

function animStyleFor(
  phase: "in" | "pulse" | "out" | null,
  frame: number,
  ghost: boolean,
): AnimStyle {
  if (phase === "out" || ghost) {
    return { dimColor: true, strikethrough: true };
  }
  const even = frame % 2 === 0;
  if (phase === "in") {
    return even ? { bold: true } : {};
  }
  if (phase === "pulse") {
    return even ? { bold: true } : { dimColor: true };
  }
  return {};
}

type TaskPaneProps = {
  tasks: TaskCategoryDTO[];
  taskScroll: number;
  taskHScroll: number;
  viewportRows: number;
  textWidth: number;
  taskGutterWidth: number;
  width: number;
  cwd: string;
  modelLabel: string;
  onScrollClamp?: (maxScroll: number) => void;
};

export function TaskPane({
  tasks,
  taskScroll,
  taskHScroll,
  viewportRows,
  textWidth,
  taskGutterWidth,
  width,
  cwd,
  modelLabel,
  onScrollClamp,
}: TaskPaneProps) {
  const anim = useTaskAnimations(tasks);
  const graph = buildTaskGraphRows(anim.displayCategories, textWidth, anim.ghostNames);
  const taskWindow = windowFromTop(graph.rows, viewportRows, taskScroll);

  useEffect(() => {
    if (taskScroll > taskWindow.maxScroll) {
      onScrollClamp?.(taskWindow.maxScroll);
    }
  }, [taskScroll, taskWindow.maxScroll, onScrollClamp]);

  const renderRow = (row: TaskGraphRow) => {
    if (row.type === "blank") {
      return <Text key={row.key}> </Text>;
    }

    const style = animStyleFor(anim.phaseOf(row.animKey), anim.frame, row.ghost);

    if (row.type === "category") {
      const slicedPrefix = row.prefix.slice(taskHScroll);
      const marker = `${statusMarker(row.status)} `;
      const progress = row.totalCount > 0 ? ` (${row.doneCount}/${row.totalCount})` : "";
      const running = row.status === "running" ? " …" : "";
      const waits = row.waitsOn ? ` (waits: ${row.waitsOn})` : "";
      const content = `${marker}${row.label}${progress}${running}`;
      return (
        <Text
          key={row.key}
          bold={style.bold}
          dimColor={style.dimColor}
          strikethrough={style.strikethrough}
          color={categoryColor(row.status)}
        >
          {slicedPrefix}
          {content}
          {waits ? <Text dimColor>{waits}</Text> : null}
        </Text>
      );
    }

    const slicedPrefix = row.prefix.slice(taskHScroll);
    const dimDefault = row.status === "pending" || row.status === "done";
    const dim = style.dimColor ?? dimDefault;

    if (row.status === "running" && taskHScroll === 0) {
      return (
        <Box key={row.key} flexDirection="row">
          <Text dimColor={style.dimColor} strikethrough={style.strikethrough}>
            {slicedPrefix}
          </Text>
          <Box width={taskGutterWidth} flexShrink={0}>
            {row.showGutter ? <Spinner /> : null}
          </Box>
          <Text bold={style.bold} dimColor={style.dimColor} color={ACCENT}>
            {row.text}
          </Text>
        </Box>
      );
    }

    const icon = row.showGutter
      ? row.status === "running"
        ? "▶ "
        : taskGutterIcon(row.status)
      : "  ";
    return (
      <Text
        key={row.key}
        bold={style.bold}
        dimColor={dim}
        strikethrough={style.strikethrough}
        color={taskTextColor(row.status)}
      >
        {slicedPrefix}
        {icon}
        {row.text}
      </Text>
    );
  };

  const showHints = taskWindow.maxScroll > 0 || graph.maxHScroll > 0;
  const hintUp = taskScroll > 0 ? `↑${taskScroll}` : "";
  const hintDown = taskScroll < taskWindow.maxScroll ? "↓" : "";
  const hintSide = graph.maxHScroll > 0 ? (taskHScroll > 0 ? `↔${taskHScroll}` : "↔") : "";

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
          taskWindow.visible.map((row) => renderRow(row))
        )}
        {showHints && (
          <Text dimColor>{[hintUp, hintDown, hintSide].filter(Boolean).join(" ")}</Text>
        )}
      </Box>
      <StatusFooter width={width} cwd={cwd} modelLabel={modelLabel} />
    </Box>
  );
}
