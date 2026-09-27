// Replaced at build time by tsup `define` with the NERVE_BACKEND_URL set when
// bundling, or the reference deployment URL when it is unset. In `pnpm dev` the
// identifier is undeclared and callers fall back to the local backend.
declare const NERVE_DEFAULT_BACKEND_URL: string;
