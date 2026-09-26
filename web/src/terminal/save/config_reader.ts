import type { SessionData } from "../dto/wire";
import type { UserData } from "../session/user_data";
import { type ConfigFile, DEFAULT_CONFIG } from "../systemconfig/file";
import { MODEL_OPTIONS } from "../systemconfig/model";
import { CONFIG_STORAGE_KEY } from "./config_path";

function readStoredConfig(): ConfigFile {
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<ConfigFile>;
    return {
      api_key: parsed.api_key ?? {},
      main_agent_id: parsed.main_agent_id ?? 1,
      session: parsed.session ?? {},
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function readConfig(): Promise<UserData> {
  const config = readStoredConfig();

  const valid_model = MODEL_OPTIONS.some((m) => m.id === config.main_agent_id);
  const main_agent_id = valid_model ? config.main_agent_id : 1;

  return {
    api_keys: { ...config.api_key },
    main_agent_id,
    session_id: crypto.randomUUID(),
    session_committed: false,
    categories: [],
    history: [],
  };
}

export async function readSessionData(): Promise<Record<string, SessionData>> {
  return readStoredConfig().session;
}
