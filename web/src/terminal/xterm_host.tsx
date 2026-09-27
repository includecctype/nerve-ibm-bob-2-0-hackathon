import { FitAddon } from "@xterm/addon-fit";
import { type ITerminalOptions, Terminal } from "@xterm/xterm";
import { render } from "ink";
import type React from "react";
import { useEffect, useRef } from "react";
import { Readable, Writable } from "node:stream";

const CURSOR_HIDE = "\x1b[?25l";
const CLEAR_TERMINAL = "\x1b[2J\x1b[3J\x1b[H";
const CHAR_WIDTH = 8;
const CHAR_HEIGHT = 15;

// Ink's unmount path relies on setImmediate, which browsers do not provide.
const global_with_immediate = globalThis as {
  setImmediate?: (fn: (...args: unknown[]) => void, ...args: unknown[]) => void;
};
if (typeof global_with_immediate.setImmediate === "undefined") {
  global_with_immediate.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}

interface MountOptions {
  focus?: boolean;
  termOptions?: ITerminalOptions;
  onReady?: () => void;
}

interface InkMount {
  rerender: (element: React.ReactElement) => void;
  unmount: () => void;
}

function createStdout(term: Terminal): NodeJS.WriteStream {
  const base = new Writable();
  (base as { write: (chunk: unknown, encoding?: unknown, cb?: unknown) => boolean }).write = (
    chunk,
    encoding,
    cb,
  ) => {
    const text = typeof chunk === "string" ? chunk : String(chunk);
    if (text.length > 0) {
      // Unlike ink-web's xterm host, write the chunk verbatim: Ink's full-screen
      // clear/erase sequences must reach xterm so redraws replace the old frame.
      term.write(text);
    }
    if (typeof encoding === "function") (encoding as () => void)();
    else if (typeof cb === "function") (cb as () => void)();
    return true;
  };
  return Object.assign(base, {
    columns: term.cols,
    rows: term.rows,
    isTTY: true,
    writable: true,
    setDefaultEncoding: () => base,
    cork: () => undefined,
    uncork: () => undefined,
  }) as unknown as NodeJS.WriteStream;
}

function createStdin(term: Terminal): NodeJS.ReadStream {
  const base = new Readable();
  const buffer: string[] = [];
  const stdin = Object.assign(base, {
    columns: term.cols,
    rows: term.rows,
    isTTY: true,
    setEncoding: () => undefined,
    setRawMode: () => undefined,
    resume: () => undefined,
    pause: () => undefined,
    ref: () => undefined,
    unref: () => undefined,
    read: () => (buffer.length > 0 ? buffer.shift() : null),
  }) as unknown as NodeJS.ReadStream;
  term.onData((data) => {
    buffer.push(data);
    (stdin as unknown as { emit: (event: string) => void }).emit("readable");
  });
  return stdin;
}

function mountInk(
  element: React.ReactElement,
  container: HTMLElement,
  options: MountOptions,
): InkMount {
  const initial_cols = Math.floor(container.clientWidth / CHAR_WIDTH) || 80;
  const initial_rows = Math.floor(container.clientHeight / CHAR_HEIGHT) || 24;

  const term = new Terminal({
    convertEol: true,
    disableStdin: false,
    cols: initial_cols,
    rows: initial_rows,
    ...options.termOptions,
  });
  const fit_addon = new FitAddon();
  term.open(container);
  term.loadAddon(fit_addon);
  term.write(CURSOR_HIDE);

  if (options.focus !== false) {
    setTimeout(() => {
      try {
        term.focus();
      } catch {
        // xterm can throw if the renderer is not ready yet
      }
    }, 100);
  }

  const stdout = createStdout(term);
  const stdin = createStdin(term);

  const updateStreamsSize = () => {
    const columns = term.cols;
    const rows = term.rows;
    (stdout as unknown as { columns: number; rows: number }).columns = columns;
    (stdout as unknown as { columns: number; rows: number }).rows = rows;
    (stdin as unknown as { columns: number; rows: number }).columns = columns;
    (stdin as unknown as { columns: number; rows: number }).rows = rows;
    (stdout as unknown as { emit: (event: string) => void }).emit("resize");
  };
  updateStreamsSize();

  let instance: ReturnType<typeof render> | null = null;
  let disposed = false;
  void Promise.resolve().then(() => {
    if (disposed) return;
    instance = render(element, { stdout, stderr: stdout, stdin, patchConsole: false });
  });

  const resize = () => {
    try {
      fit_addon.fit();
      const columns = term.cols;
      const rows = term.rows;
      const previous_columns = (stdout as unknown as { columns: number }).columns;
      const previous_rows = (stdout as unknown as { rows: number }).rows;
      if (columns === previous_columns && rows === previous_rows) return;
      if (columns < previous_columns) {
        term.write(CLEAR_TERMINAL);
      }
      updateStreamsSize();
    } catch {
      // fit() can throw before the renderer is ready; the ResizeObserver retries
    }
  };

  const resize_observer = new ResizeObserver(() => resize());
  resize_observer.observe(container);
  const on_window_resize = () => resize();
  window.addEventListener("resize", on_window_resize);
  const ready_timer = setTimeout(() => {
    resize();
    options.onReady?.();
  }, 200);

  return {
    rerender: (next: React.ReactElement) => {
      instance?.rerender(next);
    },
    unmount: () => {
      disposed = true;
      clearTimeout(ready_timer);
      resize_observer.disconnect();
      window.removeEventListener("resize", on_window_resize);
      instance?.unmount();
      term.dispose();
    },
  };
}

interface InkXtermProps {
  className?: string;
  focus?: boolean;
  termOptions?: ITerminalOptions;
  children: React.ReactElement;
  onReady?: () => void;
}

export function InkXterm({ className = "", focus, termOptions, children, onReady }: InkXtermProps) {
  const container_ref = useRef<HTMLDivElement | null>(null);
  const mount_ref = useRef<InkMount | null>(null);
  const initialized_ref = useRef(false);
  const children_ref = useRef(children);
  children_ref.current = children;

  useEffect(() => {
    const container = container_ref.current;
    if (!container) return;

    let resize_observer: ResizeObserver | null = null;
    let animation_frame = 0;

    const initialize = () => {
      if (initialized_ref.current) return;
      if (container.clientWidth === 0 || container.clientHeight === 0) return;
      initialized_ref.current = true;
      mount_ref.current = mountInk(children_ref.current, container, {
        focus,
        termOptions,
        onReady,
      });
    };

    animation_frame = requestAnimationFrame(() => {
      initialize();
      if (!initialized_ref.current) {
        resize_observer = new ResizeObserver(() => {
          initialize();
          if (initialized_ref.current && resize_observer) {
            resize_observer.disconnect();
          }
        });
        resize_observer.observe(container);
      }
    });

    return () => {
      cancelAnimationFrame(animation_frame);
      resize_observer?.disconnect();
      initialized_ref.current = false;
      const mount = mount_ref.current;
      mount_ref.current = null;
      mount?.unmount();
    };
  }, [focus, termOptions, onReady]);

  useEffect(() => {
    mount_ref.current?.rerender(children);
  }, [children]);

  return (
    <div className={className} ref={container_ref} style={{ width: "100%", height: "100%" }} />
  );
}
