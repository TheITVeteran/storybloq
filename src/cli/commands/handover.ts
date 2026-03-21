import { readHandover } from "../../core/handover-parser.js";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  formatHandoverList,
  formatHandoverContent,
  formatHandoverCreateResult,
  formatError,
  ExitCode,
} from "../../core/output-formatter.js";
import {
  withProjectLock,
  atomicWrite,
  guardPath,
} from "../../core/project-loader.js";
import { parseHandoverFilename, todayISO, CliValidationError } from "../helpers.js";
import type { CommandContext, CommandResult } from "../types.js";
import type { OutputFormat } from "../../models/types.js";

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

// --- Create ---

/**
 * Normalizes a slug for handover filenames.
 * Trim, lowercase, whitespace→hyphen, strip non [a-z0-9-], max 60 chars.
 */
export function normalizeSlug(raw: string): string {
  let slug = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (slug.length > 60) slug = slug.slice(0, 60).replace(/-$/, "");
  if (!slug) {
    throw new CliValidationError(
      "invalid_input",
      `Slug is empty after normalization: "${raw}"`,
    );
  }
  return slug;
}

/**
 * Creates a handover markdown file.
 * Runs inside withProjectLock for atomic filename allocation + write.
 */
export async function handleHandoverCreate(
  content: string,
  slugRaw: string,
  format: OutputFormat,
  root: string,
): Promise<CommandResult> {
  if (!content.trim()) {
    throw new CliValidationError("invalid_input", "Handover content is empty");
  }

  const slug = normalizeSlug(slugRaw);
  const date = todayISO();
  let filename: string | undefined;

  await withProjectLock(root, { strict: false }, async () => {
    const absRoot = resolve(root);
    const handoversDir = join(absRoot, ".story", "handovers");
    await mkdir(handoversDir, { recursive: true });
    const wrapDir = join(absRoot, ".story");

    // Find next globally monotonic sequence number for this date.
    // Format: YYYY-MM-DD-NN-<slug>.md — sequence before slug ensures
    // handover latest returns the most recently created file regardless of slug.
    const datePrefix = `${date}-`;
    const seqRegex = new RegExp(`^${date}-(\\d{2})-`);
    let maxSeq = 0;

    const { readdirSync } = await import("node:fs");
    try {
      for (const f of readdirSync(handoversDir)) {
        const m = f.match(seqRegex);
        if (m) {
          const n = parseInt(m[1]!, 10);
          if (n > maxSeq) maxSeq = n;
        }
      }
    } catch {
      // dir empty or unreadable — start at 0
    }

    const nextSeq = maxSeq + 1;
    if (nextSeq > 99) {
      throw new CliValidationError(
        "conflict",
        `Too many handovers for ${date}; limit is 99 per day`,
      );
    }

    const candidate = `${date}-${String(nextSeq).padStart(2, "0")}-${slug}.md`;
    const candidatePath = join(handoversDir, candidate);
    await parseHandoverFilename(candidate, handoversDir);
    await guardPath(candidatePath, wrapDir);
    await atomicWrite(candidatePath, content);
    filename = candidate;
  });

  return { output: formatHandoverCreateResult(filename!, format) };
}
