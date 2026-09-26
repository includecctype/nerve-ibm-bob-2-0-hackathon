import fs from "node:fs";
import type { DisplayHistoryDTO, TaskCategoryDTO } from "../dto/wire.js";
import { getUserData } from "../session/user_data.js";
import { configFilePath } from "./config_path.js";
import { readConfig } from "./config_reader.js";

let write_queue: Promise<void> = Promise.resolve();
let debounce_timer: ReturnType<typeof setTimeout> | null = null;
const pending_writes: Array<() => void> = [];

function scheduleWrite(): void {
  if (debounce_timer !== null) {
    clearTimeout(debounce_timer);
  }
  debounce_timer = setTimeout(() => {
    debounce_timer = null;
    const resolvers = pending_writes.splice(0);
    write_queue = write_queue.then(() => {
      flushNow();
      for (const resolve of resolvers) resolve();
    });
  }, 50);
}

function flushNow(): void {
  const data = getUserData();
  const config = readConfig();

  // API keys and the selected model are persisted on every flush; sessions are
  // only written once the first prompt has committed them.
  config.api_key = data.api_keys;
  config.main_agent_id = data.main_agent_id;

  if (data.committed) {
    config.session = config.session ?? {};
    config.session[data.session_id] = {
      categories: data.categories,
      history: data.history,
      last_updated: Date.now(),
    };
  }

  try {
    fs.writeFileSync(configFilePath(), JSON.stringify(config, null, 2), "utf8");
  } catch {
    // non-fatal — best effort
  }
}

export function writeUserDataToFile(): void {
  scheduleWrite();
}

export function waitForWrites(): Promise<void> {
  if (debounce_timer !== null) {
    clearTimeout(debounce_timer);
    debounce_timer = null;
    flushNow();
  }
  return write_queue;
}

export function saveTaskUpdate(categories: TaskCategoryDTO[]): void {
  const data = getUserData();
  data.categories = categories;
  writeUserDataToFile();
}

export function saveDisplayHistory(entry: DisplayHistoryDTO): void {
  const data = getUserData();
  data.history.push(entry);
  writeUserDataToFile();
}
