import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { SessionData } from "../dto/wire";
import type { UserData } from "../session/user_data";
import type { ConfigFile } from "../systemconfig/file";
import { MODEL_OPTIONS } from "../systemconfig/model";
import { configFilePath } from "./config_path";

export async function readConfig(): Promise<UserData> {
  const raw = await readFile(configFilePath(), "utf-8");
  const config: ConfigFile = JSON.parse(raw);

  const valid_model = MODEL_OPTIONS.some((m) => m.id === config.main_agent_id);
  const main_agent_id = valid_model ? config.main_agent_id : 1;

  return {
    api_keys: { ...config.api_key },
    main_agent_id,
    session_id: randomUUID(),
    session_committed: false,
    categories: [],
    history: [],
  };
}

export async function readSessionData(): Promise<Record<string, SessionData>> {
  try {
    const raw = await readFile(configFilePath(), "utf-8");
    const config: ConfigFile = JSON.parse(raw);
    return config.session ?? {};
  } catch {
    return {};
  }
}
