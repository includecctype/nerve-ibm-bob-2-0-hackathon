export const theme = {
  primary: "cyan",
  success: "green",
  error: "red",
  warning: "yellow",
  muted: "gray",
  running: "blueBright",
  blocked: "magenta",
} as const;

export type ThemeColor = (typeof theme)[keyof typeof theme];
