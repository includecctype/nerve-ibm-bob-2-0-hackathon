import { useEffect, useRef, useState } from "react";
import {
  type StorageContent,
  type StorageEntry,
  getSessionFolder,
  listDirectory,
  onSessionFolder,
  onStorageChange,
  readFileContent,
} from "./storage_socket.js";

export function useSessionFolder(): string | null {
  const [folder, setFolder] = useState<string | null>(getSessionFolder);
  useEffect(() => onSessionFolder((next) => setFolder(next || null)), []);
  return folder;
}

export interface DirectoryState {
  entries: StorageEntry[];
  error: string | null;
  refresh: () => void;
}

export function useDirectory(path: string): DirectoryState {
  const [entries, setEntries] = useState<StorageEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load_ref = useRef<() => void>(() => {});

  useEffect(() => {
    let active = true;
    const load = () => {
      listDirectory(path)
        .then((result) => {
          if (!active) return;
          setEntries(result);
          setError(null);
        })
        .catch((cause: unknown) => {
          if (!active) return;
          setError(cause instanceof Error ? cause.message : String(cause));
        });
    };
    load_ref.current = load;
    load();
    const unsubscribe = onStorageChange(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [path]);

  return { entries, error, refresh: () => load_ref.current() };
}

export interface FileState {
  content: string | null;
  truncated: boolean;
  error: string | null;
}

export function useFileContent(path: string | null): FileState {
  const [state, setState] = useState<FileState>({
    content: null,
    truncated: false,
    error: null,
  });

  useEffect(() => {
    if (!path) {
      setState({ content: null, truncated: false, error: null });
      return;
    }
    let active = true;
    readFileContent(path)
      .then((result: StorageContent) => {
        if (!active) return;
        setState({ content: result.content, truncated: result.truncated, error: null });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setState({
          content: null,
          truncated: false,
          error: cause instanceof Error ? cause.message : String(cause),
        });
      });
    return () => {
      active = false;
    };
  }, [path]);

  return state;
}
