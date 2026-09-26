export const BG_BLACK = "black";
export const BG_PANEL = "#0a140a";

import { isQuestionnaireEntry } from "./display_entry";

const BG_USER = "#003b00";

const ROLE_COLOR: Record<string, string> = {
  user: "#c8ffd4",
  assistant: "#00ff41",
  system: "#ffcc00",
  error: "#ff3b3b",
};

export function roleColor(role: string): string {
  return ROLE_COLOR[role] ?? ROLE_COLOR.assistant;
}

export function entryPanelBg(role: string, content: string): string | undefined {
  if (role === "user") {
    return BG_USER;
  }
  if (isQuestionnaireEntry(role, content)) {
    return BG_PANEL;
  }
  return undefined;
}
