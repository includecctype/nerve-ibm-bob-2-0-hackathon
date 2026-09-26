import { InkXterm } from "ink-web/core";
import { App } from "./terminal/app.js";
import "@xterm/xterm/css/xterm.css";

export function WebApp() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <InkXterm focus>
        <App />
      </InkXterm>
    </div>
  );
}
