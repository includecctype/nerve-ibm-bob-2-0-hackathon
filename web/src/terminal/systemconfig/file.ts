import type { SessionData } from "../dto/wire";

export const CONFIG_FILE_PATH_DIR = "user_config/";
export const CONFIG_FILE_NAME = "config.json";

export type ConfigFile = {
  api_key: Record<number, string>;
  main_agent_id: number;
  session: Record<string, SessionData>;
};

export const DEFAULT_CONFIG: ConfigFile = {
  api_key: {},
  main_agent_id: 1,
  session: {},
};
