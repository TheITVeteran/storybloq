import { describe, it, expect } from "vitest";
import {
  successEnvelope,
  errorEnvelope,
  partialEnvelope,
  escapeMarkdownInline,
  fencedBlock,
  formatStatus,
  formatPhaseList,
  formatTicket,
  formatNextTicketOutcome,
  formatTicketList,
  formatIssue,
  formatIssueList,
  formatValidation,
  formatBlockerList,
  formatError,
  formatInitResult,
} from "../../src/core/output-formatter.js";
import { makeTicket, makeIssue, makeState, makeRoadmap, makePhase } from "./test-factories.js";
import type { NextTicketOutcome } from "../../src/core/queries.js";
import type { ValidationResult } from "../../src/core/validation.js";

describe("envelopes", () => {
  it("successEnvelope wraps data with version 1", () => {
    const env = successEnvelope({ foo: "bar" });
    expect(env.version).toBe(1);
    expect(env.data).toEqual({ foo: "bar" });
  });

  it("errorEnvelope wraps code and message", () => {
    const env = errorEnvelope("not_found", "Ticket not found");
    expect(env.version).toBe(1);
    expect(env.error.code).toBe("not_found");
    expect(env.error.message).toBe("Ticket not found");
  });

  it("partialEnvelope includes warnings and partial flag", () => {
    const env = partialEnvelope({ data: 1 }, [
      { file: "test.json", message: "bad", type: "parse_error" },
    ]);
    expect(env.version).toBe(1);
    expect(env.partial).toBe(true);
    expect(env.warnings).toHaveLength(1);
  });
});

describe("escapeMarkdownInline", () => {
  it("escapes heading chars at line start", () => {
    expect(escapeMarkdownInline("# Title")).toContain("\\#");
  });

  it("escapes list chars at line start", () => {
    expect(escapeMarkdownInline("- item")).toContain("\\-");
    expect(escapeMarkdownInline("* bold")).toContain("\\*");
    expect(escapeMarkdownInline("+ list")).toContain("\\+");
  });

  it("escapes blockquote at line start (via HTML entity)", () => {
    const result = escapeMarkdownInline("> quote");
    // > is escaped as &gt; which prevents blockquote rendering
    expect(result).toContain("&gt;");
    expect(result).not.toMatch(/^>/);
  });

  it("escapes ordered lists", () => {
    const result = escapeMarkdownInline("1. item");
    expect(result).toContain("1\\.");
  });

  it("escapes inline structural chars", () => {
    const result = escapeMarkdownInline("use `code` and *bold*");
    expect(result).toContain("\\`");
    expect(result).toContain("\\*");
  });

  it("escapes brackets and parens (link injection)", () => {
    const result = escapeMarkdownInline("[click](http://evil.com)");
    expect(result).toContain("\\[");
    expect(result).toContain("\\(");
  });

  it("does not escape normal text", () => {
    expect(escapeMarkdownInline("Hello world")).toBe("Hello world");
  });

  it("handles multi-line text", () => {
    const result = escapeMarkdownInline("first\n# second");
    expect(result).toContain("\\#");
  });

  it("escapes HTML characters", () => {
    const result = escapeMarkdownInline("<script>alert('xss')</script>");
    expect(result).toContain("&lt;");
    expect(result).toContain("&gt;");
    expect(result).not.toContain("<script>");
  });

  it("escapes ampersands", () => {
    expect(escapeMarkdownInline("A & B")).toContain("&amp;");
  });

  it("handles empty string", () => {
    expect(escapeMarkdownInline("")).toBe("");
  });
});

describe("fencedBlock", () => {
  it("wraps content in triple backticks", () => {
    const result = fencedBlock("hello");
    expect(result).toBe("```\nhello\n```");
  });

  it("includes language specifier", () => {
    const result = fencedBlock("const x = 1;", "ts");
    expect(result).toBe("```ts\nconst x = 1;\n```");
  });

  it("handles content with triple backticks", () => {
    const result = fencedBlock("has ``` inside");
    // Should use 4 backticks as fence
    expect(result.startsWith("````")).toBe(true);
    expect(result.endsWith("````")).toBe(true);
  });
});

describe("formatStatus", () => {
  it("JSON returns valid parseable envelope", () => {
    const state = makeState({
      tickets: [makeTicket({ id: "T-001", phase: "p1", status: "complete" })],
      roadmap: makeRoadmap([makePhase({ id: "p1" })]),
    });
    const json = formatStatus(state, "json");
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.data.project).toBe("test");
    expect(parsed.data.completeTickets).toBe(1);
  });

  it("MD returns readable summary", () => {
    const state = makeState({
      tickets: [makeTicket({ id: "T-001", phase: "p1" })],
      roadmap: makeRoadmap([makePhase({ id: "p1" })]),
    });
    const md = formatStatus(state, "md");
    expect(md).toContain("Tickets:");
    expect(md).toContain("Phases");
  });
});

