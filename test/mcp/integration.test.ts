import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, rm, cp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runMcpReadTool } from "../../src/mcp/tools.js";

// Handler imports
import { handleStatus } from "../../src/cli/commands/status.js";
import { handleTicketGet } from "../../src/cli/commands/ticket.js";
import { handlePhaseList } from "../../src/cli/commands/phase.js";
import { handleIssueList } from "../../src/cli/commands/issue.js";
import { handleHandoverList, handleHandoverLatest } from "../../src/cli/commands/handover.js";
import { handleValidate } from "../../src/cli/commands/validate.js";
import { handleBlockerList } from "../../src/cli/commands/blocker.js";
import { initProject } from "../../src/core/init.js";

const FIXTURES_DIR = join(import.meta.dirname, "..", "fixtures", "valid", "basic");

describe("MCP integration — real filesystem", () => {
  const tmpDirs: string[] = [];
  afterEach(async () => {
    for (const d of tmpDirs) await rm(d, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  async function setupProject(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "mcp-int-"));
    tmpDirs.push(dir);
    // Copy fixture .story/ to temp dir
    await cp(FIXTURES_DIR, join(dir, ".story"), { recursive: true });
    return dir;
  }

  it("claudestory_status — full pipeline", async () => {
    const root = await setupProject();
    const result = await runMcpReadTool(root, handleStatus);
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Phase");
  });

  it("claudestory_ticket_get — valid ticket", async () => {
    const root = await setupProject();
    const result = await runMcpReadTool(root, (ctx) => handleTicketGet("T-001", ctx));
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBeDefined();
  });

  it("claudestory_ticket_get — not found (informational, not isError)", async () => {
    const root = await setupProject();
    const result = await runMcpReadTool(root, (ctx) => handleTicketGet("T-999", ctx));
    // not_found is informational — NOT isError
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("not found");
  });

  it("claudestory_phase_list — lists phases", async () => {
    const root = await setupProject();
    const result = await runMcpReadTool(root, handlePhaseList);
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text.length).toBeGreaterThan(0);
  });

  it("claudestory_issue_list — lists issues", async () => {
    const root = await setupProject();
    const result = await runMcpReadTool(root, (ctx) =>
      handleIssueList({}, ctx),
    );
    expect(result.isError).toBeUndefined();
  });

  it("claudestory_validate — validates project", async () => {
    const root = await setupProject();
    const result = await runMcpReadTool(root, handleValidate);
    expect(result.isError).toBeUndefined();
  });

  it("claudestory_blocker_list — lists blockers", async () => {
    const root = await setupProject();
    const result = await runMcpReadTool(root, handleBlockerList);
    expect(result.isError).toBeUndefined();
  });

  it("claudestory_handover_list — lists handovers", async () => {
    const root = await setupProject();
    const result = await runMcpReadTool(root, handleHandoverList);
    expect(result.isError).toBeUndefined();
  });

  it("no project root → ProjectLoaderError (isError: true)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-noproject-"));
    tmpDirs.push(dir);
    const result = await runMcpReadTool(dir, handleStatus);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^\[.+\]/); // plain text with [code] prefix
  });

  it("corrupt ticket JSON → permissive load, warning prefix", async () => {
    const root = await setupProject();
    // Write a corrupt ticket file
    await writeFile(
      join(root, ".story", "tickets", "T-BAD.json"),
      "{ not valid json }}",
    );
    const result = await runMcpReadTool(root, handleStatus);
    // Permissive load: succeeds with warning prefix
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Warning:");
    expect(result.content[0].text).toContain("data integrity issues");
  });

  it("corrupt config.json → ProjectLoaderError (isError: true)", async () => {
    const root = await setupProject();
    // Overwrite config with invalid JSON
    await writeFile(
      join(root, ".story", "config.json"),
      "not json at all",
    );
    const result = await runMcpReadTool(root, handleStatus);
    expect(result.isError).toBe(true);
  });

  it("handover_latest with handovers present", async () => {
    const root = await setupProject();
    // Create a handover file
    const handoverDir = join(root, ".story", "handovers");
    await mkdir(handoverDir, { recursive: true });
    await writeFile(
      join(handoverDir, "2026-03-20-test.md"),
      "# Test Handover\n\nThis is test content.",
    );
    const result = await runMcpReadTool(root, handleHandoverLatest);
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Test Handover");
  });

  it("handover_latest with no handovers → not_found (informational)", async () => {
    // Use a fresh project without handovers (not the fixture which has one)
    const dir = await mkdtemp(join(tmpdir(), "mcp-nohandover-"));
    tmpDirs.push(dir);
    await initProject(dir, { name: "test" });
    const result = await runMcpReadTool(dir, handleHandoverLatest);
    // not_found is informational, not isError
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("No handovers");
  });
});

describe("MCP integration — root pinning", () => {
  const tmpDirs: string[] = [];
  afterEach(async () => {
    for (const d of tmpDirs) await rm(d, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  it("rejects non-existent root path", async () => {
    const result = await runMcpReadTool(
      "/tmp/definitely-does-not-exist-claudestory",
      handleStatus,
    );
    expect(result.isError).toBe(true);
  });

  it("works with env var-provided root", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-envroot-"));
    tmpDirs.push(dir);
    await cp(FIXTURES_DIR, join(dir, ".story"), { recursive: true });
    // runMcpReadTool takes root directly — env var is handled by the entry point
    const result = await runMcpReadTool(dir, handleStatus);
    expect(result.isError).toBeUndefined();
  });
});
