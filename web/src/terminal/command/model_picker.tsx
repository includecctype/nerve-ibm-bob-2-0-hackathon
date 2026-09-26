import { Select } from "@inkjs/ui";
import { Box, Text, useInput } from "ink";
import React from "react";
import { MODEL_OPTIONS } from "../systemconfig/model.js";
import { theme } from "../ui/theme.js";

interface ModelPickerProps {
  current_id: number;
  api_keys: Record<string, string>;
  onSelect: (model_id: number) => void;
  onCancel: () => void;
}

export function ModelPicker({ current_id, api_keys, onSelect, onCancel }: ModelPickerProps) {
  useInput((_input, key) => {
    if (key.escape) onCancel();
  });

  // Current model first, so Enter keeps the active model selected.
  const ordered = [
    ...MODEL_OPTIONS.filter((model) => model.id === current_id),
    ...MODEL_OPTIONS.filter((model) => model.id !== current_id),
  ];

  const options = ordered.map((model) => ({
    label: `${model.label} — ${model.provider}${
      model.id === current_id ? " (active)" : ""
    }${api_keys[String(model.id)] ? "" : " · no key"}`,
    value: String(model.id),
  }));

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.primary} paddingX={1}>
      <Text color={theme.primary} bold>
        Select model
      </Text>
      <Select options={options} onChange={(value) => onSelect(Number(value))} />
      <Text color={theme.muted}>Enter to choose · Esc to cancel</Text>
    </Box>
  );
}
