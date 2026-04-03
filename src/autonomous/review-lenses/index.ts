/**
 * Multi-Lens Review Orchestrator -- public API.
 */

export { prepareLensReview } from "./orchestrator.js";
export type {
  LensReviewOptions,
  PreparedLensReview,
  OrchestratorOutput,
  JudgeInput,
} from "./orchestrator.js";

export { determineActiveLenses } from "./activation.js";
export { computeBlocking } from "./blocking-policy.js";
export { generateIssueKey } from "./issue-key.js";
export { validateFindings } from "./schema-validator.js";
export { buildCacheKey, getFromCache, writeToCache, clearCache } from "./cache.js";
export { buildLensPrompt, getLensVersion } from "./lenses/index.js";
export { compareResults, formatEvaluationReport } from "./evaluation.js";

export type {
  LensFinding,
  LensResult,
  Tension,
  MergerResult,
  SynthesisResult,
  LensProgressEvent,
  BlockingPolicy,
  LensConfig,
  LensMetadata,
  LensName,
  ReviewStage,
  LensPromptVariables,
} from "./types.js";

export {
  CORE_LENSES,
  SURFACE_LENSES,
  ALL_LENSES,
  LENS_MAX_SEVERITY,
  DEFAULT_BLOCKING_POLICY,
  DEFAULT_LENS_CONFIG,
} from "./types.js";
