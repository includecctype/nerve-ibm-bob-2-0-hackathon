import { defineConfig } from "tsup";

const DEFAULT_BACKEND_URL =
  process.env.NERVE_BACKEND_URL || "https://nerve-ibm-bob-2-0-hackathon.onrender.com";

export default defineConfig({
  entry: ["src/app.tsx"],
  format: ["esm"],
  outDir: "dist",
  banner: {
    js: "#!/usr/bin/env node",
  },
  clean: true,
  external: ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "ink"],
  define: {
    NERVE_DEFAULT_BACKEND_URL: JSON.stringify(DEFAULT_BACKEND_URL),
  },
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
});
