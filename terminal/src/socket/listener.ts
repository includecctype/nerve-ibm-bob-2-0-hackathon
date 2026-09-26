import type { Socket } from "socket.io-client";
import type {
  StructuredQuestionDTO,
  SubagentResponseDTO,
  TaskUpdatePayload,
  ToolRequestDTO,
} from "../dto/wire.js";
import { saveDisplayHistory, saveTaskUpdate } from "../save/config_writer.js";
import { waitForWrites } from "../save/config_writer.js";
import { executeToolRequest } from "../tool/executor.js";
import { emitToolResult } from "./emitters.js";

export type OnConnectionStatus = (connected: boolean) => void;
export type OnMainAgentResponse = (text: string) => void;
export type OnTaskUpdate = (payload: TaskUpdatePayload) => void;
export type OnSubagentResponse = (payload: SubagentResponseDTO) => void;
export type OnQuestionnaire = (questions: StructuredQuestionDTO[]) => void;
export type OnAgentError = (message: string) => void;

export interface ListenerCallbacks {
  onConnectionStatus: OnConnectionStatus;
  onMainAgentResponse: OnMainAgentResponse;
  onTaskUpdate: OnTaskUpdate;
  onSubagentResponse: OnSubagentResponse;
  onQuestionnaire: OnQuestionnaire;
  onAgentError: OnAgentError;
}

export function registerListeners(socket: Socket, cb: ListenerCallbacks): void {
  socket.on("connection_status", (connected: boolean) => {
    cb.onConnectionStatus(connected);
  });

  socket.on("main_agent_response", (text: string) => {
    saveDisplayHistory({ role: "assistant", content: text });
    cb.onMainAgentResponse(text);
  });

  socket.on("task_update", (payload: TaskUpdatePayload) => {
    saveTaskUpdate(payload.categories);
    cb.onTaskUpdate(payload);
  });

  socket.on("subagent_response", (payload: SubagentResponseDTO) => {
    cb.onSubagentResponse(payload);
  });

  socket.on("questionnaire", (questions: StructuredQuestionDTO[]) => {
    cb.onQuestionnaire(questions);
  });

  socket.on("agent_error", (message: string) => {
    cb.onAgentError(message);
  });

  socket.on("tool_request", async (req: ToolRequestDTO) => {
    const output = await executeToolRequest(req);
    const ok = !output.startsWith("Error:");
    // The connection can drop while the tool runs locally; the backend already
    // resolves the pending call on disconnect, so there is nobody to answer.
    if (socket.connected) {
      emitToolResult({ id: req.id, ok, output });
    }
  });

  socket.on("disconnect", async () => {
    await waitForWrites();
  });
}
