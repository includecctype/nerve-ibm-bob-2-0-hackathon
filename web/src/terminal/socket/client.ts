import { io, type Socket } from "socket.io-client";
import { user_data } from "../session/user_data";

export const BACKEND_URL =
  import.meta.env.NERVE_BACKEND_URL ??
  import.meta.env.VITE_NERVE_BACKEND_URL ??
  "http://localhost:8000";

// The socket instance is created once and reused across reconnects; socket.io
// re-runs `auth` on every (re)connect, so fresh credentials and session state
// are always sent.
export const socket: Socket = io(BACKEND_URL, {
  autoConnect: false,
  auth: (cb) =>
    cb({
      client_kind: "web",
      api_keys: user_data?.api_keys ?? {},
      main_agent_id: user_data?.main_agent_id ?? 1,
      categories: user_data?.categories ?? [],
      history: user_data?.history ?? [],
      api_key: user_data ? (user_data.api_keys[user_data.main_agent_id] ?? "") : "",
    }),
});

const socket_observers = new Set<(socket: Socket) => void>();

export function getSocket(): Socket {
  return socket;
}

export function observeSocket(observer: (socket: Socket) => void): () => void {
  socket_observers.add(observer);
  observer(socket);
  return () => {
    socket_observers.delete(observer);
  };
}

export function connectSocket(): void {
  if (socket.connected) {
    socket.disconnect();
  }
  socket.connect();
}

export function disconnectSocket(): void {
  socket.disconnect();
}
