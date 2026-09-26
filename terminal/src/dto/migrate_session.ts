import type { SessionData, TaskCategoryDTO, TaskItemDTO } from "./wire.js";

/**
 * Migrate legacy flat task lists into a single 'tasks' category.
 * Legacy shapes: [{simultaneous, description}] or [[bool, str]]
 */
export function migrateSessionCategories(data: SessionData): SessionData {
  const cats = data.categories;
  if (!cats || cats.length === 0) return data;

  // Already new format — check if any look like legacy flat items
  const firstCat = cats[0];
  if (firstCat && "name" in firstCat && "tasks" in firstCat) {
    return data;
  }

  // Legacy: flat array of task descriptions or objects
  const tasks: TaskItemDTO[] = (cats as unknown[]).map((entry) => {
    let desc = "";
    if (typeof entry === "string") {
      desc = entry;
    } else if (Array.isArray(entry) && entry.length >= 2) {
      desc = String(entry[1]);
    } else if (typeof entry === "object" && entry !== null && "description" in entry) {
      desc = String((entry as Record<string, unknown>).description);
    }
    return { description: desc, status: "pending" as const, result: "" };
  });

  const migrated: TaskCategoryDTO = {
    name: "tasks",
    status: "pending",
    depends_on: [],
    tasks,
  };

  return { ...data, categories: [migrated] };
}
