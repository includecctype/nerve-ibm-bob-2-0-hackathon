import { type Socket, io } from "socket.io-client";
import { getUserData } from "../session/user_data.js";

const NERVE_BACKEND_URL =
  import.meta.env.VITE_NERVE_BACKEND_URL ?? "https://nerve-boq5.onrender.com";

let socket_instance: Socket | null = null;

export function getSocket(): Socket {
  if (!socket_instance) {
    throw new Error("Socket not initialized — call connectSocket() first");
  }
  return socket_instance;
}

export function connectSocket(): Socket {
  if (socket_instance) {
    socket_instance.disconnect();
  }

  socket_instance = io(NERVE_BACKEND_URL, {
    // Re-evaluated on every (re)connect so fresh credentials and session state
    // are always sent; the default transports keep the HTTP polling fallback.
    auth: (cb) => {
      const data = getUserData();
      cb({
        client_kind: "web",
        api_keys: data.api_keys,
        api_key: data.api_keys[String(data.main_agent_id)] ?? "",
        main_agent_id: data.main_agent_id,
        categories: data.categories,
        history: data.history,
      });
    },
  });

  return socket_instance;
}

export function disconnectSocket(): void {
  socket_instance?.disconnect();
  socket_instance = null;
}
