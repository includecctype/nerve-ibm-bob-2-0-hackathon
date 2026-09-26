import { useState } from "react";
import { InkXterm } from "ink-web/core";
import { FileExplorer } from "./file_explorer/file_explorer.js";
import { FileViewer } from "./file_viewer/file_viewer.js";
import { useSessionFolder } from "./storage/storage_store.js";
import { App } from "./terminal/app.js";
import "@xterm/xterm/css/xterm.css";
import "./styles/ide_shell.css";

export function IdeShell() {
  const folder = useSessionFolder();
  const [selected_path, setSelectedPath] = useState<string | null>(null);

  return (
    <div className="ide-shell">
      <header className="ide-header">
        <span className="ide-brand">NERVE</span>
        <span className="ide-session" title={folder ?? undefined}>
          {folder ?? "connecting…"}
        </span>
      </header>
      <main className="ide-body">
        <section className="ide-pane ide-terminal" aria-label="Terminal">
          <InkXterm focus>
            <App />
          </InkXterm>
        </section>
        <section className="ide-pane ide-explorer" aria-label="File explorer">
          <FileExplorer selected_path={selected_path} on_select={setSelectedPath} />
        </section>
        <section className="ide-pane ide-viewer" aria-label="File viewer">
          <FileViewer path={selected_path} />
        </section>
      </main>
    </div>
  );
}
