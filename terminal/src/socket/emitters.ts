import type { QuestionnaireAnswerDTO, ToolResultDTO } from "../dto/wire";
import { saveDisplayHistory } from "../save/config_writer";
import { commitSession } from "../session/user_data";
import { socket } from "./client";

export function emitUserPrompt(prompt: string) {
  commitSession();
  saveDisplayHistory({ role: "user", content: prompt });
  socket.emit("user_prompt", prompt);
}

export function emitQuestionnaireAnswers(answers: QuestionnaireAnswerDTO[]) {
  socket.emit("questionnaire_answers", answers);
}

export function emitAgentErrorResponse(message: string) {
  socket.emit("agent_error_response", message);
}

export function emitToolResult(result: ToolResultDTO) {
  socket.emit("tool_result", result);
}
