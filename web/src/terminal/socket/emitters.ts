import type { QuestionnaireAnswerDTO, ToolResultDTO } from "../dto/wire.js";
import { getSocket } from "./client.js";

export function emitUserPrompt(prompt: string): void {
  getSocket().emit("user_prompt", prompt);
}

export function emitQuestionnaireAnswers(answers: QuestionnaireAnswerDTO[]): void {
  getSocket().emit("questionnaire_answers", answers);
}

export function emitAgentErrorResponse(message: string): void {
  getSocket().emit("agent_error_response", message);
}

export function emitToolResult(result: ToolResultDTO): void {
  getSocket().emit("tool_result", result);
}
