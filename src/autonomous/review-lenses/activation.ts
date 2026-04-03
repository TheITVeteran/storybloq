/**
 * Lens activation -- determines which lenses fire based on changed files.
 *
 * Per-file activation, not per-project. Handles mixed diffs.
 */

import type { LensConfig, LensName } from "./types.js";
import { CORE_LENSES, ALL_LENSES } from "./types.js";

// Files to exclude from all lenses
const EXCLUDED_PATTERNS = [
  /\.lock$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.generated\./,
  /\.g\./,
  /node_modules\//,
  /vendor\//,
  /\.min\.(js|css)$/,
  /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|mp4|webm|webp)$/,
  /migrations?\//i,
];

// ORM / database modules that trigger Performance lens
const ORM_IMPORTS = [
  "prisma",
  "sequelize",
  "typeorm",
  "mongoose",
  "knex",
  "drizzle",
  "mikro-orm",
  "@supabase/supabase-js",
];

// Concurrency signals beyond just async/await
const CONCURRENCY_EXTENSIONS = new Set([".swift", ".go", ".rs"]);
const CONCURRENCY_IMPORTS = [
  "worker_threads",
  "Web Workers",
  "DispatchQueue",
  "goroutine",
  "Mutex",
  "Lock",
  "Semaphore",
  "Actor",
  "Promise.all",
  "Promise.allSettled",
];

// API route patterns
const API_PATTERNS = [
  /\/api\//,
  /routes?\//,
  /controllers?\//,
  /resolvers?\//,
  /\.resolver\./,
  /\.controller\./,
];

// Frontend / accessibility patterns
const FRONTEND_EXTENSIONS = new Set([
  ".tsx",
  ".jsx",
  ".html",
  ".vue",
  ".svelte",
  ".css",
  ".scss",
  ".ejs",
  ".hbs",
  ".pug",
]);

// Test file patterns
const TEST_PATTERNS = [
  /\.test\./,
  /\.spec\./,
  /\/__tests__\//,
  /\/test\//,
];

export interface ActivationResult {
  readonly active: readonly LensName[];
  readonly reasons: Record<string, string>;
  readonly filteredFiles: readonly string[];
}

export function determineActiveLenses(
  changedFiles: readonly string[],
  config: LensConfig,
  fileContents?: ReadonlyMap<string, string>,
): ActivationResult {
  // Override: explicit lens list
  if (config.lenses !== "auto") {
    const active = config.lenses.filter((l): l is LensName =>
      (ALL_LENSES as readonly string[]).includes(l),
    );
    const reasons: Record<string, string> = {};
    for (const l of active) reasons[l] = "explicit config override";
    return { active, reasons, filteredFiles: filterExcluded(changedFiles) };
  }

  const filtered = filterExcluded(changedFiles);
  if (filtered.length === 0) {
    return { active: [], reasons: {}, filteredFiles: [] };
  }

  const reasons: Record<string, string> = {};
  const active = new Set<LensName>();

  // Core lenses always fire
  for (const lens of CORE_LENSES) {
    active.add(lens);
    reasons[lens] = "core lens (always active)";
  }

  // Surface-activated lenses
  for (const file of filtered) {
    const ext = getExtension(file);
    const content = fileContents?.get(file);

    // Performance: ORM imports, large files (>300 lines), hotPaths
    if (!active.has("performance")) {
      const lineCount = content ? content.split("\n").length : 0;
      if (
        (content && ORM_IMPORTS.some((m) => content.includes(m))) ||
        lineCount > 300 ||
        matchesGlobs(file, config.hotPaths)
      ) {
        active.add("performance");
        const reason = lineCount > 300
          ? `file exceeds 300 lines (${lineCount}): ${file}`
          : `ORM import or hotPaths match: ${file}`;
        reasons["performance"] = reason;
      }
    }

    // API Design: route handlers, controllers
    if (!active.has("api-design") && API_PATTERNS.some((p) => p.test(file))) {
      active.add("api-design");
      reasons["api-design"] = `API route pattern: ${file}`;
    }

    // Concurrency: language extensions or concurrency primitives
    if (!active.has("concurrency")) {
      if (
        CONCURRENCY_EXTENSIONS.has(ext) ||
        (content &&
          CONCURRENCY_IMPORTS.some((m) => content.includes(m)))
      ) {
        active.add("concurrency");
        reasons["concurrency"] = `concurrency signal: ${file}`;
      }
    }

    // Test Quality: test files changed
    if (!active.has("test-quality") && TEST_PATTERNS.some((p) => p.test(file))) {
      active.add("test-quality");
      reasons["test-quality"] = `test file changed: ${file}`;
    }

    // Accessibility: frontend files
    if (!active.has("accessibility") && FRONTEND_EXTENSIONS.has(ext)) {
      active.add("accessibility");
      reasons["accessibility"] = `frontend file: ${file}`;
    }
  }

  // Test Quality: source files changed without corresponding tests
  if (!active.has("test-quality")) {
    const sourceFiles = filtered.filter(
      (f) => !TEST_PATTERNS.some((p) => p.test(f)) && /\.(ts|tsx|js|jsx|swift|go|rs|py)$/.test(f),
    );
    const testFiles = new Set(
      filtered.filter((f) => TEST_PATTERNS.some((p) => p.test(f))),
    );
    const hasSourceWithoutTest = sourceFiles.some((src) => {
      // Convention: src/foo.ts -> src/foo.test.ts or __tests__/foo.test.ts
      const base = src.replace(/\.[^.]+$/, "");
      return !filtered.some(
        (f) => testFiles.has(f) && f.includes(base.split("/").pop()!),
      );
    });
    if (hasSourceWithoutTest && sourceFiles.length > 0) {
      active.add("test-quality");
      reasons["test-quality"] = "source-changed-no-tests";
    }
  }

  // Cap at maxLenses (core always included, surface trimmed)
  const result = Array.from(active) as LensName[];
  if (result.length > config.maxLenses) {
    const core = result.filter((l) =>
      (CORE_LENSES as readonly string[]).includes(l),
    );
    const surface = result.filter(
      (l) => !(CORE_LENSES as readonly string[]).includes(l),
    );
    const capped = [...core, ...surface.slice(0, config.maxLenses - core.length)];
    return { active: capped as LensName[], reasons, filteredFiles: filtered };
  }

  return { active: result, reasons, filteredFiles: filtered };
}

function filterExcluded(files: readonly string[]): string[] {
  return files.filter(
    (f) => !EXCLUDED_PATTERNS.some((p) => p.test(f)),
  );
}

function getExtension(file: string): string {
  const dot = file.lastIndexOf(".");
  return dot >= 0 ? file.slice(dot) : "";
}

function matchesGlobs(file: string, patterns: readonly string[]): boolean {
  for (const pattern of patterns) {
    const regex = new RegExp(
      "^" +
        pattern
          .replace(/\*\*/g, "<<GLOBSTAR>>")
          .replace(/\*/g, "<<STAR>>")
          .replace(/\?/g, "<<QMARK>>")
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/<<GLOBSTAR>>/g, ".*")
          .replace(/<<STAR>>/g, "[^/]*")
          .replace(/<<QMARK>>/g, "[^/]") +
        "$",
    );
    if (regex.test(file)) return true;
  }
  return false;
}
