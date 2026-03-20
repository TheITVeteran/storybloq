import { describe, it, expect } from "vitest";
import { handleHandoverList, handleHandoverLatest, handleHandoverGet } from "../../../src/cli/commands/handover.js";
import { ExitCode } from "../../../src/core/output-formatter.js";
import { makeState } from "../../core/test-factories.js";
import type { CommandContext } from "../../../src/cli/run.js";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function makeCtx(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    state: makeState(),
    warnings: [],
    root: "/tmp/test",
    handoversDir: "/tmp/test/.story/handovers",
    format: "md",
    ...overrides,
  };
}

describe("handleHandoverList", () => {
  it("returns handover filenames", () => {
    const ctx = makeCtx({
      state: makeState({ handoverFilenames: ["2026-03-19-session.md", "2026-03-18-session.md"] }),
    });
    const result = handleHandoverList(ctx);
    expect(result.output).toContain("2026-03-19-session.md");
    expect(result.output).toContain("2026-03-18-session.md");
  });

  it("returns empty message when no handovers", () => {
    const ctx = makeCtx();
    const result = handleHandoverList(ctx);
    expect(result.output).toContain("No handovers");
  });

  it("returns valid JSON", () => {
    const ctx = makeCtx({
      format: "json",
      state: makeState({ handoverFilenames: ["2026-03-19-session.md"] }),
    });
    const result = handleHandoverList(ctx);
    const parsed = JSON.parse(result.output);
    expect(parsed.version).toBe(1);
    expect(parsed.data).toContain("2026-03-19-session.md");
  });
});

describe("handleHandoverLatest", () => {
  it("returns latest handover content", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "handover-test-"));
    const handoversDir = join(tmpDir, "handovers");
    await mkdir(handoversDir, { recursive: true });
    await writeFile(join(handoversDir, "2026-03-19-session.md"), "# Session Notes\nHello world");

    const ctx = makeCtx({
      state: makeState({ handoverFilenames: ["2026-03-19-session.md"] }),
      handoversDir,
    });
    const result = await handleHandoverLatest(ctx);
    expect(result.output).toContain("Hello world");
  });

  it("returns not_found when no handovers", async () => {
    const ctx = makeCtx();
    const result = await handleHandoverLatest(ctx);
    expect(result.output).toContain("not_found");
    expect(result.exitCode).toBe(ExitCode.USER_ERROR);
  });
});

describe("handleHandoverGet", () => {
  it("returns specific handover content", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "handover-test-"));
    const handoversDir = join(tmpDir, "handovers");
    await mkdir(handoversDir, { recursive: true });
    await writeFile(join(handoversDir, "2026-03-19-session.md"), "# My Session");

    const ctx = makeCtx({ handoversDir });
    const result = await handleHandoverGet("2026-03-19-session.md", ctx);
    expect(result.output).toContain("My Session");
  });

  it("returns not_found for missing file", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "handover-test-"));
    const handoversDir = join(tmpDir, "handovers");
    await mkdir(handoversDir, { recursive: true });

    const ctx = makeCtx({ handoversDir });
    const result = await handleHandoverGet("nonexistent.md", ctx);
    expect(result.output).toContain("not_found");
    expect(result.exitCode).toBe(ExitCode.USER_ERROR);
  });

  it("returns JSON for handover content", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "handover-test-"));
    const handoversDir = join(tmpDir, "handovers");
    await mkdir(handoversDir, { recursive: true });
    await writeFile(join(handoversDir, "2026-03-19-session.md"), "content here");

    const ctx = makeCtx({ handoversDir, format: "json" });
    const result = await handleHandoverGet("2026-03-19-session.md", ctx);
    const parsed = JSON.parse(result.output);
    expect(parsed.data.filename).toBe("2026-03-19-session.md");
    expect(parsed.data.content).toBe("content here");
  });
});
