import { Select } from "@inkjs/ui";
import { Box, Text, useInput } from "ink";
import React from "react";
import { theme } from "../ui/theme.js";

export interface SessionEntry {
  id: string;
  label: string;
}

export const NEW_SESSION_VALUE = "__new_session__";

interface SessionPickerProps {
  sessions: SessionEntry[];
  onSelect: (session_id: string | null) => void;
  onCancel: () => void;
}

export function SessionPicker({ sessions, onSelect, onCancel }: SessionPickerProps) {
  useInput((_input, key) => {
    if (key.escape) onCancel();
  });

  const options = [
    { label: "New session", value: NEW_SESSION_VALUE },
    ...sessions.map((session) => ({ label: session.label, value: session.id })),
  ];

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.primary} paddingX={1}>
      <Text color={theme.primary} bold>
        Select session
      </Text>
      <Select
        options={options}
        visibleOptionCount={6}
        onChange={(value) => (value === NEW_SESSION_VALUE ? onSelect(null) : onSelect(value))}
      />
      <Text color={theme.muted}>Enter to load · Esc to cancel</Text>
    </Box>
  );
}
