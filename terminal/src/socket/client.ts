import { type Socket, io } from "socket.io-client";
import { getUserData } from "../session/user_data.js";

const NERVE_BACKEND_URL = process.env.NERVE_BACKEND_URL ?? "https://nerve-boq5.onrender.com";

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

  const data = getUserData();
  const api_key = data.api_keys[String(data.main_agent_id)] ?? "";

  socket_instance = io(NERVE_BACKEND_URL, {
    auth: {
      api_key,
      main_agent_id: data.main_agent_id,
      categories: data.categories,
      history: data.history,
    },
    transports: ["websocket"],
  });

  return socket_instance;
}

export function disconnectSocket(): void {
  socket_instance?.disconnect();
  socket_instance = null;
}
