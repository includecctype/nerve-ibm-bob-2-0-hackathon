import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { inkWebPlugin } from "ink-web/vite";
import { defineConfig } from "vite";

// The ink-web plugin aliases Node.js built-ins to browser shims so the real
// `ink` package (and everything that imports it) can run in the browser. It
// does not cover `node:util`, which @inkjs/ui imports, so point that at our
// shim. Both entries keep a single React and a single ink instance.
const utilShim = fileURLToPath(new URL("./src/shims/util.ts", import.meta.url));

export default defineConfig({
  base: "./",
  envPrefix: ["VITE_", "NERVE_"],
  plugins: [react(), inkWebPlugin()],
  resolve: {
    alias: {
      "node:util": utilShim,
      util: utilShim,
    },
    dedupe: ["react", "react-dom", "react-reconciler", "scheduler", "ink"],
  },
});
