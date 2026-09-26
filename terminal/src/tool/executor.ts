import type { ToolRequestDTO } from "../dto/wire";
import { DEFAULT_READ_LIMIT } from "../systemconfig/limits";
import { asNumber, asOptionalString, asString } from "./args";
import { editTool, listDirTool, readFileTool, writeFileTool } from "./file_ops";
import { globTool, grepTool } from "./search_ops";
import { runTerminalCommand } from "./shell";

// Dispatch one forwarded tool call to its local implementation. Never throws:
// every outcome is a string the model can read, `Error:`-prefixed on failure.
export async function executeToolRequest(request: ToolRequestDTO): Promise<string> {
  const args = request.args ?? {};
  try {
    switch (request.tool) {
      case "write":
        return await writeFileTool(
          asString(args.file_path),
          asString(args.content),
          args.mode === undefined ? "overwrite" : asString(args.mode),
        );
      case "edit":
        return await editTool(
          asString(args.file_path),
          asString(args.old_string),
          asString(args.new_string),
        );
      case "readFile":
        return await readFileTool(
          asString(args.file_path),
          asNumber(args.offset, 1),
          asNumber(args.limit, DEFAULT_READ_LIMIT),
        );
      case "listDir":
        return await listDirTool(asString(args.directory_path));
      case "grep":
        return await grepTool(
          asString(args.pattern),
          asString(args.path) || ".",
          asOptionalString(args.file_glob),
        );
      case "glob":
        return await globTool(asString(args.pattern), asString(args.path) || ".");
      case "terminalCommand":
        return await runTerminalCommand(asString(args.bash_command));
      default:
        return `Error: unknown tool: ${request.tool}`;
    }
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}
