import type { DisplayHistoryDTO, TaskUpdatePayload } from "../dto/wire";
import { user_data } from "../session/user_data";
import { type ConfigFile, DEFAULT_CONFIG } from "../systemconfig/file";
import { CONFIG_STORAGE_KEY } from "./config_path";

const WRITE_DEBOUNCE_MS = 50;

// Serializes storage writes; debounce coalesces bursts (placeholder + real task_update, etc.)
let write_queue: Promise<void> = Promise.resolve();
let debounce_timer: ReturnType<typeof setTimeout> | null = null;
let pending_resolvers: Array<() => void> = [];

function flushDebouncedWrite(): Promise<void> {
  if (debounce_timer) {
    clearTimeout(debounce_timer);
    debounce_timer = null;
  }
  const resolvers = pending_resolvers;
  pending_resolvers = [];
  if (resolvers.length === 0) {
    return write_queue;
  }
  write_queue = write_queue
    .catch(() => {})
    .then(() => writeUserDataToFile())
    .catch(() => {})
    .finally(() => {
      for (const resolve of resolvers) resolve();
    });
  return write_queue;
}

function enqueueWrite(): Promise<void> {
  return new Promise<void>((resolve) => {
    pending_resolvers.push(resolve);
    if (debounce_timer) clearTimeout(debounce_timer);
    debounce_timer = setTimeout(() => {
      debounce_timer = null;
      void flushDebouncedWrite();
    }, WRITE_DEBOUNCE_MS);
  });
}

async function waitForWrites(): Promise<void> {
  if (debounce_timer || pending_resolvers.length > 0) {
    await flushDebouncedWrite();
  }
  await write_queue;
}

// save to user data struct
function saveAPIKeyForModel(model_id: number, api_key: string): void {
  if (!user_data) return;
  user_data.api_keys[model_id] = api_key;
  void enqueueWrite();
}

function saveMainAgentId(model_id: number): void {
  if (!user_data) return;
  user_data.main_agent_id = model_id;
  void enqueueWrite();
}

function saveTaskUpdate(data: TaskUpdatePayload): void {
  if (!user_data) return;
  user_data.categories = [...data.categories];
  void enqueueWrite();
}

function saveDisplayHistory(entry: DisplayHistoryDTO): void {
  if (!user_data) return;
  user_data.history.push(entry);
  void enqueueWrite();
}

// trigger write to browser storage
async function writeUserDataToFile(): Promise<void> {
  if (!user_data) return;

  let config: ConfigFile;
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    config = raw ? (JSON.parse(raw) as ConfigFile) : { ...DEFAULT_CONFIG };
  } catch {
    config = { ...DEFAULT_CONFIG };
  }

  config.api_key = { ...user_data.api_keys };
  config.main_agent_id = user_data.main_agent_id;
  if (user_data.session_committed) {
    config.session[user_data.session_id] = {
      categories: user_data.categories,
      history: user_data.history,
      last_updated: Date.now(),
    };
  }

  try {
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // storage can be unavailable (private mode, quota) — best effort
  }
}

export {
  saveAPIKeyForModel,
  saveDisplayHistory,
  saveMainAgentId,
  saveTaskUpdate,
  waitForWrites,
  writeUserDataToFile,
};
