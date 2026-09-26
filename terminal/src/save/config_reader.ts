import fs from "node:fs";
import path from "node:path";
import { type LegacySessionData, migrateSessionCategories } from "../dto/migrate_session.js";
import type { SessionData } from "../dto/wire.js";
import { defaultConfig } from "../systemconfig/file.js";
import { MODEL_OPTIONS } from "../systemconfig/model.js";
import { configDirPath, configFilePath } from "./config_path.js";

export interface StoredConfig {
  api_key: Record<string, string>;
  main_agent_id: number;
  session: Record<string, SessionData>;
}

export function ensureConfigFile(): void {
  const dir = configDirPath();
  const file = configFilePath();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultConfig(), null, 2), "utf8");
  }
}

export function readConfig(): StoredConfig {
  ensureConfigFile();
  try {
    const raw = fs.readFileSync(configFilePath(), "utf8");
    const parsed = JSON.parse(raw) as StoredConfig;
    // Validate main_agent_id
    const valid_ids = MODEL_OPTIONS.map((m) => m.id);
    if (!valid_ids.includes(parsed.main_agent_id)) {
      parsed.main_agent_id = 1;
    }
    return parsed;
  } catch {
    return defaultConfig() as StoredConfig;
  }
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
