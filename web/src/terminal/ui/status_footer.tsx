import { Box, Text } from "ink";

type StatusFooterProps = {
  width: number;
  cwd: string;
  modelLabel: string;
};

export const STATUS_FOOTER_TOP_PAD = 1;

function truncatePathEnd(path: string, width: number): string {
  if (width < 1) return "";
  if (path.length <= width) return path;
  if (width === 1) return "…";
  return `…${path.slice(-(width - 1))}`;
}

export function statusFooterRows(): number {
  return STATUS_FOOTER_TOP_PAD + 1 + 1 + 1;
}

export function StatusFooter({ width, cwd, modelLabel }: StatusFooterProps) {
  const content_width = Math.max(1, width - 2);
  const path_display = truncatePathEnd(cwd.toUpperCase(), content_width);

  return (
    <Box
      width={width}
      flexDirection="column"
      display="flex"
      flexShrink={0}
      paddingX={1}
      paddingTop={STATUS_FOOTER_TOP_PAD}
    >
      <Box width="100%" display="flex" flexDirection="column" flexShrink={0}>
        <Text bold color="#00ff41" wrap="truncate">
          NERVE
        </Text>
      </Box>
      <Box width="100%" display="flex" flexDirection="column" flexShrink={0}>
        <Text dimColor wrap="truncate">
          {path_display}
        </Text>
      </Box>
      <Box width="100%" display="flex" flexDirection="column" flexShrink={0}>
        <Text color="#ffcc00" wrap="truncate">
          {modelLabel}
        </Text>
      </Box>
    </Box>
  );
}
