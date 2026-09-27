import type { ModelOption } from "../dto/model";

export const PROVIDED_MODEL_ID = 6;

export const MODEL_OPTIONS: ModelOption[] = [
  { id: 1, label: "OpenRouter Auto" },
  { id: 2, label: "Groq GPT-OSS 120B" },
  { id: 3, label: "Claude Fable 5" },
  { id: 4, label: "Kimi K2.6" },
  { id: 5, label: "DeepSeek Chat" },
  { id: 6, label: "DeepSeek Flash (provided)" },
];

export function isProvidedModel(model_id: number): boolean {
  return model_id === PROVIDED_MODEL_ID;
}
