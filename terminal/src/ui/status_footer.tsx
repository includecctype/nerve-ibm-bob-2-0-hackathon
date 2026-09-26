import { Box, Text } from "ink";
import React from "react";
import { getModelLabel } from "../systemconfig/model.js";
import { theme } from "./theme.js";

interface StatusFooterProps {
  model_id: number;
}

export function StatusFooter({ model_id }: StatusFooterProps) {
  const cwd = process.cwd().toUpperCase();
  const model_label = getModelLabel(model_id);

  return (
    <Box justifyContent="space-between">
      <Text color={theme.primary} bold>
        NERVE
      </Text>
      <Text color={theme.muted}>{cwd}</Text>
      <Text color={theme.muted}>{model_label}</Text>
    </Box>
  );
}
