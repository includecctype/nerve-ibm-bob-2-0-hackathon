export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function asOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
