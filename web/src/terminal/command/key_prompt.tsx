import { PasswordInput } from "@inkjs/ui";
import { Box, Text, useInput } from "ink";
import React from "react";
import { theme } from "../ui/theme.js";

interface KeyPromptProps {
  model_label: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function KeyPrompt({ model_label, onSubmit, onCancel }: KeyPromptProps) {
  useInput((_input, key) => {
    if (key.escape) onCancel();
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.primary} paddingX={1}>
      <Text color={theme.primary} bold>
        API key for {model_label}
      </Text>
      <PasswordInput
        placeholder="paste API key"
        onSubmit={(value) => {
          const trimmed = value.trim();
          if (trimmed.length > 0) onSubmit(trimmed);
        }}
      />
      <Text color={theme.muted}>Enter to save · Esc to cancel</Text>
    </Box>
  );
}
