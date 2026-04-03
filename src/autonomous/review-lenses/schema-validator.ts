/**
 * Validates LensFinding objects returned by lens subagents.
 *
 * LLM output is inherently unreliable -- this ensures downstream code
 * can trust the shape of every finding.
 */

import type { LensFinding } from "./types.js";

const VALID_SEVERITIES = new Set(["critical", "major", "minor", "suggestion"]);
const VALID_IMPACTS = new Set(["blocker", "needs-revision", "non-blocking"]);

export interface ValidationResult {
  readonly valid: LensFinding[];
  readonly invalid: { raw: unknown; reason: string }[];
}

export function validateFindings(
  raw: unknown[],
  lensName: string | null,
): ValidationResult {
  const valid: LensFinding[] = [];
  const invalid: { raw: unknown; reason: string }[] = [];

  for (const item of raw) {
    const reason = checkFinding(item, lensName);
    if (reason) {
      invalid.push({ raw: item, reason });
    } else {
      valid.push(item as LensFinding);
    }
  }

  return { valid, invalid };
}

function checkFinding(item: unknown, lensName: string | null): string | null {
  if (!item || typeof item !== "object") return "not an object";

  const f = item as Record<string, unknown>;

  if (typeof f.lens !== "string") return "missing lens";
  if (typeof f.lensVersion !== "string") return "missing lensVersion";
  if (typeof f.severity !== "string" || !VALID_SEVERITIES.has(f.severity))
    return `invalid severity: ${f.severity}`;
  if (
    typeof f.recommendedImpact !== "string" ||
    !VALID_IMPACTS.has(f.recommendedImpact)
  )
    return `invalid recommendedImpact: ${f.recommendedImpact}`;
  if (typeof f.category !== "string" || f.category.length === 0)
    return "missing category";
  if (typeof f.description !== "string" || f.description.length === 0)
    return "missing description";
  if (typeof f.confidence !== "number" || f.confidence < 0 || f.confidence > 1)
    return `invalid confidence: ${f.confidence}`;
  if (typeof f.requiresMoreContext !== "boolean")
    return "missing requiresMoreContext";

  // Warn if lens name doesn't match expected (skip when null -- merger output keeps original lens names)
  if (lensName !== null && f.lens !== lensName)
    return `lens mismatch: expected ${lensName}, got ${f.lens}`;

  return null;
}
