import { useStdin, useStdout } from "ink";
import { useEffect, useRef } from "react";

const ESC = String.fromCharCode(27);
const MOUSE_PREFIX = `${ESC}[<`;

function parseMouseSgr(input: string): { button: number; x: number; y: number } | null {
  if (!input.startsWith(MOUSE_PREFIX)) {
    return null;
  }
  const last = input.at(-1);
  if (last !== "M" && last !== "m") {
    return null;
  }
  const parts = input.slice(MOUSE_PREFIX.length, -1).split(";");
  if (parts.length !== 3) {
    return null;
  }
  const button = Number(parts[0]);
  const x = Number(parts[1]);
  const y = Number(parts[2]);
  if (!Number.isFinite(button) || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return { button, x, y };
}

const ENABLE_MOUSE = `${ESC}[?1000h${ESC}[?1006h`;
const DISABLE_MOUSE = `${ESC}[?1000l${ESC}[?1006l`;

export type WheelDirection = "up" | "down";

/**
 * Enables terminal SGR mouse reporting and reports wheel events.
 * Swallows mouse sequences on Ink's shared input emitter so TextInput never inserts them.
 */
export function useMouseWheel(
  enabled: boolean,
  on_wheel: (direction: WheelDirection, x: number, y: number) => void,
): void {
  const { stdout } = useStdout();
  const { internal_eventEmitter } = useStdin();
  const on_wheel_ref = useRef(on_wheel);
  on_wheel_ref.current = on_wheel;

  useEffect(() => {
    if (!enabled || !internal_eventEmitter) {
      return;
    }

    stdout.write(ENABLE_MOUSE);

    const original_emit = internal_eventEmitter.emit.bind(internal_eventEmitter);
    const patched_emit = (event: string | symbol, ...args: unknown[]) => {
      if (event === "input" && typeof args[0] === "string") {
        const match = parseMouseSgr(args[0]);
        if (match) {
          if ((match.button & 64) !== 0) {
            const direction: WheelDirection = (match.button & 1) === 0 ? "up" : "down";
            on_wheel_ref.current(direction, match.x, match.y);
          }
          return true;
        }
      }
      return original_emit(event, ...args);
    };
    internal_eventEmitter.emit = patched_emit;

    return () => {
      stdout.write(DISABLE_MOUSE);
      internal_eventEmitter.emit = original_emit;
    };
  }, [enabled, internal_eventEmitter, stdout]);
}
