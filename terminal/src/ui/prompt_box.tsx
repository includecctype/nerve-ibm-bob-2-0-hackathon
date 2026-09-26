import { Box, Text } from "ink";
import React from "react";
import { theme } from "./theme.js";

interface PromptBoxProps {
  value: string;
  command_mode: boolean;
}

export function PromptBox({ value, command_mode }: PromptBoxProps) {
  return (
    <Box borderStyle="round" borderColor={command_mode ? theme.warning : theme.primary}>
      <Text color={command_mode ? theme.warning : theme.primary}>{command_mode ? "/" : "> "}</Text>
      <Text>{value}</Text>
      <Text color={theme.primary}>▊</Text>
    </Box>
  );
}
