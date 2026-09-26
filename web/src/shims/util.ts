// Browser shim for the parts of Node's `util` that bundled dependencies use
// (`@inkjs/ui` imports isDeepStrictEqual). Vite externalizes node:util by
// default, so the Vite config aliases it here.

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isDeepStrictEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!isObject(a) || !isObject(b)) return false;

  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (a instanceof RegExp || b instanceof RegExp) {
    return a instanceof RegExp && b instanceof RegExp && String(a) === String(b);
  }
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map) || !(b instanceof Map) || a.size !== b.size) return false;
    for (const [key, value] of a) {
      if (!b.has(key) || !isDeepStrictEqual(value, b.get(key))) return false;
    }
    return true;
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set) || !(b instanceof Set) || a.size !== b.size) return false;
    for (const value of a) {
      if (!b.has(value)) return false;
    }
    return true;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => isDeepStrictEqual(item, b[index]));
  }

  const a_keys = Object.keys(a);
  const b_keys = Object.keys(b);
  if (a_keys.length !== b_keys.length) return false;
  return a_keys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      isDeepStrictEqual(a[key], (b as Record<string, unknown>)[key]),
  );
}

export function inspect(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export function format(format_string: string, ...args: unknown[]): string {
  let index = 0;
  return format_string.replace(/%[sdifjoO%]/g, (token) => {
    if (token === "%%") return "%";
    const value = args[index];
    index += 1;
    if (value === undefined) return token;
    if (token === "%j") {
      try {
        return JSON.stringify(value);
      } catch {
        return "[Circular]";
      }
    }
    if (token === "%o" || token === "%O") return inspect(value);
    return String(value);
  });
}

export function formatWithOptions(
  _options: unknown,
  format_string: string,
  ...args: unknown[]
): string {
  return format(format_string, ...args);
}

export function promisify(
  fn: (...args: unknown[]) => unknown,
): (...args: unknown[]) => Promise<unknown> {
  return (...args) =>
    new Promise((resolve, reject) => {
      fn(...args, (error: unknown, value: unknown) => (error ? reject(error) : resolve(value)));
    });
}

const ANSI_ESCAPE_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

export function stripVTControlCharacters(text: string): string {
  return text.replace(ANSI_ESCAPE_PATTERN, "");
}
