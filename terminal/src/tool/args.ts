/**
 * Utility helpers for parsing tool arguments from the wire format.
 */

export function getString(args: Record<string, unknown>, key: string, fallback = ""): string {
  return args[key] !== undefined ? String(args[key]) : fallback;
}

export function getNumber(args: Record<string, unknown>, key: string, fallback = 0): number {
  return args[key] !== undefined ? Number(args[key]) : fallback;
}

export function getOptionalString(args: Record<string, unknown>, key: string): string | null {
  return args[key] !== undefined ? String(args[key]) : null;
}
