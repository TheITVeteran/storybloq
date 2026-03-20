import { resolve, relative, extname } from "node:path";
import { lstat } from "node:fs/promises";
import { ZodError } from "zod";
import {
  TicketIdSchema,
  IssueIdSchema,
  DateSchema,
  OUTPUT_FORMATS,
  type OutputFormat,
  type ErrorCode,
} from "../models/types.js";
import type { Argv } from "yargs";

export class CliValidationError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CliValidationError";
  }
}

function formatZodError(err: ZodError): string {
  return err.issues.map((i) => i.message).join("; ");
}

export function parseTicketId(raw: string): string {
  const result = TicketIdSchema.safeParse(raw);
  if (!result.success) {
    throw new CliValidationError(
      "invalid_input",
      `Invalid ticket ID "${raw}": ${formatZodError(result.error)}`,
    );
  }
  return result.data;
}

export function parseIssueId(raw: string): string {
  const result = IssueIdSchema.safeParse(raw);
  if (!result.success) {
    throw new CliValidationError(
      "invalid_input",
      `Invalid issue ID "${raw}": ${formatZodError(result.error)}`,
    );
  }
  return result.data;
}

export function parseDate(raw: string): string {
  const result = DateSchema.safeParse(raw);
  if (!result.success) {
    throw new CliValidationError(
      "invalid_input",
      `Invalid date "${raw}": ${formatZodError(result.error)}`,
    );
  }
  return result.data;
}

export function parseOutputFormat(raw: string): OutputFormat {
  if (!OUTPUT_FORMATS.includes(raw as OutputFormat)) {
    throw new CliValidationError(
      "invalid_input",
      `Invalid output format "${raw}": must be one of ${OUTPUT_FORMATS.join(", ")}`,
    );
  }
  return raw as OutputFormat;
}

/** Returns today's date as YYYY-MM-DD using local date components. */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Normalizes array options: filters out empty/whitespace-only entries. */
export function normalizeArrayOption(arr: string[] | undefined): string[] {
  if (!arr) return [];
  return arr.filter((s) => s.trim() !== "");
}

/** Adds --format option to a yargs command builder. */
export function addFormatOption<T>(y: Argv<T>): Argv<T & { format: string }> {
  return y.option("format", {
    type: "string",
    default: "md",
    choices: ["json", "md"],
    describe: "Output format: json or md",
  }) as Argv<T & { format: string }>;
}

/**
 * Validates a handover filename for safe filesystem access.
 * Rejects path traversal characters, requires .md extension,
 * and verifies the resolved path stays within handoversDir.
 * Also rejects symlinks via lstat.
 */
export async function parseHandoverFilename(
  raw: string,
  handoversDir: string,
): Promise<string> {
  // Reject dangerous characters
  if (raw.includes("/") || raw.includes("\\") || raw.includes("..") || raw.includes("\0")) {
    throw new CliValidationError(
      "invalid_input",
      `Invalid handover filename "${raw}": contains path traversal characters`,
    );
  }

  // Require .md extension (case-sensitive)
  if (extname(raw) !== ".md") {
    throw new CliValidationError(
      "invalid_input",
      `Invalid handover filename "${raw}": must have .md extension`,
    );
  }

  // Resolve and verify containment using path.relative
  const resolvedDir = resolve(handoversDir);
  const resolvedCandidate = resolve(handoversDir, raw);
  const rel = relative(resolvedDir, resolvedCandidate);
  if (!rel || rel.startsWith("..") || resolve(resolvedDir, rel) !== resolvedCandidate) {
    throw new CliValidationError(
      "invalid_input",
      `Invalid handover filename "${raw}": resolves outside handovers directory`,
    );
  }

  // Reject symlinks (require regular file)
  try {
    const stats = await lstat(resolvedCandidate);
    if (stats.isSymbolicLink()) {
      throw new CliValidationError(
        "invalid_input",
        `Invalid handover filename "${raw}": symlinks not allowed`,
      );
    }
  } catch (err: unknown) {
    if (err instanceof CliValidationError) throw err;
    // ENOENT is fine — file might not exist yet, will fail at read time
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new CliValidationError(
        "io_error",
        `Cannot check handover file "${raw}": ${(err as Error).message}`,
      );
    }
  }

  return raw;
}
