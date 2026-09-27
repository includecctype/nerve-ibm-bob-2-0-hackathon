import type { TaskCategoryDTO } from "../terminal/dto/wire";

export type TaskStatus = TaskCategoryDTO["status"];

/** Terminal-theme palette used for both node fills and edge/arrow colours. */
export const STATUS_COLORS: Record<TaskStatus, string> = {
  running: "#00ff41",
  done: "#00b3ff",
  failed: "#ff3b3b",
  blocked: "#ffcc00",
  pending: "#3f8f4f",
};

/** Legend order — most active first. */
export const STATUS_ORDER: TaskStatus[] = ["running", "pending", "blocked", "done", "failed"];
