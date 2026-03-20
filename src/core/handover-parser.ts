import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, extname } from "node:path";
import type { LoadWarning } from "./errors.js";

const HANDOVER_DATE_REGEX = /^\d{4}-\d{2}-\d{2}/;

/**
 * Lists handover markdown files, sorted by date (newest first).
 * Non-conforming filenames (no YYYY-MM-DD prefix) are appended at end
 * and flagged as naming_convention warnings.
 */
export async function listHandovers(
  handoversDir: string,
  root: string,
  warnings: LoadWarning[],
): Promise<string[]> {
  if (!existsSync(handoversDir)) return [];

  let entries: string[];
  try {
    entries = await readdir(handoversDir);
  } catch (err) {
    warnings.push({
      file: relative(root, handoversDir),
      message: `Cannot enumerate handovers: ${err instanceof Error ? err.message : String(err)}`,
      type: "parse_error",
    });
    return [];
  }

  const conforming: string[] = [];
  const nonConforming: string[] = [];

  for (const entry of entries.sort()) {
    if (entry.startsWith(".")) continue;
    if (extname(entry) !== ".md") continue;

    if (HANDOVER_DATE_REGEX.test(entry)) {
      conforming.push(entry);
    } else {
      nonConforming.push(entry);
      warnings.push({
        file: relative(root, join(handoversDir, entry)),
        message: "Handover filename does not start with YYYY-MM-DD date prefix.",
        type: "naming_convention",
      });
    }
  }

  // Newest first (reverse lexicographic — YYYY-MM-DD sorts correctly)
  conforming.sort((a, b) => b.localeCompare(a));

  return [...conforming, ...nonConforming];
}

/** Reads the content of a handover markdown file. */
export async function readHandover(
  handoversDir: string,
  filename: string,
): Promise<string> {
  return readFile(join(handoversDir, filename), "utf-8");
}

/**
 * Extracts the YYYY-MM-DD date prefix from a handover filename.
 * Returns the date string or null if the filename does not conform.
 */
export function extractHandoverDate(filename: string): string | null {
  const match = filename.match(HANDOVER_DATE_REGEX);
  return match ? match[0] : null;
}
