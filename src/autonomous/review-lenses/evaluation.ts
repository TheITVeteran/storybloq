/**
 * Evaluation tooling for multi-lens review quality.
 *
 * Provides functions to:
 * 1. Capture baseline (single-pass review findings on a diff)
 * 2. Run lens review on the same diff
 * 3. Compare: precision, recall, duplicate rate, cost
 *
 * Usage: Called from CLI or test scripts against historical diffs.
 */

import type { LensFinding, SynthesisResult, LensName } from "./types.js";

// ── Evaluation metrics ─────────────────────────────────────────

export interface EvaluationMetrics {
  readonly baselineFindings: number;
  readonly lensFindings: number;
  readonly incrementalFindings: number; // lens-only, not in baseline
  readonly duplicateRate: number; // pre-synthesis duplicates / total
  readonly precision: number | null; // requires manual labeling
  readonly recall: number | null; // requires manual labeling
  readonly costTokens: number;
  readonly latencyMs: number;
  readonly byLens: Record<string, LensEvaluation>;
}

export interface LensEvaluation {
  readonly lens: string;
  readonly lensVersion: string;
  readonly resolvedModel: string;
  readonly findingCount: number;
  readonly mergedCount: number; // findings merged by synthesizer
  readonly truncatedCount: number; // findings dropped by budget
  readonly avgConfidence: number;
  readonly durationMs: number;
}

// ── Comparison ─────────────────────────────────────────────────

export function compareResults(
  baseline: readonly { description: string; file?: string; line?: number }[],
  lensResult: SynthesisResult,
  preSynthesisCount: number,
  costTokens: number,
  latencyMs: number,
): EvaluationMetrics {
  const lensFindings = lensResult.findings;

  // Rough incremental detection: lens findings not matching any baseline description
  const baselineDescs = new Set(baseline.map((f) => normalizeDesc(f.description)));
  const incremental = lensFindings.filter(
    (f) => !baselineDescs.has(normalizeDesc(f.description)),
  );

  // Duplicate rate: how many findings were merged by synthesizer
  const duplicateRate =
    preSynthesisCount > 0
      ? (preSynthesisCount - lensFindings.length) / preSynthesisCount
      : 0;

  // Per-lens breakdown
  const byLens: Record<string, LensEvaluation> = {};
  for (const finding of lensFindings) {
    if (!byLens[finding.lens]) {
      byLens[finding.lens] = {
        lens: finding.lens,
        lensVersion: finding.lensVersion,
        resolvedModel: finding.resolvedModel ?? "unknown",
        findingCount: 0,
        mergedCount: 0,
        truncatedCount: 0,
        avgConfidence: 0,
        durationMs: 0,
      };
    }
    const entry = byLens[finding.lens] as {
      -readonly [K in keyof LensEvaluation]: LensEvaluation[K];
    };
    entry.findingCount++;
    if (finding.mergedFrom && finding.mergedFrom.length > 1) entry.mergedCount++;
    entry.avgConfidence =
      (entry.avgConfidence * (entry.findingCount - 1) + finding.confidence) /
      entry.findingCount;
  }

  return {
    baselineFindings: baseline.length,
    lensFindings: lensFindings.length,
    incrementalFindings: incremental.length,
    duplicateRate,
    precision: null, // requires manual labeling
    recall: null, // requires manual labeling
    costTokens,
    latencyMs,
    byLens,
  };
}

export function formatEvaluationReport(metrics: EvaluationMetrics): string {
  const lines = [
    "# Lens Review Evaluation",
    "",
    `| Metric | Value |`,
    `|---|---|`,
    `| Baseline findings | ${metrics.baselineFindings} |`,
    `| Lens findings (post-synthesis) | ${metrics.lensFindings} |`,
    `| Incremental (lens-only) | ${metrics.incrementalFindings} |`,
    `| Duplicate rate | ${(metrics.duplicateRate * 100).toFixed(1)}% |`,
    `| Cost | ~${metrics.costTokens} tokens |`,
    `| Latency | ${metrics.latencyMs}ms |`,
    "",
    "## Per-Lens Breakdown",
    "",
    `| Lens | Version | Model | Findings | Merged | Avg Confidence |`,
    `|---|---|---|---|---|---|`,
  ];

  for (const [, eval_] of Object.entries(metrics.byLens)) {
    lines.push(
      `| ${eval_.lens} | ${eval_.lensVersion} | ${eval_.resolvedModel} | ${eval_.findingCount} | ${eval_.mergedCount} | ${eval_.avgConfidence.toFixed(2)} |`,
    );
  }

  return lines.join("\n");
}

// ── Helpers ────────────────────────────────────────────────────

function normalizeDesc(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}
