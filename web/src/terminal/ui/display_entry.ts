export const QUESTION_PREFIX = "Q: ";

export function isQuestionnaireEntry(role: string, content: string): boolean {
  return role === "system" && content.startsWith(QUESTION_PREFIX);
}
