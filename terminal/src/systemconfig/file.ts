import path from "node:path";

export const CONFIG_DIR_NAME = "user_config";
export const CONFIG_FILE_NAME = "config.json";

export function configFilePath(cwd: string = process.cwd()): string {
  return path.join(cwd, CONFIG_DIR_NAME, CONFIG_FILE_NAME);
}

export interface DefaultConfig {
  api_key: Record<string, string>;
  main_agent_id: number;
  session: Record<string, unknown>;
}

export function defaultConfig(): DefaultConfig {
  return {
    api_key: {},
    main_agent_id: 1,
    session: {},
  };
}
