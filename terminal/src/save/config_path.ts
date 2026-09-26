import { join } from "node:path";
import { CONFIG_FILE_NAME, CONFIG_FILE_PATH_DIR } from "../systemconfig/file";

export function configFilePath(): string {
  return join(process.cwd(), CONFIG_FILE_PATH_DIR, CONFIG_FILE_NAME);
}

export function configDirPath(): string {
  return join(process.cwd(), CONFIG_FILE_PATH_DIR);
}
