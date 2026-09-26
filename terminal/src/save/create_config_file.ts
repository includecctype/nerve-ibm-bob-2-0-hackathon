import { access, mkdir, writeFile } from "node:fs/promises";
import { DEFAULT_CONFIG } from "../systemconfig/file";
import { configDirPath, configFilePath } from "./config_path";

export async function ensureConfigFile(): Promise<void> {
  const dir_path = configDirPath();
  const file_path = configFilePath();

  try {
    await access(file_path);
  } catch {
    await mkdir(dir_path, { recursive: true });
    await writeFile(file_path, JSON.stringify(DEFAULT_CONFIG, null, "\t"));
  }
}
