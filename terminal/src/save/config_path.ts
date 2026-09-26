import path from "node:path";
import { configFilePath } from "../systemconfig/file.js";

export { configFilePath };

export function configDirPath(cwd: string = process.cwd()): string {
  return path.join(cwd, "user_config");
}
