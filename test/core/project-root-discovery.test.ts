import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverProjectRoot } from "../../src/core/project-root-discovery.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "storybloq-prd-"));
  // Clear env var
  delete process.env.CLAUDESTORY_PROJECT_ROOT;
});

afterEach(async () => {
  delete process.env.CLAUDESTORY_PROJECT_ROOT;
  await rm(root, { recursive: true, force: true });
});

describe("discoverProjectRoot", () => {
  it("finds root from project directory", async () => {
    await mkdir(join(root, ".story"), { recursive: true });
    await writeFile(
      join(root, ".story", "config.json"),
      JSON.stringify({ version: 2, project: "test", type: "npm", language: "ts", features: { tickets: true, issues: true, handovers: true, roadmap: true, reviews: true } }),
    );

    const result = discoverProjectRoot(root);
    expect(result).toBe(root);
  });

  it("finds root from nested subdirectory (walk-up)", async () => {
    await mkdir(join(root, ".story"), { recursive: true });
    await writeFile(
      join(root, ".story", "config.json"),
      JSON.stringify({ version: 2, project: "test", type: "npm", language: "ts", features: { tickets: true, issues: true, handovers: true, roadmap: true, reviews: true } }),
    );
    const nested = join(root, "src", "core", "deep");
    await mkdir(nested, { recursive: true });

    const result = discoverProjectRoot(nested);
    expect(result).toBe(root);
  });

  it("returns null when no project found", async () => {
    // root has no .story/config.json
    const result = discoverProjectRoot(root);
    expect(result).toBeNull();
  });

  it("CLAUDESTORY_PROJECT_ROOT env var overrides walk-up", async () => {
    // Create project at root
    await mkdir(join(root, ".story"), { recursive: true });
    await writeFile(
      join(root, ".story", "config.json"),
      JSON.stringify({ version: 2, project: "test", type: "npm", language: "ts", features: { tickets: true, issues: true, handovers: true, roadmap: true, reviews: true } }),
    );

    // Create a different project
    const other = await mkdtemp(join(tmpdir(), "storybloq-other-"));
    await mkdir(join(other, ".story"), { recursive: true });
    await writeFile(
      join(other, ".story", "config.json"),
      JSON.stringify({ version: 2, project: "other", type: "npm", language: "ts", features: { tickets: true, issues: true, handovers: true, roadmap: true, reviews: true } }),
    );

    process.env.CLAUDESTORY_PROJECT_ROOT = other;
    const result = discoverProjectRoot(root);
    expect(result).toBe(other);

    await rm(other, { recursive: true, force: true });
  });

  it("returns null when env var points to invalid path", async () => {
    process.env.CLAUDESTORY_PROJECT_ROOT = join(root, "nonexistent");
    const result = discoverProjectRoot(root);
    expect(result).toBeNull();
  });
});
