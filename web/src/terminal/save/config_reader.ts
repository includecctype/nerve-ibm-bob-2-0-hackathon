import type { SessionData } from "../dto/wire";
import type { UserData } from "../session/user_data";
import { type ConfigFile, DEFAULT_CONFIG } from "../systemconfig/file";
import { PROVIDED_MODEL_ID } from "../systemconfig/model";
import { CONFIG_STORAGE_KEY } from "./config_path";

function readStoredConfig(): ConfigFile {
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<ConfigFile>;
    return {
      api_key: parsed.api_key ?? {},
      main_agent_id: parsed.main_agent_id ?? PROVIDED_MODEL_ID,
      session: parsed.session ?? {},
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function readConfig(): Promise<UserData> {
  const config = readStoredConfig();

  return {
    api_keys: { ...config.api_key },
    // A web visit is fresh: always start on the operator-provided model.
    main_agent_id: PROVIDED_MODEL_ID,
    session_id: crypto.randomUUID(),
    session_committed: false,
    categories: [],
    history: [],
  };
}

export async function readSessionData(): Promise<Record<string, SessionData>> {
  return readStoredConfig().session;
}
