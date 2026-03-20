import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { fixturesDir, readJson } from "../helpers.js";
import { RoadmapSchema, BlockerSchema, PhaseSchema } from "../../src/models/roadmap.js";

describe("RoadmapSchema", () => {
  describe("valid roadmaps", () => {
    it("parses a complete roadmap with phases and blockers", () => {
      const data = readJson(resolve(fixturesDir, "valid/basic/roadmap.json"));
      const result = RoadmapSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("test-project");
        expect(result.data.phases).toHaveLength(2);
        expect(result.data.blockers).toHaveLength(3);
      }
    });

    it("parses a roadmap with empty blockers array", () => {
      const data = {
        title: "empty-blockers", date: "2026-01-01",
        phases: [{ id: "init", label: "INIT", name: "Init", description: "Initialization." }],
        blockers: [],
      };
      expect(RoadmapSchema.safeParse(data).success).toBe(true);
    });
  });

  describe("invalid roadmaps", () => {
    it("rejects a roadmap with missing phases array", () => {
      const data = readJson(resolve(fixturesDir, "invalid/missing-phases-roadmap.json"));
      expect(RoadmapSchema.safeParse(data).success).toBe(false);
    });
  });

  describe("round-trip unknown key preservation", () => {
    it("preserves unknown keys at roadmap, phase, and blocker levels", () => {
      const data = {
        title: "test", date: "2026-01-01",
        phases: [{ id: "a", label: "A", name: "Phase A", description: "Desc.", extraPhaseKey: true }],
        blockers: [{ name: "b", cleared: false, note: null, extraBlockerKey: "kept" }],
        extraRoadmapKey: "preserved",
      };
      const result = RoadmapSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.extraRoadmapKey).toBe("preserved");
        expect(result.data.phases[0]!.extraPhaseKey).toBe(true);
        expect(result.data.blockers[0]!.extraBlockerKey).toBe("kept");

        const serialized = JSON.parse(JSON.stringify(result.data));
        const reparsed = RoadmapSchema.safeParse(serialized);
        expect(reparsed.success).toBe(true);
        if (reparsed.success) {
          expect(reparsed.data.extraRoadmapKey).toBe("preserved");
          expect(reparsed.data.phases[0]!.extraPhaseKey).toBe(true);
          expect(reparsed.data.blockers[0]!.extraBlockerKey).toBe("kept");
        }
      }
    });
  });
});

describe("BlockerSchema", () => {
  it("parses a legacy-format blocker (cleared: boolean)", () => {
    const result = BlockerSchema.safeParse({ name: "reserved", cleared: true, note: "Done." });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cleared).toBe(true);
  });

  it("parses a new-format blocker (createdDate/clearedDate)", () => {
    const result = BlockerSchema.safeParse({
      name: "API key", createdDate: "2026-01-10", clearedDate: "2026-01-12", note: "Provisioned.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdDate).toBe("2026-01-10");
      expect(result.data.clearedDate).toBe("2026-01-12");
    }
  });

  it("parses a new-format blocker with null clearedDate (active)", () => {
    const result = BlockerSchema.safeParse({ name: "Waiting", createdDate: "2026-01-14", clearedDate: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.clearedDate).toBeNull();
  });

  it("parses a minimal blocker (name only, no note)", () => {
    const result = BlockerSchema.safeParse({ name: "Minimal" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBeUndefined();
      expect(result.data.cleared).toBeUndefined();
    }
  });
});

describe("PhaseSchema", () => {
  it("parses a phase with optional summary", () => {
    const result = PhaseSchema.safeParse({
      id: "alpha", label: "ALPHA", name: "Alpha", description: "Desc.", summary: "Short.",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.summary).toBe("Short.");
  });

  it("parses a phase without summary", () => {
    const result = PhaseSchema.safeParse({ id: "beta", label: "BETA", name: "Beta", description: "Desc." });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.summary).toBeUndefined();
  });
});
