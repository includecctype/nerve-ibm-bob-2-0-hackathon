import { saveAPIKeyForModel, waitForWrites } from "../save/config_writer";
import { user_data } from "../session/user_data";
import { socket } from "../socket/client";
import { isCommand } from "./command_list";

export function isKeyCommand(input: string): boolean {
  return isCommand(input, "/key");
}

export async function applyApiKeyChange(model_id: number, api_key: string): Promise<void> {
  if (!user_data) return;
  saveAPIKeyForModel(model_id, api_key);
  if (model_id === user_data.main_agent_id) {
    socket.disconnect();
    socket.connect();
  }
  await waitForWrites();
}
