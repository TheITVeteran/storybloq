import { describe, it, expect } from "vitest";
import { parseMergerResult } from "../../../src/autonomous/review-lenses/merger.js";
import { parseJudgeResult } from "../../../src/autonomous/review-lenses/judge.js";

describe("parseMergerResult", () => {
  it("parses valid full output", () => {
    const raw = JSON.stringify({
      findings: [
        { lens: "security", lensVersion: "security-v1", severity: "critical", recommendedImpact: "blocker", category: "injection", description: "SQL injection", file: "src/api/users.ts", line: 42, evidence: null, suggestedFix: null, confidence: 0.9, assumptions: null, requiresMoreContext: false },
      ],
      tensions: [
        { lensA: "security", lensB: "performance", description: "conflict", tradeoff: "tradeoff", blocking: false, file: "src/api/users.ts", line: 42 },
      ],
      mergeLog: [{ mergedFindings: ["a", "b"], resultKey: "c", reason: "same issue" }],
    });
    const result = parseMergerResult(raw);
    expect(result).not.toBeNull();
    expect(result!.findings).toHaveLength(1);
    expect(result!.tensions).toHaveLength(1);
    expect(result!.mergeLog).toHaveLength(1);
  });

  it("returns null on invalid JSON", () => {
    expect(parseMergerResult("not json")).toBeNull();
    expect(parseMergerResult("{truncated")).toBeNull();
  });

  it("returns null when findings is missing", () => {
    expect(parseMergerResult(JSON.stringify({ tensions: [] }))).toBeNull();
  });

  it("returns null when findings is not an array", () => {
    expect(parseMergerResult(JSON.stringify({ findings: "not array" }))).toBeNull();
    expect(parseMergerResult(JSON.stringify({ findings: {} }))).toBeNull();
  });

  it("defaults tensions and mergeLog to empty arrays", () => {
    const raw = JSON.stringify({ findings: [] });
    const result = parseMergerResult(raw);
    expect(result).not.toBeNull();
    expect(result!.tensions).toEqual([]);
    expect(result!.mergeLog).toEqual([]);
  });

  it("returns null on null input content", () => {
    expect(parseMergerResult(JSON.stringify(null))).toBeNull();
  });
});

describe("parseJudgeResult", () => {
  it("parses valid full output", () => {
    const raw = JSON.stringify({
      verdict: "revise",
      verdictReason: "major finding unresolved",
      findings: [{ severity: "major" }],
      tensions: [],
      lensesCompleted: ["security"],
      lensesInsufficientContext: [],
      lensesFailed: [],
      lensesSkipped: ["accessibility"],
      isPartial: false,
    });
    const result = parseJudgeResult(raw);
    expect(result).not.toBeNull();
    expect(result!.verdict).toBe("revise");
    expect(result!.verdictReason).toBe("major finding unresolved");
    expect(result!.isPartial).toBe(false);
    expect(result!.lensesSkipped).toEqual(["accessibility"]);
  });

  it("returns null on invalid JSON", () => {
    expect(parseJudgeResult("not json")).toBeNull();
  });

  it("returns null when verdict is missing", () => {
    expect(parseJudgeResult(JSON.stringify({ findings: [] }))).toBeNull();
    expect(parseJudgeResult(JSON.stringify({}))).toBeNull();
  });

  it("returns null on null input content", () => {
    expect(parseJudgeResult(JSON.stringify(null))).toBeNull();
  });

  it("defaults optional fields to empty/false", () => {
    const raw = JSON.stringify({ verdict: "approve" });
    const result = parseJudgeResult(raw);
    expect(result).not.toBeNull();
    expect(result!.verdictReason).toBe("");
    expect(result!.findings).toEqual([]);
    expect(result!.tensions).toEqual([]);
    expect(result!.lensesCompleted).toEqual([]);
    expect(result!.lensesFailed).toEqual([]);
    expect(result!.lensesSkipped).toEqual([]);
    expect(result!.isPartial).toBe(false);
  });

  it("rejects invalid verdict values", () => {
    expect(parseJudgeResult(JSON.stringify({ verdict: "request_changes" }))).toBeNull();
    expect(parseJudgeResult(JSON.stringify({ verdict: "approve with concerns" }))).toBeNull();
    expect(parseJudgeResult(JSON.stringify({ verdict: "" }))).toBeNull();
  });

  it("ignores LLM isPartial -- always false (orchestrator overrides)", () => {
    const raw = JSON.stringify({ verdict: "revise", isPartial: true });
    const result = parseJudgeResult(raw);
    expect(result!.isPartial).toBe(false); // Orchestrator computes from lensesFailed
  });
});
