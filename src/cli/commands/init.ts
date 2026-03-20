import { basename } from "node:path";
import type { Argv } from "yargs";
import { initProject } from "../../core/init.js";
import { ProjectLoaderError } from "../../core/errors.js";
import { ExitCode, formatInitResult, formatError } from "../../core/output-formatter.js";
import { discoverProjectRoot } from "../../core/project-root-discovery.js";
import { addFormatOption, parseOutputFormat, CliValidationError } from "../helpers.js";
import { writeOutput } from "../run.js";

export function registerInitCommand(yargs: Argv): Argv {
  return yargs.command(
    "init",
    "Scaffold a new .story/ project",
    (y) =>
      addFormatOption(
        y
          .option("name", {
            type: "string",
            describe: "Project name (defaults to current directory name)",
          })
          .option("force", {
            type: "boolean",
            default: false,
            describe: "Overwrite existing config and roadmap",
          })
          .option("type", {
            type: "string",
            describe: "Project type (e.g. npm, macapp)",
          })
          .option("language", {
            type: "string",
            describe: "Primary language",
          }),
      ),
    async (argv) => {
      const format = parseOutputFormat(argv.format);
      try {
        // Derive name from cwd if not provided
        const name = (argv.name as string | undefined) ?? basename(process.cwd());
        if (!name) {
          throw new CliValidationError(
            "invalid_input",
            "Could not derive project name from current directory. Use --name to specify.",
          );
        }

        // Warn if parent project exists (stderr so stdout stays clean for --format json)
        const parentRoot = discoverProjectRoot();
        if (parentRoot && parentRoot !== process.cwd()) {
          process.stderr.write(
            `Warning: existing .story/ project found at ${parentRoot}. Creating nested project.\n`,
          );
        }

        const result = await initProject(process.cwd(), {
          name,
          force: argv.force,
          type: argv.type as string | undefined,
          language: argv.language as string | undefined,
        });
        writeOutput(formatInitResult(result, format));
        process.exitCode = ExitCode.OK;
      } catch (err: unknown) {
        if (err instanceof ProjectLoaderError) {
          writeOutput(formatError(err.code, err.message, format));
          process.exitCode = ExitCode.USER_ERROR;
          return;
        }
        if (err instanceof CliValidationError) {
          writeOutput(formatError(err.code, err.message, format));
          process.exitCode = ExitCode.USER_ERROR;
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        writeOutput(formatError("io_error", message, format));
        process.exitCode = ExitCode.USER_ERROR;
      }
    },
  );
}
