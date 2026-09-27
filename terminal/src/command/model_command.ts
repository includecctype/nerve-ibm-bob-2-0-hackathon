import { saveAPIKeyForModel, saveMainAgentId, waitForWrites } from "../save/config_writer";
import { user_data } from "../session/user_data";
import { socket } from "../socket/client";
import { MODEL_OPTIONS } from "../systemconfig/model";
import { isCommand } from "./command_list";

export function isModelCommand(input: string): boolean {
  return isCommand(input, "/model");
}

export function getModelLabel(model_id: number): string {
  return MODEL_OPTIONS.find((m) => m.id === model_id)?.label ?? `Unknown model (${model_id})`;
}

export function hasApiKeyForModel(model_id: number): boolean {
  if (!user_data) return false;
  return Boolean(user_data.api_keys[model_id]);
}

export function applyModelChoice(model_id: number, api_key: string): void {
  saveMainAgentId(model_id);
  saveAPIKeyForModel(model_id, api_key);
  socket.disconnect();
  socket.connect();
}

export async function persistModelChoice(model_id: number, api_key: string): Promise<void> {
  applyModelChoice(model_id, api_key);
  await waitForWrites();
}
