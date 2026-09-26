export type QuestionnaireAnswerDTO = {
  question: string;
  answer: string;
};

export type StructuredQuestionDTO = {
  question: string;
  options: string[];
};

export type TaskItemStatus = "pending" | "running" | "done" | "failed";
export type TaskCategoryStatus = "pending" | "running" | "done" | "failed" | "blocked";

export type TaskItemDTO = {
  description: string;
  status: TaskItemStatus;
  result: string;
};

export type TaskCategoryDTO = {
  name: string;
  status: TaskCategoryStatus;
  depends_on: string[];
  tasks: TaskItemDTO[];
};

export type TaskUpdatePayload = {
  categories: TaskCategoryDTO[];
};

export type DisplayHistoryDTO = {
  role: string;
  content: string;
};

export type SubagentResponseDTO = {
  category: string;
  status: "done" | "failed";
  report: string;
};

// Backend forwards file/shell tool calls here; they run on this machine.
export type ToolRequestDTO = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
};

export type ToolResultDTO = {
  id: string;
  ok: boolean;
  output: string;
};

export type SessionData = {
  categories: TaskCategoryDTO[];
  history: DisplayHistoryDTO[];
  last_updated?: number;
};
