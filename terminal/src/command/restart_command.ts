import { waitForWrites, writeUserDataToFile } from "../save/config_writer";
import { socket } from "../socket/client";
import { isCommand } from "./command_list";

export function isRestartCommand(input: string): boolean {
  return isCommand(input, "/restart");
}

export async function restartConnection(): Promise<void> {
  try {
    await writeUserDataToFile();
    await waitForWrites();
  } catch {
    // best-effort flush before reconnect
  }
  socket.disconnect();
  socket.connect();
}
