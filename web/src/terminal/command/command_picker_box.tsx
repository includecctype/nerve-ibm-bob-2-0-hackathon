import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { BG_PANEL } from "../ui/theme";

const COMMAND_PICKER_WIDTH = 60;

type CommandPickerBoxProps = {
  title: string;
  width: number;
  children: ReactNode;
};

export function CommandPickerBox({ title, width, children }: CommandPickerBoxProps) {
  const card_width = Math.min(COMMAND_PICKER_WIDTH, Math.max(1, width));

  return (
    <Box
      position="absolute"
      width={card_width}
      display="flex"
      flexDirection="column"
      borderStyle="round"
      backgroundColor={BG_PANEL}
      paddingX={1}
      flexShrink={0}
    >
      <Text bold>{title}</Text>
      {children}
    </Box>
  );
}

type CommandPickerOverlayProps = {
  screenWidth: number;
  screenHeight: number;
  children: ReactNode;
};

export function CommandPickerOverlay({
  screenWidth,
  screenHeight,
  children,
}: CommandPickerOverlayProps) {
  return (
    <Box
      position="absolute"
      width={Math.max(1, screenWidth)}
      height={Math.max(1, screenHeight)}
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
    >
      {children}
    </Box>
  );
}