describe("formatPhaseList", () => {
  it("prefers Phase.summary over description", () => {
    const state = makeState({
      roadmap: makeRoadmap([
        makePhase({ id: "p1", description: "Long description here.", summary: "Short." }),
      ]),
    });
    const md = formatPhaseList(state, "md");
    expect(md).toContain("Short.");
  });

  it("truncates long description when no summary", () => {
    const longDesc = "A".repeat(120);
    const state = makeState({
      roadmap: makeRoadmap([makePhase({ id: "p1", description: longDesc })]),
    });
    const md = formatPhaseList(state, "md");
    expect(md).toContain("...");
    expect(md.length).toBeLessThan(longDesc.length + 100);
  });
});

describe("formatNextTicketOutcome", () => {
  it("formats found ticket with unblock impact", () => {
    const state = makeState({
      tickets: [
        makeTicket({ id: "T-001", phase: "p1", status: "open" }),
        makeTicket({ id: "T-002", phase: "p1", status: "open", blockedBy: ["T-001"] }),
      ],
      roadmap: makeRoadmap([makePhase({ id: "p1" })]),
    });
    const outcome: NextTicketOutcome = {
      kind: "found",
      ticket: state.tickets[0]!,
      unblockImpact: { ticketId: "T-001", wouldUnblock: [state.tickets[1]!] },
      umbrellaProgress: null,
    };
    const md = formatNextTicketOutcome(outcome, state, "md");
    expect(md).toContain("T-001");
    expect(md).toContain("Completing this unblocks");
    expect(md).toContain("T-002");
  });

  it("formats all_complete", () => {
    const state = makeState();
    const outcome: NextTicketOutcome = { kind: "all_complete" };
    const md = formatNextTicketOutcome(outcome, state, "md");
    expect(md).toContain("All phases complete");
  });

  it("formats all_blocked", () => {
    const state = makeState();
    const outcome: NextTicketOutcome = { kind: "all_blocked", phaseId: "p1", blockedCount: 3 };
    const md = formatNextTicketOutcome(outcome, state, "md");
    expect(md).toContain("blocked");
    expect(md).toContain("p1");
  });

  it("formats empty_project", () => {
    const state = makeState();
    const md = formatNextTicketOutcome({ kind: "empty_project" }, state, "md");
    expect(md).toContain("No phased tickets");
  });

  it("JSON is valid for all outcome types", () => {
    const state = makeState();
    for (const outcome of [
      { kind: "empty_project" } as NextTicketOutcome,
      { kind: "all_complete" } as NextTicketOutcome,
      { kind: "all_blocked", phaseId: "p1", blockedCount: 2 } as NextTicketOutcome,
    ]) {
      const json = formatNextTicketOutcome(outcome, state, "json");
      expect(() => JSON.parse(json)).not.toThrow();
    }
  });
});

describe("formatError", () => {
  it("JSON returns error envelope", () => {
    const json = formatError("not_found", "Ticket T-999 not found", "json");
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.error.code).toBe("not_found");
  });

  it("MD returns readable error", () => {
    const md = formatError("not_found", "Ticket T-999 not found", "md");
    expect(md).toContain("not_found");
    expect(md).toContain("T-999");
  });
});

describe("formatValidation", () => {
  it("shows error/warning/info counts", () => {
    const result: ValidationResult = {
      valid: false,
      errorCount: 2,
      warningCount: 1,
      infoCount: 0,
      findings: [
        { level: "error", code: "test", message: "Error 1", entity: "T-001" },
        { level: "error", code: "test", message: "Error 2", entity: "T-002" },
        { level: "warning", code: "test", message: "Warning 1", entity: null },
      ],
    };
    const md = formatValidation(result, "md");
    expect(md).toContain("Errors: 2");
    expect(md).toContain("Warnings: 1");
    expect(md).toContain("failed");
  });

  it("JSON is valid", () => {
    const result: ValidationResult = { valid: true, errorCount: 0, warningCount: 0, infoCount: 0, findings: [] };
    const json = formatValidation(result, "json");
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe("formatInitResult", () => {
  it("JSON is valid", () => {
    const json = formatInitResult({ root: "/tmp/test", created: [".story/config.json"] }, "json");
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("MD shows created files", () => {
    const md = formatInitResult({ root: "/tmp/test", created: [".story/config.json"] }, "md");
    expect(md).toContain("config.json");
  });
});

describe("all format functions produce valid JSON", () => {
  const state = makeState({
    tickets: [makeTicket({ id: "T-001", phase: "p1" })],
    issues: [makeIssue({ id: "ISS-001" })],
    roadmap: makeRoadmap([makePhase({ id: "p1" })]),
  });

  it("formatTicketList", () => {
    expect(() => JSON.parse(formatTicketList(state.tickets, "json"))).not.toThrow();
  });

  it("formatIssueList", () => {
    expect(() => JSON.parse(formatIssueList(state.issues, "json"))).not.toThrow();
  });

  it("formatBlockerList", () => {
    expect(() => JSON.parse(formatBlockerList(state.roadmap, "json"))).not.toThrow();
  });
});
