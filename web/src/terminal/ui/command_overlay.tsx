import { Box, Text } from "ink";
import React from "react";
import { filterCommands } from "../command/command_list.js";
import { theme } from "./theme.js";

interface CommandOverlayProps {
  input: string;
  selected_index: number;
}

export function CommandOverlay({ input, selected_index }: CommandOverlayProps) {
  const suggestions = filterCommands(input);
  const highlighted = Math.min(selected_index, suggestions.length - 1);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.warning} paddingX={1}>
      <Text color={theme.warning} bold>
        Commands
      </Text>
      {suggestions.map((cmd, index) => (
        <Text
          key={cmd.name}
          inverse={index === highlighted}
          color={index === highlighted ? theme.primary : "white"}
        >
          {cmd.name} — {cmd.description}
        </Text>
      ))}
      {suggestions.length === 0 && <Text color={theme.error}>No matching command</Text>}
    </Box>
  );
}
