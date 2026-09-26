import type { SessionData } from "../dto/wire";

export type UserData = {
  api_keys: Record<number, string>;
  main_agent_id: number;
  session_id: string;
  session_committed: boolean;
  categories: SessionData["categories"];
  history: SessionData["history"];
};

export let user_data: UserData | null = null;

export function setUserData(data: UserData) {
  user_data = data;
}

export function commitSession() {
  if (user_data) user_data.session_committed = true;
}
