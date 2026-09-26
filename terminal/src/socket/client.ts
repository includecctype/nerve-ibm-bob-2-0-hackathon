import { io, type Socket } from "socket.io-client";
import { user_data } from "../session/user_data";

export const BACKEND_URL = process.env.NERVE_BACKEND_URL ?? "https://nerve-boq5.onrender.com";

export const socket: Socket = io(BACKEND_URL, {
  autoConnect: false,
  auth: (cb) =>
    cb(
      user_data
        ? {
            client_kind: "cli",
            api_keys: user_data.api_keys,
            main_agent_id: user_data.main_agent_id,
            categories: user_data.categories,
            history: user_data.history,
            api_key: user_data.api_keys[user_data.main_agent_id] ?? "",
          }
        : {},
    ),
});

export function connectSocket() {
  socket.connect();
}
