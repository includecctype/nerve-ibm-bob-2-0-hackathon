import { useEffect } from "react";

export interface WheelEvent {
  direction: "up" | "down";
  column: number;
  row: number;
}

export interface MouseEvent {
  button: number;
  column: number;
  row: number;
}

// SGR mouse reporting arrives as: ESC [ < button ; column ; row M|m
// Ink strips the leading ESC before the string reaches `useInput`.
const MOUSE_PATTERN = /^\[<(\d+);(\d+);(\d+)[Mm]/;

const WHEEL_UP_BUTTON = 64;
const WHEEL_DOWN_BUTTON = 65;

export function parseMouseEvent(input: string): MouseEvent | null {
  const match = MOUSE_PATTERN.exec(input);
  if (!match) return null;
  return {
    button: Number(match[1]),
    column: Number(match[2]),
    row: Number(match[3]),
  };
}

export function parseWheelEvent(input: string): WheelEvent | null {
  const event = parseMouseEvent(input);
  if (!event) return null;
  if (event.button !== WHEEL_UP_BUTTON && event.button !== WHEEL_DOWN_BUTTON) {
    return null;
  }
  return {
    direction: event.button === WHEEL_UP_BUTTON ? "up" : "down",
    column: event.column,
    row: event.row,
  };
}

export function isMouseEvent(input: string): boolean {
  return parseMouseEvent(input) !== null;
}

/**
 * Turns on SGR mouse reporting so wheel events reach `useInput`, and restores
 * the terminal when the app unmounts.
 */
export function useMouseTracking(): void {
  useEffect(() => {
    if (!process.stdout.isTTY) return;
    process.stdout.write("\u001b[?1000h\u001b[?1006h");
    return () => {
      process.stdout.write("\u001b[?1000l\u001b[?1006l");
    };
  }, []);
}
