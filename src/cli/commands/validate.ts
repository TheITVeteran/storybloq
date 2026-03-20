import { validateProject, mergeValidation } from "../../core/validation.js";
import { ExitCode, formatValidation } from "../../core/output-formatter.js";
import type { CommandContext, CommandResult } from "../types.js";

export function handleValidate(ctx: CommandContext): CommandResult {
  const baseResult = validateProject(ctx.state);
  const merged = mergeValidation(baseResult, ctx.warnings);
  return {
    output: formatValidation(merged, ctx.format),
    exitCode: merged.valid ? ExitCode.OK : ExitCode.VALIDATION_ERROR,
  };
}
