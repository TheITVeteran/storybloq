#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { ExitCode, formatError } from "../core/output-formatter.js";
import { writeOutput } from "./run.js";
import {
  registerInitCommand,
  registerStatusCommand,
  registerPhaseCommand,
  registerTicketCommand,
  registerIssueCommand,
  registerHandoverCommand,
  registerBlockerCommand,
  registerValidateCommand,
} from "./register.js";

// Version injected at build time by tsup define
const version = process.env.CLAUDESTORY_VERSION ?? "0.0.0-dev";

// Sentinel for errors already handled by .fail()
const HANDLED_ERROR = Symbol("HANDLED_ERROR");

// Sniff --format from raw argv for error formatting before yargs parses
const rawArgs = hideBin(process.argv);
function sniffFormat(args: string[]): "json" | "md" {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--format" && args[i + 1] === "json") return "json";
    if (args[i]?.startsWith("--format=") && args[i]!.slice("--format=".length) === "json") return "json";
  }
  return "md";
}
const errorFormat = sniffFormat(rawArgs);

let cli = yargs(rawArgs)
  .scriptName("claudestory")
  .version(version)
  .strict()
  .demandCommand(1, "Specify a command. Run with --help for available commands.")
  .help()
  .fail((msg, err) => {
    // .fail() is the single owner of yargs validation error output
    if (err) throw err; // Re-throw non-yargs errors for top-level catch
    // Yargs validation error (missing args, unknown command)
    writeOutput(formatError("invalid_input", msg ?? "Unknown error", errorFormat));
    process.exitCode = ExitCode.USER_ERROR;
    throw HANDLED_ERROR;
  });

cli = registerInitCommand(cli);
cli = registerStatusCommand(cli);
cli = registerPhaseCommand(cli);
cli = registerTicketCommand(cli);
cli = registerIssueCommand(cli);
cli = registerHandoverCommand(cli);
cli = registerBlockerCommand(cli);
cli = registerValidateCommand(cli);

// Top-level catch: ignore handled errors, catch unexpected ones
await cli.parseAsync().catch((err: unknown) => {
  if (err === HANDLED_ERROR) return;
  const message = err instanceof Error ? err.message : String(err);
  writeOutput(formatError("io_error", message, errorFormat));
  process.exitCode = ExitCode.USER_ERROR;
});
