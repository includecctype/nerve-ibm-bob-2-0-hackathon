export type CommandEntry = {
  name: string;
  description: string;
};

export const COMMANDS: CommandEntry[] = [
  { name: "/model", description: "choose a model" },
  { name: "/key", description: "change a model API key" },
  { name: "/session", description: "continue a saved session" },
  { name: "/sample", description: "run a sample demo" },
  { name: "/exit", description: "save and quit" },
  { name: "/restart", description: "restart UI and connection" },
];

export function filterCommands(input: string): CommandEntry[] {
  if (!input.startsWith("/")) return [];
  return COMMANDS.filter((entry) => entry.name.startsWith(input));
}

export function isCommand(input: string, name: string): boolean {
  return input.trim() === name;
}

export function isSlashCommand(input: string): boolean {
  return input.trim().startsWith("/");
}
