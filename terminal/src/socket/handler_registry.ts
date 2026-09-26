import type { Socket } from "socket.io-client";
import { type ListenerCallbacks, registerListeners } from "./listener.js";

export function attachHandlers(socket: Socket, callbacks: ListenerCallbacks): void {
  registerListeners(socket, callbacks);
}
