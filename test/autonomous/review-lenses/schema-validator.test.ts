import { describe, it, expect } from "vitest";
import { validateFindings } from "../../../src/autonomous/review-lenses/schema-validator.js";

const validFinding = {
  lens: "security",
  lensVersion: "security-v1",
  severity: "critical",
  recommendedImpact: "blocker",
  category: "injection",
  description: "SQL injection found",
  file: "src/api.ts",
  line: 42,
  evidence: "query = `SELECT * FROM users WHERE id = ${id}`",
  suggestedFix: "Use parameterized query",
  confidence: 0.95,
  assumptions: null,
  requiresMoreContext: false,
  inputSource: "req.params.id",
  sink: "db.query()",
};

describe("schema validator", () => {
  it("accepts valid findings", () => {
    const result = validateFindings([validFinding], "security");
    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(0);
  });

  it("rejects non-objects", () => {
    const result = validateFindings(["string", 42, null], "security");
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(3);
  });

  it("rejects missing severity", () => {
    const { severity: _, ...noSeverity } = validFinding;
    const result = validateFindings([noSeverity], "security");
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].reason).toContain("severity");
  });

  it("rejects invalid severity value", () => {
    const result = validateFindings([{ ...validFinding, severity: "urgent" }], "security");
    expect(result.invalid).toHaveLength(1);
  });

  it("rejects invalid recommendedImpact", () => {
    const result = validateFindings([{ ...validFinding, recommendedImpact: "maybe" }], "security");
    expect(result.invalid).toHaveLength(1);
  });

  it("rejects missing description", () => {
    const result = validateFindings([{ ...validFinding, description: "" }], "security");
    expect(result.invalid).toHaveLength(1);
  });

  it("rejects confidence out of range", () => {
    const result = validateFindings([{ ...validFinding, confidence: 1.5 }], "security");
    expect(result.invalid).toHaveLength(1);
  });

  it("rejects lens name mismatch", () => {
    const result = validateFindings([{ ...validFinding, lens: "clean-code" }], "security");
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].reason).toContain("mismatch");
  });

  it("rejects missing requiresMoreContext", () => {
    const { requiresMoreContext: _, ...noField } = validFinding;
    const result = validateFindings([noField], "security");
    expect(result.invalid).toHaveLength(1);
  });

  it("handles mixed valid and invalid", () => {
    const result = validateFindings(
      [validFinding, { broken: true }, validFinding],
      "security",
    );
    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(1);
  });
});
