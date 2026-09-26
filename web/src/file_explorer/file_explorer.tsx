import { useState } from "react";
import type { StorageEntry } from "../storage/storage_socket.js";
import { useDirectory, useSessionFolder } from "../storage/storage_store.js";
import { formatSize } from "./file_tree_model.js";
import "../styles/file_browser.css";

export interface FileExplorerProps {
  selected_path: string | null;
  on_select: (path: string) => void;
}

export function FileExplorer({ selected_path, on_select }: FileExplorerProps) {
  const folder = useSessionFolder();

  return (
    <div className="file-explorer">
      <div className="explorer-header" title={folder ?? undefined}>
        {folder ?? "workspace unavailable"}
      </div>
      <div className="explorer-tree">
        <DirectoryNode
          path=""
          name={folder ?? "workspace"}
          depth={0}
          default_expanded
          selected_path={selected_path}
          on_select={on_select}
        />
      </div>
    </div>
  );
}

interface DirectoryNodeProps {
  path: string;
  name: string;
  depth: number;
  default_expanded?: boolean;
  selected_path: string | null;
  on_select: (path: string) => void;
}

function DirectoryNode({
  path,
  name,
  depth,
  default_expanded = false,
  selected_path,
  on_select,
}: DirectoryNodeProps) {
  const [expanded, set_expanded] = useState(default_expanded);

  return (
    <div className="tree-node">
      <button
        type="button"
        className="file-row folder"
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={() => set_expanded((value) => !value)}
      >
        <span className="caret">{expanded ? "▾" : "▸"}</span>
        <span className="file-name">{name}</span>
      </button>
      {expanded ? (
        <DirectoryChildren
          path={path}
          depth={depth}
          selected_path={selected_path}
          on_select={on_select}
        />
      ) : null}
    </div>
  );
}

interface DirectoryChildrenProps {
  path: string;
  depth: number;
  selected_path: string | null;
  on_select: (path: string) => void;
}

function DirectoryChildren({ path, depth, selected_path, on_select }: DirectoryChildrenProps) {
  const { entries, error } = useDirectory(path);

  if (error) {
    return (
      <div className="explorer-error" style={{ paddingLeft: 8 + (depth + 1) * 12 }}>
        {error}
      </div>
    );
  }

  return (
    <div className="tree-children">
      {entries.map((entry) =>
        entry.kind === "folder" ? (
          <DirectoryNode
            key={entry.path}
            path={entry.path}
            name={entry.name}
            depth={depth + 1}
            selected_path={selected_path}
            on_select={on_select}
          />
        ) : (
          <FileRow
            key={entry.path}
            entry={entry}
            depth={depth + 1}
            selected={selected_path === entry.path}
            on_select={on_select}
          />
        ),
      )}
    </div>
  );
}

interface FileRowProps {
  entry: StorageEntry;
  depth: number;
  selected: boolean;
  on_select: (path: string) => void;
}

function FileRow({ entry, depth, selected, on_select }: FileRowProps) {
  return (
    <button
      type="button"
      className={`file-row file${selected ? " selected" : ""}`}
      style={{ paddingLeft: 8 + depth * 12 + 12 }}
      title={entry.path}
      onClick={() => on_select(entry.path)}
    >
      <span className="file-name">{entry.name}</span>
      <span className="file-size">{formatSize(entry.size)}</span>
    </button>
  );
}
