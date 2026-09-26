import type { ToolRequestDTO } from "../dto/wire.js";
import { getOptionalString, getString } from "./args.js";
import { editTool, listDirTool, readFileTool, writeTool } from "./file_ops.js";
import { globTool, grepTool } from "./search_ops.js";
import { shellTool } from "./shell.js";

export async function executeToolRequest(req: ToolRequestDTO): Promise<string> {
  const { tool, args } = req;

  try {
    switch (tool) {
      case "write":
        return writeTool(
          getString(args, "file_path"),
          getString(args, "content"),
          getString(args, "mode", "overwrite"),
        );
      case "edit":
        return editTool(
          getString(args, "file_path"),
          getString(args, "old_string"),
          getString(args, "new_string"),
        );
      case "readFile":
        return readFileTool(
          getString(args, "file_path"),
          Number(args.offset ?? 1),
          Number(args.limit ?? 500),
        );
      case "listDir":
        return listDirTool(getString(args, "directory_path"));
      case "grep":
        return grepTool(
          getString(args, "pattern"),
          getString(args, "path", "."),
          getOptionalString(args, "file_glob"),
        );
      case "glob":
        return globTool(getString(args, "pattern"), getString(args, "path", "."));
      case "terminalCommand":
        return await shellTool(getString(args, "bash_command"));
      default:
        return `Error: unknown tool '${tool}'`;
    }
  } catch (error) {
    return `Error: ${error}`;
  }
}
