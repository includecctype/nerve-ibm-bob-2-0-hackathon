import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/app.tsx"],
  format: ["esm"],
  outDir: "dist",
  banner: {
    js: "#!/usr/bin/env node",
  },
  clean: true,
  external: ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "ink"],
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
});
