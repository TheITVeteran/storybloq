/**
 * Centralized blocking policy computation.
 *
 * Lenses output `recommendedImpact` (their technical opinion).
 * The orchestrator computes final `blocking` from this policy.
 * This separation means tuning merge policy is a config change, not a prompt edit.
 */

import type { BlockingPolicy, LensFinding, ReviewStage } from "./types.js";

export function computeBlocking(
  finding: LensFinding,
  stage: ReviewStage,
  policy: BlockingPolicy,
): boolean {
  // Repo-level overrides
  if (policy.neverBlock.includes(finding.lens)) return false;
  if (policy.alwaysBlock.includes(finding.category)) return true;

  // Plan review: advisory -- only block for security/integrity gaps
  if (stage === "PLAN_REVIEW") {
    return (
      finding.severity === "critical" &&
      finding.confidence >= 0.8 &&
      policy.planReviewBlockingLenses.includes(finding.lens)
    );
  }

  // Code review: respect lens recommendation unless overridden
  if (finding.recommendedImpact === "blocker") {
    return finding.confidence >= 0.7;
  }
  if (finding.recommendedImpact === "needs-revision") {
    return finding.severity === "critical" && finding.confidence >= 0.8;
  }
  return false;
}
