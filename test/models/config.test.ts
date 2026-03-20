import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { fixturesDir, readJson } from "../helpers.js";
import { ConfigSchema, FeaturesSchema } from "../../src/models/config.js";

describe("ConfigSchema", () => {
  describe("valid configs", () => {
    it("parses a complete config (version 2)", () => {
      const data = readJson(resolve(fixturesDir, "valid/basic/config.json"));
      const result = ConfigSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe(2);
        expect(result.data.project).toBe("test-project");
        expect(result.data.features.tickets).toBe(true);
      }
    });

    it("parses a config with optional schemaVersion", () => {
      const data = {
        version: 2, schemaVersion: 1, project: "test", type: "npm", language: "typescript",
        features: { tickets: true, issues: true, handovers: true, roadmap: true, reviews: true },
      };
      const result = ConfigSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.schemaVersion).toBe(1);
    });

    it("parses a config without schemaVersion", () => {
      const data = readJson(resolve(fixturesDir, "valid/basic/config.json"));
      const result = ConfigSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.schemaVersion).toBeUndefined();
    });
  });

  describe("invalid configs", () => {
    it("rejects a config with missing project field", () => {
      const data = readJson(resolve(fixturesDir, "invalid/missing-project-config.json"));
      expect(ConfigSchema.safeParse(data).success).toBe(false);
    });

    it("rejects a config with missing features object", () => {
      const data = { version: 2, project: "test", type: "npm", language: "typescript" };
      expect(ConfigSchema.safeParse(data).success).toBe(false);
    });

    it("rejects a config with version 0", () => {
      const data = {
        version: 0, project: "test", type: "npm", language: "typescript",
        features: { tickets: true, issues: true, handovers: true, roadmap: true, reviews: true },
      };
      expect(ConfigSchema.safeParse(data).success).toBe(false);
    });
  });

  describe("round-trip unknown key preservation", () => {
    it("preserves unknown keys at config and features levels", () => {
      const data = {
        version: 2, project: "test", type: "npm", language: "typescript",
        features: { tickets: true, issues: true, handovers: true, roadmap: true, reviews: true, extraFeature: true },
        extraConfigKey: "preserved",
      };
      const result = ConfigSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.extraConfigKey).toBe("preserved");
        expect(result.data.features.extraFeature).toBe(true);

        const serialized = JSON.parse(JSON.stringify(result.data));
        const reparsed = ConfigSchema.safeParse(serialized);
        expect(reparsed.success).toBe(true);
        if (reparsed.success) {
          expect(reparsed.data.extraConfigKey).toBe("preserved");
          expect(reparsed.data.features.extraFeature).toBe(true);
        }
      }
    });
  });
});

describe("FeaturesSchema", () => {
  it("parses valid features", () => {
    const data = { tickets: true, issues: false, handovers: true, roadmap: true, reviews: false };
    expect(FeaturesSchema.safeParse(data).success).toBe(true);
  });

  it("rejects features with missing field", () => {
    const data = { tickets: true, issues: true };
    expect(FeaturesSchema.safeParse(data).success).toBe(false);
  });
});
