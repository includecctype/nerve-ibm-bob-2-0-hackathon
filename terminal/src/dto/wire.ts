export type TaskItemStatus = "pending" | "running" | "done" | "failed";
export type TaskCategoryStatus = "pending" | "running" | "done" | "failed" | "blocked";

export interface TaskItemDTO {
  description: string;
  status: TaskItemStatus;
  result: string;
}

export interface TaskCategoryDTO {
  name: string;
  status: TaskCategoryStatus;
  depends_on: string[];
  tasks: TaskItemDTO[];
}

export interface TaskUpdatePayload {
  categories: TaskCategoryDTO[];
}

export interface DisplayHistoryDTO {
  role: string;
  content: string;
}

export interface StructuredQuestionDTO {
  question: string;
  options: string[];
}

export interface QuestionnaireAnswerDTO {
  question: string;
  answer: string;
}

export interface SubagentResponseDTO {
  category: string;
  status: "done" | "failed";
  report: string;
}

export interface ToolRequestDTO {
  id: string;
  tool: string;
  args: Record<string, unknown>;
}

export interface ToolResultDTO {
  id: string;
  ok: boolean;
  output: string;
}

export interface SessionData {
  categories: TaskCategoryDTO[];
  history: DisplayHistoryDTO[];
  last_updated?: number;
}
