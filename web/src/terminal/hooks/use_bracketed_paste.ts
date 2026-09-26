import { useStdin, useStdout } from "ink";
import { useEffect } from "react";

const ESC = String.fromCharCode(27);
const PASTE_START = `${ESC}[200~`;
const PASTE_END = `${ESC}[201~`;
const ENABLE_PASTE = `${ESC}[?2004h`;
const DISABLE_PASTE = `${ESC}[?2004l`;

let paste_active = false;

export function isPasteActive(): boolean {
  return paste_active;
}

// Fallback when a marker is split across stdin reads: ink still delivers the
// CSI body as `[200~` / `[201~` to useInput handlers.
export function notePasteMarker(input: string): boolean {
  if (input === "[200~") {
    paste_active = true;
    return true;
  }
  if (input === "[201~") {
    paste_active = false;
    return true;
  }
  return false;
}

function normalizeChunk(data: string): string {
  let chunk = data;
  if (chunk.includes(PASTE_START)) {
    paste_active = true;
    chunk = chunk.split(PASTE_START).join("");
  }
  const was_pasting = paste_active;
  if (chunk.includes(PASTE_END)) {
    chunk = chunk.split(PASTE_END).join("");
    paste_active = false;
  }
  if (was_pasting) {
    chunk = chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  }
  return chunk;
}

/**
 * Enables terminal bracketed-paste mode and rewrites pasted chunks on Ink's
 * shared input emitter: paste markers are stripped and CR line endings become
 * LF, so a paste can never trigger the prompt box Enter-to-submit path.
 */
export function useBracketedPaste(): void {
  const { stdout } = useStdout();
  const { internal_eventEmitter } = useStdin();

  useEffect(() => {
    if (!internal_eventEmitter) {
      return;
    }

    stdout.write(ENABLE_PASTE);
    paste_active = false;

    const original_emit = internal_eventEmitter.emit.bind(internal_eventEmitter);
    const patched_emit = (event: string | symbol, ...args: unknown[]) => {
      if (event === "input" && typeof args[0] === "string") {
        const chunk = normalizeChunk(args[0]);
        if (chunk.length === 0) {
          return true;
        }
        return original_emit(event, chunk, ...args.slice(1));
      }
      return original_emit(event, ...args);
    };
    internal_eventEmitter.emit = patched_emit;

    return () => {
      stdout.write(DISABLE_PASTE);
      internal_eventEmitter.emit = original_emit;
      paste_active = false;
    };
  }, [internal_eventEmitter, stdout]);
}
