import { Box, Text } from "ink";
import type { CommandEntry } from "./command_list";

type SuggestionBoxProps = {
  commands: CommandEntry[];
  selectedIndex: number;
};

export function SuggestionBox({ commands, selectedIndex }: SuggestionBoxProps) {
  if (commands.length === 0) return null;

  return (
    <Box
      width="100%"
      flexDirection="column"
      display="flex"
      paddingX={1}
      paddingY={1}
      flexShrink={0}
    >
      {commands.map((entry, index) => (
        <Text
          key={entry.name}
          inverse={index === selectedIndex}
          color={index === selectedIndex ? undefined : "#00ff41"}
        >
          {entry.name} — {entry.description}
        </Text>
      ))}
    </Box>
  );
}
