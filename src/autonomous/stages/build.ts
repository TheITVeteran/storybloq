import type { WorkflowStage, StageResult, StageAdvance, StageContext } from "./types.js";
import type { GuideReportInput } from "../session-types.js";

const MAX_BUILD_RETRIES = 2;

/**
 * BUILD stage - run the project build before FINALIZE (after CODE_REVIEW and VERIFY if enabled).
 * Conditional: skip() returns true when not enabled in recipe config.
 *
 * Catches bundler/build errors that typecheck and tests miss
 * (e.g., moduleResolution: "bundler" resolving .js->.ts imports
 * that the actual bundler rejects at build time).
 *
 * enter(): Instruction to run the build command.
 * report(): Parse exit code. Pass -> advance. Fail -> back(IMPLEMENT).
 */
export class BuildStage implements WorkflowStage {
  readonly id = "BUILD";

  skip(ctx: StageContext): boolean {
    const buildConfig = ctx.recipe.stages?.BUILD as Record<string, unknown> | undefined;
    return !buildConfig?.enabled;
  }

  async enter(ctx: StageContext): Promise<StageResult> {
    const buildConfig = ctx.recipe.stages?.BUILD as Record<string, unknown> | undefined;
    const command = (buildConfig?.command as string) ?? "npm run build";
    const retryCount = ctx.state.buildRetryCount ?? 0;

    return {
      instruction: [
        `# Build${retryCount > 0 ? ` (retry ${retryCount}/${MAX_BUILD_RETRIES})` : ""}`,
        "",
        `Run the build: \`${command}\``,
        "",
        "Report the results with:",
        '```json',
        `{ "sessionId": "${ctx.state.sessionId}", "action": "report", "report": { "completedAction": "build_done", "notes": "<exit code and summary>" } }`,
        '```',
        "",
        "Include the exit code (0 = pass, non-0 = fail) and any error output in notes.",
      ].join("\n"),
      reminders: ["Run the FULL build, not a partial or dev-mode build."],
      transitionedFrom: ctx.state.previousState ?? undefined,
    };
  }

  async report(ctx: StageContext, report: GuideReportInput): Promise<StageAdvance> {
    const notes = report.notes ?? "";
    const retryCount = ctx.state.buildRetryCount ?? 0;

    const exitCodeMatch = notes.match(/exit\s*(?:code[:\s]*)?\s*(\d+)/i);
    if (!exitCodeMatch) {
      const nextRetry = retryCount + 1;
      if (nextRetry > MAX_BUILD_RETRIES) {
        ctx.writeState({ buildRetryCount: 0 });
        ctx.appendEvent("build_parse_exhausted", { retryCount: nextRetry });
        return {
          action: "advance",
          result: {
            instruction: `Could not parse build exit code after ${MAX_BUILD_RETRIES} retries. Proceeding, but build status is unknown.`,
            reminders: ["Mention unknown build status in the commit message."],
          },
        };
      }
      ctx.writeState({ buildRetryCount: nextRetry });
      return { action: "retry", instruction: 'Could not parse exit code from notes. Include "exit code: 0" (or non-zero) in your notes.' };
    }
    const exitCode = parseInt(exitCodeMatch[1]!, 10);

    if (exitCode === 0) {
      ctx.writeState({ buildRetryCount: 0 });
      ctx.appendEvent("build_passed", { retryCount, notes: notes.slice(0, 200) });
      return { action: "advance" };
    }

    // Build failed - retry or advance
    if (retryCount < MAX_BUILD_RETRIES) {
      ctx.writeState({ buildRetryCount: retryCount + 1 });
      ctx.appendEvent("build_failed_retry", { retryCount: retryCount + 1, notes: notes.slice(0, 200) });
      return {
        action: "back",
        target: "IMPLEMENT",
        reason: `Build failed (attempt ${retryCount + 1}/${MAX_BUILD_RETRIES}). Fix the build errors.`,
      };
    }

    ctx.writeState({ buildRetryCount: 0 });
    ctx.appendEvent("build_failed_exhausted", { retryCount, notes: notes.slice(0, 200) });
    return {
      action: "advance",
      result: {
        instruction: [
          "# Build Failed - Proceeding",
          "",
          `Build failed after ${MAX_BUILD_RETRIES} retries. Proceeding but build errors remain.`,
          "",
          "Document the build failure in the commit message.",
        ].join("\n"),
        reminders: ["Mention build failure in the commit message."],
      },
    };
  }
}
