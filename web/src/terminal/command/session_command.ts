import { migrateSessionCategories } from "../dto/migrate_session";
import type { DisplayHistoryDTO, SessionData } from "../dto/wire";
import { readSessionData } from "../save/config_reader";
import { writeUserDataToFile } from "../save/config_writer";
import { user_data } from "../session/user_data";
import { socket } from "../socket/client";
import { isCommand } from "./command_list";

const NEW_SESSION_VALUE = "__new_session__";

export type SessionOption = {
  value: string;
  label: string;
  session_id: string | null;
  data: SessionData | null;
};

export function isSessionCommand(input: string): boolean {
  return isCommand(input, "/session");
}

function buildHistoryPreview(history: DisplayHistoryDTO[]): string {
  const first = history.find((entry) => entry.role === "user") ?? history[0];
  if (!first) return "";
  const text = first.content.replace(/\s+/g, " ").trim();
  if (!text) return "";
  const clipped = text.length > 40 ? `${text.slice(0, 40)}...` : text;
  return ` — "${clipped}"`;
}

export async function loadSessionOptions(): Promise<SessionOption[]> {
  const sessions = await readSessionData();
  const options: SessionOption[] = [
    {
      value: NEW_SESSION_VALUE,
      label: "new session",
      session_id: null,
      data: null,
    },
  ];

  const sorted = Object.entries(sessions).sort(
    ([, a], [, b]) => (b.last_updated ?? 0) - (a.last_updated ?? 0),
  );

  for (const [id, data] of sorted) {
    const history = data.history ?? [];
    const count = history.length;
    const count_label = count === 0 ? "empty" : `${count} message${count === 1 ? "" : "s"}`;
    options.push({
      value: id,
      label: `${id} — ${count_label}${buildHistoryPreview(history)}`,
      session_id: id,
      data: {
        categories: migrateSessionCategories(data),
        history,
        last_updated: data.last_updated,
      },
    });
  }

  return options;
}

export async function applySessionChoice(session_id: string, data: SessionData): Promise<void> {
  if (!user_data) return;
  await writeUserDataToFile();
  user_data.session_id = session_id;
  user_data.session_committed = true;
  user_data.categories = [...data.categories];
  user_data.history = [...data.history];
  socket.disconnect();
  socket.connect();
}

export async function startNewSession(): Promise<void> {
  if (!user_data) return;
  await writeUserDataToFile();
  user_data.session_id = crypto.randomUUID();
  user_data.session_committed = false;
  user_data.categories = [];
  user_data.history = [];
  socket.disconnect();
  socket.connect();
}
