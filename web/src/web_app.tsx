import { Box, Text } from "ink";
import { InkXterm } from "ink-web/core";
import "@xterm/xterm/css/xterm.css";

export function WebApp() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <InkXterm focus>
        <Box flexDirection="column">
          <Text color="green">nerve web workspace</Text>
          <Text dimColor>Ink runs in the browser through ink-web.</Text>
        </Box>
      </InkXterm>
    </div>
  );
}
