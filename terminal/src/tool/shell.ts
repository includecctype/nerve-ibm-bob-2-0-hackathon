import { exec } from "node:child_process";
import { COMMAND_TIMEOUT_MS, OUTPUT_CHAR_CAP } from "../systemconfig/limits.js";
export function shellTool(bash_command: string): Promise<string> {
  return new Promise((resolve) => {
    const child = exec(
      bash_command,
      {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024, // 10 MB
      },
      (error, stdout, stderr) => {
        const exit_code = typeof error?.code === "number" ? error.code : error ? 1 : 0;
        const combined = (stdout + stderr).slice(0, OUTPUT_CHAR_CAP);
        resolve(`Exit code: ${exit_code}\n${combined}`);
      },
    );

    // Cleared on close so an idle timer never holds the event loop open.
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
    }, COMMAND_TIMEOUT_MS);
    child.once("close", () => {
      clearTimeout(timeout);
    });
  });
}
