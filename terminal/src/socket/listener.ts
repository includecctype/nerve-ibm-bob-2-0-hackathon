import type { DisplayHistoryDTO, ToolRequestDTO } from "../dto/wire";
import { saveDisplayHistory, saveTaskUpdate, writeUserDataToFile } from "../save/config_writer";
import { executeToolRequest } from "../tool/executor";
import { socket } from "./client";
import { emitAgentErrorResponse, emitToolResult } from "./emitters";
import {
  connection_status_handler,
  display_handler,
  error_handler,
  questionnaire_handler,
  rate_limited_handler,
  subagent_response_handler,
  task_update_handler,
} from "./handler_registry";

socket.on("main_agent_response", (data) => {
  const entry: DisplayHistoryDTO = { role: "assistant", content: data };
  saveDisplayHistory(entry);
  display_handler?.(entry);
});

socket.on("task_update", (data) => {
  saveTaskUpdate(data);
  task_update_handler?.(data);
});

socket.on("subagent_response", (data) => {
  subagent_response_handler?.(data);
});

socket.on("connection_status", (data) => {
  connection_status_handler?.(data);
});

socket.on("questionnaire", (data) => {
  questionnaire_handler?.(data);
});

socket.on("agent_error", (data: string) => {
  error_handler?.(data);
  emitAgentErrorResponse(data);
});

socket.on("rate_limited", (data) => {
  rate_limited_handler?.(data);
});

// Backend forwarded a file/shell call: it executes here, on this machine.
socket.on("tool_request", (data: ToolRequestDTO) => {
  void executeToolRequest(data)
    .catch((e: unknown) => `Error: ${e instanceof Error ? e.message : String(e)}`)
    .then((output) => {
      emitToolResult({ id: data.id, ok: !output.startsWith("Error:"), output });
    });
});

socket.on("disconnect", async () => {
  await writeUserDataToFile();
});
