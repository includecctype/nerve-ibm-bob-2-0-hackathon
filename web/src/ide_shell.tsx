import { useState } from "react";
import { FileExplorer } from "./file_explorer/file_explorer.js";
import { FileViewer } from "./file_viewer/file_viewer.js";
import { useSessionFolder } from "./storage/storage_store.js";
import { App } from "./terminal/app.js";
import { InkXterm } from "./terminal/xterm_host.js";
import "@xterm/xterm/css/xterm.css";
import "./styles/ide_shell.css";
import type { ITerminalOptions } from "@xterm/xterm";

const TERMINAL_OPTIONS: ITerminalOptions = {
  fontSize: 13,
  theme: {
    background: "#000000",
    foreground: "#00ff41",
    cursor: "#00ff41",
    cursorAccent: "#000000",
    selectionBackground: "#003b00",
    black: "#000000",
    red: "#ff3b3b",
    green: "#00ff41",
    yellow: "#ffcc00",
    blue: "#00b3ff",
    magenta: "#ff00ff",
    cyan: "#00ffcc",
    white: "#c8ffd4",
    brightBlack: "#3f8f4f",
    brightRed: "#ff6b6b",
    brightGreen: "#66ff99",
    brightYellow: "#ffe066",
    brightBlue: "#66ccff",
    brightMagenta: "#ff66ff",
    brightCyan: "#66ffe0",
    brightWhite: "#ffffff",
  },
};

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
        <section className="ide-pane ide-explorer" aria-label="File explorer">
          <FileExplorer selected_path={selected_path} on_select={setSelectedPath} />
        </section>
        <section className="ide-pane ide-viewer" aria-label="File viewer">
          <FileViewer path={selected_path} />
        </section>
        <section className="ide-pane ide-terminal" aria-label="Terminal">
          <InkXterm focus termOptions={TERMINAL_OPTIONS}>
            <App />
          </InkXterm>
        </section>
      </main>
    </div>
  );
}
