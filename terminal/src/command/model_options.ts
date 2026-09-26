import { user_data } from "../session/user_data";
import { MODEL_OPTIONS } from "../systemconfig/model";

export type ModelSelectOption = {
  modelId: number;
  label: string;
  value: string;
};

export function buildModelSelectOptions(): ModelSelectOption[] {
  const current_id = user_data?.main_agent_id;
  const ordered = [
    ...MODEL_OPTIONS.filter((m) => m.id === current_id),
    ...MODEL_OPTIONS.filter((m) => m.id !== current_id),
  ];

  return ordered.map((m) => ({
    modelId: m.id,
    label: m.id === current_id ? `${m.label} (current)` : m.label,
    value: String(m.id),
  }));
}
