import { type LegacySessionData, migrateSessionCategories } from "../dto/migrate_session.js";
import type { DisplayHistoryDTO, SessionData, TaskCategoryDTO } from "../dto/wire.js";
import { getUserData } from "../session/user_data.js";
import { MODEL_OPTIONS } from "../systemconfig/model.js";

export interface StoredConfig {
  api_key: Record<string, string>;
  main_agent_id: number;
  session: Record<string, SessionData>;
}

const STORAGE_KEY = "nerve.config";

function defaultConfig(): StoredConfig {
  return { api_key: {}, main_agent_id: 1, session: {} };
}

function readRaw(): StoredConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig();
    const parsed = JSON.parse(raw) as StoredConfig;
    if (!MODEL_OPTIONS.some((model) => model.id === parsed.main_agent_id)) {
      parsed.main_agent_id = 1;
    }
    parsed.api_key = parsed.api_key ?? {};
    parsed.session = parsed.session ?? {};
    return parsed;
  } catch {
    return defaultConfig();
  }
}

function writeRaw(config: StoredConfig): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // storage can be unavailable (private mode, quota) — best effort
  }
}

export function ensureConfigFile(): void {
  // Browser storage needs no file bootstrap.
}

export function readConfig(): StoredConfig {
  return readRaw();
}

export function readSessionData(config: StoredConfig, session_id: string): SessionData | null {
  const raw = config.session?.[session_id] as LegacySessionData | undefined;
  if (!raw) return null;
  return {
    categories: migrateSessionCategories(raw),
    history: Array.isArray(raw.history) ? raw.history : [],
    last_updated: raw.last_updated,
  };
}

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

  writeRaw(config);
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
