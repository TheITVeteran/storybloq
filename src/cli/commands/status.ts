import { formatStatus } from "../../core/output-formatter.js";
import type { CommandContext, CommandResult } from "../types.js";

export function handleStatus(ctx: CommandContext): CommandResult {
  return { output: formatStatus(ctx.state, ctx.format) };
}
