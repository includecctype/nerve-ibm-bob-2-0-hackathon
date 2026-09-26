export const BG_BLACK = "black";
export const BG_PANEL = "#111111";

import { isQuestionnaireEntry } from "./display_entry";

const BG_USER = "white";

const ROLE_COLOR: Record<string, string> = {
  user: "black",
  assistant: "white",
  system: "yellow",
  error: "red",
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
