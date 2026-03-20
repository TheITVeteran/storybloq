import { readHandover } from "../../core/handover-parser.js";
import {
  formatHandoverList,
  formatHandoverContent,
  formatError,
  ExitCode,
} from "../../core/output-formatter.js";
import { parseHandoverFilename } from "../helpers.js";
import type { CommandContext, CommandResult } from "../types.js";

export function handleHandoverList(ctx: CommandContext): CommandResult {
  return { output: formatHandoverList(ctx.state.handoverFilenames, ctx.format) };
}

export async function handleHandoverLatest(ctx: CommandContext): Promise<CommandResult> {
  if (ctx.state.handoverFilenames.length === 0) {
    return {
      output: formatError("not_found", "No handovers found", ctx.format),
      exitCode: ExitCode.USER_ERROR,
      errorCode: "not_found",
    };
  }

  const filename = ctx.state.handoverFilenames[0]!;
  // Validate filename safety (though this comes from the filesystem, not user input)
  await parseHandoverFilename(filename, ctx.handoversDir);

  try {
    const content = await readHandover(ctx.handoversDir, filename);
    return { output: formatHandoverContent(filename, content, ctx.format) };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        output: formatError("not_found", `Handover file not found: ${filename}`, ctx.format),
        exitCode: ExitCode.USER_ERROR,
        errorCode: "not_found",
      };
    }
    return {
      output: formatError("io_error", `Cannot read handover: ${(err as Error).message}`, ctx.format),
      exitCode: ExitCode.USER_ERROR,
      errorCode: "io_error",
    };
  }
}

export async function handleHandoverGet(
  filename: string,
  ctx: CommandContext,
): Promise<CommandResult> {
  await parseHandoverFilename(filename, ctx.handoversDir);

  try {
    const content = await readHandover(ctx.handoversDir, filename);
    return { output: formatHandoverContent(filename, content, ctx.format) };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        output: formatError("not_found", `Handover not found: ${filename}`, ctx.format),
        exitCode: ExitCode.USER_ERROR,
        errorCode: "not_found",
      };
    }
    return {
      output: formatError("io_error", `Cannot read handover: ${(err as Error).message}`, ctx.format),
      exitCode: ExitCode.USER_ERROR,
      errorCode: "io_error",
    };
  }
}
