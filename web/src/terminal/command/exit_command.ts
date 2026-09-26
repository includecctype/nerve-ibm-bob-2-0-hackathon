import { writeUserDataToFile } from "../save/config_writer";
import { socket } from "../socket/client";
import { isCommand } from "./command_list";

export function isExitCommand(input: string): boolean {
  return isCommand(input, "/exit");
}

export async function exitApp(): Promise<void> {
  try {
    await writeUserDataToFile();
  } catch {
    // best-effort flush before quit
  }
  socket.disconnect();
}
