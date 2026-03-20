import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initProject } from "../../../src/core/init.js";
import { formatInitResult, formatError, ExitCode } from "../../../src/core/output-formatter.js";

describe("init command logic", () => {
  const tmpDirs: string[] = [];

  afterEach(async () => {
    for (const d of tmpDirs) {
      await rm(d, { recursive: true, force: true });
    }
    tmpDirs.length = 0;
  });

  it("creates .story/ directory with config and roadmap", async () => {
    const dir = await mkdtemp(join(tmpdir(), "init-test-"));
    tmpDirs.push(dir);
    const result = await initProject(dir, { name: "test-project" });
    expect(result.created).toContain(".story/config.json");
    expect(result.created).toContain(".story/roadmap.json");
    const s = await stat(join(dir, ".story"));
    expect(s.isDirectory()).toBe(true);
  });

  it("formats init result as md", async () => {
    const dir = await mkdtemp(join(tmpdir(), "init-test-"));
    tmpDirs.push(dir);
    const result = await initProject(dir, { name: "test-project" });
    const md = formatInitResult(result, "md");
    expect(md).toContain("config.json");
    expect(md).toContain("Initialized");
  });

  it("formats init result as json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "init-test-"));
    tmpDirs.push(dir);
    const result = await initProject(dir, { name: "test-project" });
    const json = formatInitResult(result, "json");
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.data.created).toContain(".story/config.json");
  });

  it("throws conflict when .story/ exists without --force", async () => {
    const dir = await mkdtemp(join(tmpdir(), "init-test-"));
    tmpDirs.push(dir);
    await initProject(dir, { name: "first" });
    await expect(initProject(dir, { name: "second" })).rejects.toThrow(".story/ already exists");
  });

  it("overwrites config/roadmap with --force", async () => {
    const dir = await mkdtemp(join(tmpdir(), "init-test-"));
    tmpDirs.push(dir);
    await initProject(dir, { name: "first" });
    const result = await initProject(dir, { name: "second", force: true });
    expect(result.created).toContain(".story/config.json");
  });

  it("warns about corrupt JSON files on --force", async () => {
    const dir = await mkdtemp(join(tmpdir(), "init-test-"));
    tmpDirs.push(dir);
    await initProject(dir, { name: "first" });
    // Write a corrupt JSON file into tickets/
    await writeFile(join(dir, ".story", "tickets", "T-099.json"), "{bad json");
    const result = await initProject(dir, { name: "second", force: true });
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("T-099.json");
  });

  it("warns about schema-invalid files on --force", async () => {
    const dir = await mkdtemp(join(tmpdir(), "init-test-"));
    tmpDirs.push(dir);
    await initProject(dir, { name: "first" });
    // Write valid JSON but schema-invalid ticket (missing required fields)
    await writeFile(join(dir, ".story", "tickets", "T-001.json"), '{"id":"T-001","title":"test"}');
    const result = await initProject(dir, { name: "second", force: true });
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("T-001.json");
  });

  it("returns empty warnings on --force with no corrupt files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "init-test-"));
    tmpDirs.push(dir);
    await initProject(dir, { name: "first" });
    const result = await initProject(dir, { name: "second", force: true });
    expect(result.warnings).toEqual([]);
  });

  it("returns empty warnings on fresh init", async () => {
    const dir = await mkdtemp(join(tmpdir(), "init-test-"));
    tmpDirs.push(dir);
    const result = await initProject(dir, { name: "test" });
    expect(result.warnings).toEqual([]);
  });
});
