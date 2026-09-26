export interface ModelOption {
  id: number;
  label: string;
  provider: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  { id: 1, label: "OpenRouter Auto", provider: "openrouter" },
  { id: 2, label: "Groq GPT-OSS 120B", provider: "groq" },
  { id: 3, label: "Claude Fable 5", provider: "anthropic" },
  { id: 4, label: "Kimi K2.6", provider: "baseten" },
  { id: 5, label: "DeepSeek Chat", provider: "deepseek" },
];

export function getModelLabel(id: number): string {
  return MODEL_OPTIONS.find((m) => m.id === id)?.label ?? `Model ${id}`;
}
