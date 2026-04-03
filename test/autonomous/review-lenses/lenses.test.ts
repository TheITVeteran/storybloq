import { describe, it, expect } from "vitest";
import { buildLensPrompt, getLensVersion } from "../../../src/autonomous/review-lenses/lenses/index.js";
import { ALL_LENSES } from "../../../src/autonomous/review-lenses/types.js";
import type { LensPromptVariables, LensName, ReviewStage } from "../../../src/autonomous/review-lenses/types.js";

const baseVars: LensPromptVariables = {
  lensName: "clean-code",
  lensVersion: "clean-code-v1",
  reviewStage: "CODE_REVIEW",
  artifactType: "diff",
  ticketDescription: "Add user search feature",
  projectRules: "Follow SRP",
  fileManifest: "- src/search.ts: searchUsers, buildQuery",
  reviewArtifact: "diff --git a/src/search.ts b/src/search.ts\n+function searchUsers() {}",
  knownFalsePositives: "",
  activationReason: "core lens",
  findingBudget: 10,
  confidenceFloor: 0.6,
};

describe("lens prompt builders", () => {
  for (const lens of ALL_LENSES) {
    describe(lens, () => {
      it("has a version string", () => {
        const version = getLensVersion(lens);
        expect(version).toMatch(/^[a-z-]+-v\d+$/);
      });

      for (const stage of ["CODE_REVIEW", "PLAN_REVIEW"] as ReviewStage[]) {
        it(`builds ${stage} prompt`, () => {
          const vars = {
            ...baseVars,
            lensName: lens,
            lensVersion: getLensVersion(lens),
            reviewStage: stage,
            artifactType: (stage === "CODE_REVIEW" ? "diff" : "plan") as "diff" | "plan",
          };
          const prompt = buildLensPrompt(lens, stage, vars);

          // Should contain shared preamble
          expect(prompt).toContain("## Safety");
          expect(prompt).toContain("## Output rules");
          expect(prompt).toContain(lens);

          // Should contain stage-appropriate label
          if (stage === "CODE_REVIEW") {
            expect(prompt).toContain("Diff to review");
          } else {
            expect(prompt).toContain("Plan to review");
          }

          // Should contain the review artifact
          expect(prompt).toContain("searchUsers");
        });
      }
    });
  }

  it("security prompt includes scanner findings placeholder", () => {
    const vars = {
      ...baseVars,
      lensName: "security",
      lensVersion: "security-v1",
      scannerFindings: "CVE-2024-1234: lodash prototype pollution",
    };
    const prompt = buildLensPrompt("security", "CODE_REVIEW", vars);
    expect(prompt).toContain("CVE-2024-1234");
  });

  it("performance prompt includes hot paths", () => {
    const vars = {
      ...baseVars,
      lensName: "performance",
      lensVersion: "performance-v1",
      hotPaths: "src/engine/**, src/billing/**",
    };
    const prompt = buildLensPrompt("performance", "CODE_REVIEW", vars);
    expect(prompt).toContain("src/engine/**");
  });

  it("all prompts include confidence floor", () => {
    const vars = { ...baseVars, confidenceFloor: 0.7 };
    const prompt = buildLensPrompt("clean-code", "CODE_REVIEW", vars);
    expect(prompt).toContain("0.7");
  });

  it("no unreplaced template variables in any prompt", () => {
    for (const lens of ALL_LENSES) {
      for (const stage of ["CODE_REVIEW", "PLAN_REVIEW"] as const) {
        const vars = {
          ...baseVars,
          lensName: lens,
          lensVersion: `${lens}-v1`,
          reviewStage: stage,
          artifactType: (stage === "CODE_REVIEW" ? "diff" : "plan") as "diff" | "plan",
          scannerFindings: "",
          hotPaths: "",
        };
        const prompt = buildLensPrompt(lens, stage, vars);
        // No literal {{ should remain after variable injection
        expect(prompt).not.toMatch(/\{\{[^}]+\}\}/);
      }
    }
  });

  it("security prompt handles empty scannerFindings without outputting 'undefined'", () => {
    const vars = {
      ...baseVars,
      lensName: "security",
      lensVersion: "security-v1",
      scannerFindings: undefined as unknown as string,
    };
    const prompt = buildLensPrompt("security", "CODE_REVIEW", vars);
    expect(prompt).not.toContain("undefined");
  });
});
