import type { DisplayHistoryDTO, TaskCategoryDTO } from "../dto/wire.js";

export interface UserData {
  api_keys: Record<string, string>;
  main_agent_id: number;
  session_id: string;
  categories: TaskCategoryDTO[];
  history: DisplayHistoryDTO[];
  last_user_request: string;
  committed: boolean;
}

let user_data: UserData = {
  api_keys: {},
  main_agent_id: 1,
  session_id: crypto.randomUUID(),
  categories: [],
  history: [],
  last_user_request: "",
  committed: false,
};

export function getUserData(): UserData {
  return user_data;
}

export function setUserData(data: Partial<UserData>): void {
  user_data = { ...user_data, ...data };
}

export function commitSession(): void {
  user_data.committed = true;
}
