import { Box, Text } from "ink";
import React from "react";
import { theme } from "./theme.js";

interface CommandOverlayProps {
  input: string;
}

const COMMANDS = ["/model", "/key", "/session", "/restart", "/exit"];

export function CommandOverlay({ input }: CommandOverlayProps) {
  const suggestions = COMMANDS.filter((c) => c.startsWith(input));

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.warning} paddingX={1}>
      <Text color={theme.warning} bold>
        Commands
      </Text>
      {suggestions.map((cmd) => (
        <Text key={cmd} color={input === cmd ? theme.primary : "white"}>
          {cmd}
        </Text>
      ))}
      {suggestions.length === 0 && <Text color={theme.error}>No matching command</Text>}
    </Box>
  );
}
