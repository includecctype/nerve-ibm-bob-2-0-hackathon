import { Box, Text } from "ink";
import BigText from "ink-big-text";
import React from "react";
import { theme } from "./theme.js";

export function LogoView() {
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
      <BigText text="nerve" colors={[theme.primary]} />
      <Text color={theme.muted}>terminal-native multi-agent coding orchestrator</Text>
      <Text color={theme.muted}>connecting...</Text>
    </Box>
  );
}
