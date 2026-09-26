import type {
  DisplayHistoryDTO,
  StructuredQuestionDTO,
  SubagentResponseDTO,
  TaskUpdatePayload,
} from "../dto/wire";

export let display_handler: ((data: DisplayHistoryDTO) => void) | null = null;
export let task_update_handler: ((data: TaskUpdatePayload) => void) | null = null;
export let subagent_response_handler: ((data: SubagentResponseDTO) => void) | null = null;
export let connection_status_handler: ((data: boolean) => void) | null = null;
export let questionnaire_handler: ((questions: StructuredQuestionDTO[]) => void) | null = null;
export let error_handler: ((message: string) => void) | null = null;

export function onDisplay(handler: (data: DisplayHistoryDTO) => void) {
  display_handler = handler;
}

export function onTaskUpdate(handler: (data: TaskUpdatePayload) => void) {
  task_update_handler = handler;
}

export function onSubagentResponse(handler: (data: SubagentResponseDTO) => void) {
  subagent_response_handler = handler;
}

export function onConnectionStatus(handler: (data: boolean) => void) {
  connection_status_handler = handler;
}

export function onQuestionnaire(handler: (questions: StructuredQuestionDTO[]) => void) {
  questionnaire_handler = handler;
}

export function onError(handler: (message: string) => void) {
  error_handler = handler;
}
