/**
 * Lens prompt builder registry.
 * Maps lens names to their buildPrompt functions and version constants.
 */

import type { LensPromptVariables, ReviewStage, LensName } from "../types.js";

import * as cleanCode from "./clean-code.js";
import * as security from "./security.js";
import * as errorHandling from "./error-handling.js";
import * as performance from "./performance.js";
import * as apiDesign from "./api-design.js";
import * as concurrency from "./concurrency.js";
import * as testQuality from "./test-quality.js";
import * as accessibility from "./accessibility.js";

interface LensModule {
  readonly LENS_VERSION: string;
  buildPrompt(stage: ReviewStage, vars: LensPromptVariables): string;
}

const LENS_MODULES: Record<LensName, LensModule> = {
  "clean-code": cleanCode,
  security,
  "error-handling": errorHandling,
  performance,
  "api-design": apiDesign,
  concurrency,
  "test-quality": testQuality,
  accessibility,
};

export function getLensVersion(lens: LensName): string {
  return LENS_MODULES[lens].LENS_VERSION;
}

export function buildLensPrompt(
  lens: LensName,
  stage: ReviewStage,
  vars: LensPromptVariables,
): string {
  return LENS_MODULES[lens].buildPrompt(stage, vars);
}
