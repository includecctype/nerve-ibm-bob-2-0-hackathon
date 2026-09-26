import react from "@vitejs/plugin-react";
import { inkWebPlugin } from "ink-web/vite";
import { defineConfig } from "vite";

// The ink-web plugin aliases Node.js built-ins to browser shims so the real
// `ink` package (and everything that imports it) can run in the browser. Both
// entries keep a single React and a single ink instance.
export default defineConfig({
  base: "./",
  plugins: [react(), inkWebPlugin()],
  resolve: {
    dedupe: ["react", "react-dom", "react-reconciler", "scheduler", "ink"],
  },
});
