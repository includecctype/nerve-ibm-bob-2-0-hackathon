import { Box, Text } from "ink";
import React from "react";
import { theme } from "./theme.js";

const BANNER = [
  " ███╗   ██╗ ███████╗ ██████╗  ██╗   ██╗ ███████╗",
  " ████╗  ██║ ██╔════╝ ██╔══██╗ ██║   ██║ ██╔════╝",
  " ██╔██╗ ██║ █████╗   ██████╔╝ ██║   ██║ █████╗",
  " ██║╚██╗██║ ██╔══╝   ██╔══██╗ ╚██╗ ██╔╝ ██╔══╝",
  " ██║ ╚████║ ███████╗ ██║  ██║  ╚████╔╝  ███████╗",
  " ╚═╝  ╚═══╝ ╚══════╝ ╚═╝  ╚═╝   ╚═══╝   ╚══════╝",
];

export function LogoView() {
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
      <Text color={theme.primary}>{BANNER.join("\n")}</Text>
      <Text color={theme.muted}>terminal-native multi-agent coding orchestrator</Text>
      <Text color={theme.muted}>connecting...</Text>
      <Text color={theme.warning}>not connected — press /model or /key to add an API key</Text>
    </Box>
  );
}
