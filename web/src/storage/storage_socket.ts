import type { Socket } from "socket.io-client";
import { getSocket, observeSocket } from "../terminal/socket/client.js";

export interface StorageEntry {
  name: string;
  path: string;
  kind: "file" | "folder";
  size: number;
  updated_at: string;
}

export interface StorageChange {
  op: string;
  path: string;
}

export interface StorageContent {
  content: string;
  truncated: boolean;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

const pending = new Map<string, Pending>();
const change_listeners = new Set<(change: StorageChange) => void>();
const session_listeners = new Set<(folder: string) => void>();
let session_folder: string | null = null;
let attached: Socket | null = null;

const REQUEST_TIMEOUT_MS = 30_000;

function settle(request_id: string, resolve: (entry: Pending) => void): void {
  const entry = pending.get(request_id);
  if (!entry) return;
  pending.delete(request_id);
  resolve(entry);
}

function attach(socket: Socket): void {
  if (attached === socket) return;
  attached = socket;

  socket.on("storage_session", (payload: { folder?: string }) => {
    session_folder = payload?.folder ?? null;
    for (const listener of session_listeners) listener(session_folder ?? "");
    // A (re)connect can land after a pane already tried to load, so nudge every
    // directory to re-list once the session is available.
    for (const listener of change_listeners) listener({ op: "refresh", path: "" });
  });

  socket.on("storage_listing", (payload: { request_id: string; entries: StorageEntry[] }) => {
    settle(payload.request_id, (entry) => entry.resolve(payload.entries));
  });

  socket.on("storage_content", (payload: { request_id: string } & StorageContent) => {
    settle(payload.request_id, (entry) =>
      entry.resolve({ content: payload.content, truncated: payload.truncated }),
    );
  });

  socket.on("storage_result", (payload: { request_id: string }) => {
    settle(payload.request_id, (entry) => entry.resolve(undefined));
  });

  socket.on("storage_error", (payload: { request_id?: string; message?: string }) => {
    const request_id = payload?.request_id ?? "";
    const entry = pending.get(request_id);
    if (!entry) return;
    pending.delete(request_id);
    entry.reject(new Error(payload?.message ?? "storage error"));
  });

  socket.on("storage_change", (payload: StorageChange) => {
    for (const listener of change_listeners) listener(payload);
  });
}

function request<T>(event: string, payload: Record<string, unknown>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const request_id = crypto.randomUUID();
    const timeout = setTimeout(() => {
      pending.delete(request_id);
      reject(new Error(`storage request timed out: ${event}`));
    }, REQUEST_TIMEOUT_MS);

    pending.set(request_id, {
      resolve: (value) => {
        clearTimeout(timeout);
        (resolve as (value: unknown) => void)(value);
      },
      reject: (reason) => {
        clearTimeout(timeout);
        reject(reason);
      },
    });

    const send = (socket: Socket) => {
      attach(socket);
      socket.emit(event, { request_id, ...payload });
    };

    // Panes mount before the terminal owns a socket, so wait for the first one
    // instead of failing the request outright.
    let socket: Socket | null = null;
    try {
      socket = getSocket();
    } catch {
      socket = null;
    }
    if (socket) {
      send(socket);
      return;
    }

    let unsubscribe: (() => void) | null = null;
    unsubscribe = observeSocket((next) => {
      unsubscribe?.();
      send(next);
    });
  });
}

export function getSessionFolder(): string | null {
  return session_folder;
}

export function onSessionFolder(listener: (folder: string) => void): () => void {
  session_listeners.add(listener);
  if (session_folder) listener(session_folder);
  return () => {
    session_listeners.delete(listener);
  };
}

export function onStorageChange(listener: (change: StorageChange) => void): () => void {
  change_listeners.add(listener);
  return () => {
    change_listeners.delete(listener);
  };
}

export function listDirectory(path: string): Promise<StorageEntry[]> {
  return request<StorageEntry[]>("storage_list", { path });
}

export function readFileContent(path: string): Promise<StorageContent> {
  return request<StorageContent>("storage_read", { path });
}

export function writeFileContent(path: string, content: string): Promise<void> {
  return request<void>("storage_write", { path, content });
}

export function deleteStoragePath(path: string): Promise<void> {
  return request<void>("storage_delete", { path });
}

observeSocket(attach);
