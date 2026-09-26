import { exec } from "node:child_process";
import { COMMAND_TIMEOUT_MS, OUTPUT_CHAR_CAP } from "../systemconfig/limits.js";

function truncateOutput(text: string, cap: number): string {
  if (text.length <= cap) return text;
  return `${text.slice(0, cap)}\n... [truncated, ${text.length - cap} more characters]`;
}

// Runs in the user's shell, in the user's workspace, with the same 30s cap
// and the same "Exit code / stdout / stderr" shape the model knew.
export function shellTool(bash_command: string): Promise<string> {
  return new Promise((resolve_promise) => {
    let settled = false;
    const finish = (result: string) => {
      if (settled) return;
      settled = true;
      resolve_promise(result);
    };

    const child = exec(
      bash_command,
      { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (settled) return;

        if (error && typeof error.code !== "number") {
          finish(`Failed to execute the command: ${error.message}`);
          return;
        }

        const exit_code = error ? (error.code as number) : 0;
        const parts = [`Exit code: ${exit_code}`];
        if (stdout) {
          parts.push(`stdout:\n${truncateOutput(stdout, OUTPUT_CHAR_CAP)}`);
        }
        if (stderr) {
          parts.push(`stderr:\n${truncateOutput(stderr, OUTPUT_CHAR_CAP)}`);
        }
        if (!stdout && !stderr) parts.push("(no output)");
        finish(parts.join("\n"));
      },
    );

    // Resolve from the timer: killing the child only ends the direct shell, so a
    // grandchild holding the pipes can otherwise leave the promise pending.
    const timer = setTimeout(() => {
      child.kill();
      finish(`Error: command timed out after ${COMMAND_TIMEOUT_MS / 1000}s`);
    }, COMMAND_TIMEOUT_MS);
    child.on("close", () => clearTimeout(timer));
  });
}
