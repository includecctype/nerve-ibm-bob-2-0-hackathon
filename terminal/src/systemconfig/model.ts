import type { ModelOption } from "../dto/model";

export const PROVIDED_MODEL_ID = 1;

export const MODEL_OPTIONS: ModelOption[] = [
  { id: 1, label: "DeepSeek Flash (provided)" },
  { id: 2, label: "OpenRouter Auto" },
  { id: 3, label: "Groq GPT-OSS 120B" },
  { id: 4, label: "Claude Fable 5" },
  { id: 5, label: "Kimi K2.6" },
  { id: 6, label: "DeepSeek Chat" },
];

export function isProvidedModel(model_id: number): boolean {
  return model_id === PROVIDED_MODEL_ID;
}
