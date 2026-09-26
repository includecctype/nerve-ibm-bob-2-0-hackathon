import chalk from "chalk";

type MutableChalk = Record<string, unknown>;

// ink colorizes hex colors through chalk.hex/chalk.bgHex; ink-web's browser
// chalk shim only implements the named codes, so add the hex forms it lacks.
const shim = chalk as unknown as MutableChalk;

function parseHex(hex: string): [number, number, number] | null {
  const value = hex.replace(/^#/, "");
  const channel = (part: string) => Number.parseInt(part.length === 1 ? part + part : part, 16);
  if (value.length === 3) {
    return [channel(value[0]), channel(value[1]), channel(value[2])];
  }
  if (value.length === 6) {
    return [channel(value.slice(0, 2)), channel(value.slice(2, 4)), channel(value.slice(4, 6))];
  }
  return null;
}

if (typeof shim.bgHex !== "function") {
  shim.hex = (hex: string) => (str: string) => {
    const rgb = parseHex(hex);
    if (!rgb) return str;
    return `\u001b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m${str}\u001b[39m`;
  };
  shim.bgHex = (hex: string) => (str: string) => {
    const rgb = parseHex(hex);
    if (!rgb) return str;
    return `\u001b[48;2;${rgb[0]};${rgb[1]};${rgb[2]}m${str}\u001b[49m`;
  };
}
