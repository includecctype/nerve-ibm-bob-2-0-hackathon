import type { SessionData, TaskCategoryDTO, TaskItemStatus } from "./wire";

type LegacySessionData = {
  categories?: TaskCategoryDTO[];
  pending_task?: { simultaneous?: boolean; description?: string }[];
  running_task?: { model_id?: number; description?: string }[];
};

// Legacy sessions stored flat task lists; collapse them into one category
// so nothing is lost on load.
export function migrateSessionCategories(
  data: LegacySessionData | SessionData | null | undefined,
): TaskCategoryDTO[] {
  if (!data) return [];
  const raw = data as LegacySessionData;
  if (Array.isArray(raw.categories)) return raw.categories;

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
