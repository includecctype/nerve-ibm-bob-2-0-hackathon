import { useEffect, useState } from "react";
import type { TaskCategoryDTO, TaskUpdatePayload } from "../terminal/dto/wire";
import { user_data } from "../terminal/session/user_data";
import { socket } from "../terminal/socket/client";

/**
 * Live task graph for the DOM shell. Seeds from the shared user_data singleton
 * (populated by the terminal app) and then follows the socket directly — the
 * Ink listener keeps its own handler, so both consumers coexist.
 */
export function useTaskUpdates(): TaskCategoryDTO[] {
  const [categories, setCategories] = useState<TaskCategoryDTO[]>(
    () => user_data?.categories ?? [],
  );

  useEffect(() => {
    setCategories(user_data?.categories ?? []);
    const on_update = (data: TaskUpdatePayload) => {
      setCategories(data.categories ?? []);
    };
    socket.on("task_update", on_update);
    return () => {
      socket.off("task_update", on_update);
    };
  }, []);

  return categories;
}
