import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildCacheKey,
  getFromCache,
  writeToCache,
  clearCache,
} from "../../../src/autonomous/review-lenses/cache.js";
import type { LensFinding } from "../../../src/autonomous/review-lenses/types.js";

let sessionDir: string;

const finding: LensFinding = {
  lens: "security",
  lensVersion: "security-v1",
  severity: "critical",
  recommendedImpact: "blocker",
  category: "injection",
  description: "test finding",
  file: "src/api.ts",
  line: 10,
  evidence: null,
  suggestedFix: null,
  confidence: 0.9,
  assumptions: null,
  requiresMoreContext: false,
};

beforeEach(() => {
  sessionDir = mkdtempSync(join(tmpdir(), "lens-cache-test-"));
});

afterEach(() => {
  rmSync(sessionDir, { recursive: true, force: true });
});

describe("lens cache", () => {
  it("returns null for cache miss", () => {
    const key = buildCacheKey("security", "v1", "CODE_REVIEW", "content", "desc", "rules", "fps");
    expect(getFromCache(sessionDir, key)).toBeNull();
  });

  it("stores and retrieves findings", () => {
    const key = buildCacheKey("security", "v1", "CODE_REVIEW", "content", "desc", "rules", "fps");
    writeToCache(sessionDir, key, [finding]);
    const cached = getFromCache(sessionDir, key);
    expect(cached).toHaveLength(1);
    expect(cached![0].category).toBe("injection");
  });

  it("produces different keys for different file content", () => {
    const k1 = buildCacheKey("security", "v1", "CODE_REVIEW", "contentA", "desc", "rules", "fps");
    const k2 = buildCacheKey("security", "v1", "CODE_REVIEW", "contentB", "desc", "rules", "fps");
    expect(k1).not.toBe(k2);
  });

  it("produces different keys for different lens versions", () => {
    const k1 = buildCacheKey("security", "v1", "CODE_REVIEW", "content", "desc", "rules", "fps");
    const k2 = buildCacheKey("security", "v2", "CODE_REVIEW", "content", "desc", "rules", "fps");
    expect(k1).not.toBe(k2);
  });

  it("produces different keys for different stages", () => {
    const k1 = buildCacheKey("security", "v1", "CODE_REVIEW", "content", "desc", "rules", "fps");
    const k2 = buildCacheKey("security", "v1", "PLAN_REVIEW", "content", "desc", "rules", "fps");
    expect(k1).not.toBe(k2);
  });

  it("clearCache removes all cached entries", () => {
    const key = buildCacheKey("security", "v1", "CODE_REVIEW", "content", "desc", "rules", "fps");
    writeToCache(sessionDir, key, [finding]);
    expect(getFromCache(sessionDir, key)).not.toBeNull();
    clearCache(sessionDir);
    expect(getFromCache(sessionDir, key)).toBeNull();
  });

  it("clearCache is safe on non-existent directory", () => {
    clearCache(join(sessionDir, "nonexistent"));
    // No throw
  });

  it("handles empty findings array", () => {
    const key = buildCacheKey("security", "v1", "CODE_REVIEW", "content", "desc", "rules", "fps");
    writeToCache(sessionDir, key, []);
    const cached = getFromCache(sessionDir, key);
    expect(cached).toHaveLength(0);
  });
});
