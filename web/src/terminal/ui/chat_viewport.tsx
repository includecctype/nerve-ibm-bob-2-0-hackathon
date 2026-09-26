import { Box, Text } from "ink";
import type { GroupedDisplayBlock } from "./text_window";
import { entryPanelBg, roleColor } from "./theme";

type ChatViewportProps = {
  chatBlocks: GroupedDisplayBlock[];
  displayScroll: number;
  viewportRows: number;
};

export function ChatViewport({ chatBlocks, displayScroll, viewportRows }: ChatViewportProps) {
  return (
    <Box
      width="100%"
      height={viewportRows}
      flexDirection="column"
      display="flex"
      paddingX={1}
      justifyContent="flex-end"
      overflow="hidden"
      flexShrink={0}
      marginBottom={1}
    >
      {displayScroll > 0 && (
        <Text dimColor wrap="truncate">
          — scrolled up ({displayScroll} lines, End for live) —
        </Text>
      )}
      {chatBlocks.length === 0 ? (
        <Text dimColor>No messages yet</Text>
      ) : (
        chatBlocks.map((block) => (
          <Box
            key={block.entryIndex}
            width="100%"
            display="flex"
            flexDirection="column"
            paddingTop={block.paddingTop}
            paddingBottom={block.paddingBottom}
            paddingX={1}
            backgroundColor={entryPanelBg(block.role, block.content)}
          >
            {block.lines.map((line) => (
              <Text key={line.lineIndex} color={roleColor(block.role)}>
                {line.text}
              </Text>
            ))}
          </Box>
        ))
      )}
    </Box>
  );
}
