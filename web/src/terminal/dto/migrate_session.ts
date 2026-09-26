import type {
  DisplayHistoryDTO,
  SessionData,
  TaskCategoryDTO,
  TaskItemDTO,
  TaskItemStatus,
} from "./wire.js";

const TASK_STATUSES: TaskItemStatus[] = ["pending", "running", "done", "failed"];
const CATEGORY_STATUSES = ["pending", "running", "done", "failed", "blocked"] as const;

export type LegacySessionData = {
  categories?: TaskCategoryDTO[];
  history?: DisplayHistoryDTO[];
  last_updated?: number;
  pending_task?: { simultaneous?: boolean; description?: string }[];
  running_task?: { model_id?: number; description?: string }[];
};

function coerceTaskStatus(status: unknown): TaskItemStatus {
  return TASK_STATUSES.includes(status as TaskItemStatus) ? (status as TaskItemStatus) : "pending";
}

function coerceCategoryStatus(status: unknown): TaskCategoryDTO["status"] {
  return (CATEGORY_STATUSES as readonly string[]).includes(status as string)
    ? (status as TaskCategoryDTO["status"])
    : "pending";
}

function normalizeCategory(category: TaskCategoryDTO): TaskCategoryDTO {
  const tasks: TaskItemDTO[] = (category.tasks ?? []).map((task) => ({
    description: String(task?.description ?? ""),
    status: coerceTaskStatus(task?.status),
    result: String(task?.result ?? ""),
  }));
  return {
    name: String(category.name ?? ""),
    status: coerceCategoryStatus(category.status),
    depends_on: Array.isArray(category.depends_on) ? category.depends_on.map(String) : [],
    tasks,
  };
}

/**
 * Normalize a stored session's task graph into the current category shape.
 *
 * New sessions already store `categories`. Legacy sessions stored flat
 * `pending_task` / `running_task` lists; those are collapsed into a single
 * "tasks" category (running first) so nothing is lost on load.
 */
export function migrateSessionCategories(
  data: LegacySessionData | SessionData | null | undefined,
): TaskCategoryDTO[] {
  if (!data) return [];
  const raw = data as LegacySessionData;

  if (Array.isArray(raw.categories)) {
    return raw.categories.map((category) => normalizeCategory(category));
  }

  const descriptions: string[] = [];
  for (const item of [...(raw.running_task ?? []), ...(raw.pending_task ?? [])]) {
    const description = (item?.description ?? "").trim();
    if (description) descriptions.push(description);
  }
  if (descriptions.length === 0) return [];

  return [
    {
      name: "tasks",
      status: "pending",
      depends_on: [],
      tasks: descriptions.map((description) => ({
        description,
        status: "pending" as TaskItemStatus,
        result: "",
      })),
    },
  ];
}
