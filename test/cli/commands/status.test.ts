import { describe, it, expect } from "vitest";
import { handleStatus } from "../../../src/cli/commands/status.js";
import { makeState, makeTicket, makeRoadmap, makePhase } from "../../core/test-factories.js";
import type { CommandContext } from "../../../src/cli/run.js";

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

describe("handleStatus", () => {
  it("returns formatted status for md", () => {
    const ctx = makeCtx({
      state: makeState({
        tickets: [makeTicket({ id: "T-001", phase: "p1" })],
        roadmap: makeRoadmap([makePhase({ id: "p1" })]),
      }),
    });
    const result = handleStatus(ctx);
    expect(result.output).toContain("Tickets:");
    expect(result.exitCode).toBeUndefined();
  });

  it("returns valid JSON for json format", () => {
    const ctx = makeCtx({ format: "json" });
    const result = handleStatus(ctx);
    expect(() => JSON.parse(result.output)).not.toThrow();
    const parsed = JSON.parse(result.output);
    expect(parsed.version).toBe(1);
    expect(parsed.data.project).toBe("test");
  });

  it("handles empty project", () => {
    const ctx = makeCtx();
    const result = handleStatus(ctx);
    expect(result.output).toContain("Tickets:");
    expect(result.output).toContain("0/0");
  });

  it("defaults to OK exit code", () => {
    const ctx = makeCtx();
    const result = handleStatus(ctx);
    expect(result.exitCode).toBeUndefined();
  });
});
