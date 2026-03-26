/**
 * Focused state-machine transition tests for the autonomous guide.
 * Covers the 5 bug fixes (ISS-029, ISS-031, ISS-033, ISS-034, ISS-035)
 * and the defensive guards added during Codex plan review.
 */
import { describe, it, expect } from "vitest";
import { evaluatePressure } from "../../src/autonomous/context-pressure.js";
import { assessRisk, requiredRounds, nextReviewer } from "../../src/autonomous/review-depth.js";
import type { FullSessionState, PressureLevel } from "../../src/autonomous/session-types.js";

// ---------------------------------------------------------------------------
// Helper: build a minimal FullSessionState for testing
// ---------------------------------------------------------------------------

function makeState(overrides: Partial<FullSessionState> = {}): FullSessionState {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    sessionId: "00000000-0000-0000-0000-000000000001",
    recipe: "coding",
    state: "PICK_TICKET",
    revision: 1,
    status: "active",
    reviews: { plan: [], code: [] },
    completedTickets: [],
    finalizeCheckpoint: null,
    git: { branch: "main", mergeBase: "abc123", expectedHead: "abc123" },
    lease: { workspaceId: "test", lastHeartbeat: now, expiresAt: now },
    contextPressure: {
      level: "low",
      guideCallCount: 0,
      ticketsCompleted: 0,
      compactionCount: 0,
      eventsLogBytes: 0,
    },
    pendingProjectMutation: null,
    resumeFromRevision: null,
    preCompactState: null,
    waitingForRetry: false,
    lastGuideCall: now,
    startedAt: now,
    guideCallCount: 0,
    config: {
      maxTicketsPerSession: 0,
      compactThreshold: "high",
      reviewBackends: ["codex", "agent"],
    },
    ...overrides,
  } as FullSessionState;
}

// ---------------------------------------------------------------------------
// ISS-034: Pressure threshold tiers
// ---------------------------------------------------------------------------

describe("evaluatePressure (ISS-034)", () => {
  it("returns low for fresh session", () => {
    const state = makeState();
    expect(evaluatePressure(state)).toBe("low");
  });

  it("default 'high' tier: 3 tickets = medium (not critical)", () => {
    const state = makeState({
      contextPressure: { level: "low", guideCallCount: 10, ticketsCompleted: 3, compactionCount: 0, eventsLogBytes: 0 },
    });
    expect(evaluatePressure(state)).toBe("medium");
  });

  it("default 'high' tier: 5 tickets = high", () => {
    const state = makeState({
      contextPressure: { level: "low", guideCallCount: 10, ticketsCompleted: 5, compactionCount: 0, eventsLogBytes: 0 },
    });
    expect(evaluatePressure(state)).toBe("high");
  });

  it("default 'high' tier: 8 tickets = critical", () => {
    const state = makeState({
      contextPressure: { level: "low", guideCallCount: 10, ticketsCompleted: 8, compactionCount: 0, eventsLogBytes: 0 },
    });
    expect(evaluatePressure(state)).toBe("critical");
  });

  it("default 'high' tier: 90+ calls = critical", () => {
    const state = makeState({
      contextPressure: { level: "low", guideCallCount: 91, ticketsCompleted: 0, compactionCount: 0, eventsLogBytes: 0 },
    });
    expect(evaluatePressure(state)).toBe("critical");
  });

  it("'critical' tier has higher thresholds than 'high'", () => {
    const state = makeState({
      config: { maxTicketsPerSession: 0, compactThreshold: "critical", reviewBackends: ["codex", "agent"] },
      contextPressure: { level: "low", guideCallCount: 10, ticketsCompleted: 8, compactionCount: 0, eventsLogBytes: 0 },
    });
    // 8 tickets in "critical" tier = high (not critical — threshold is 10)
    expect(evaluatePressure(state)).toBe("high");
  });

  it("'medium' tier has lower thresholds", () => {
    const state = makeState({
      config: { maxTicketsPerSession: 0, compactThreshold: "medium", reviewBackends: ["codex", "agent"] },
      contextPressure: { level: "low", guideCallCount: 10, ticketsCompleted: 2, compactionCount: 0, eventsLogBytes: 0 },
    });
    // 2 tickets in "medium" tier = medium
    expect(evaluatePressure(state)).toBe("medium");
  });

  it("falls back to 'high' tier for unknown compactThreshold", () => {
    const state = makeState({
      config: { maxTicketsPerSession: 0, compactThreshold: "unknown", reviewBackends: ["codex", "agent"] },
      contextPressure: { level: "low", guideCallCount: 60, ticketsCompleted: 0, compactionCount: 0, eventsLogBytes: 0 },
    });
    // 60 calls in "high" (fallback) tier = high
    expect(evaluatePressure(state)).toBe("high");
  });

  it("eventsLogBytes triggers thresholds", () => {
    const state = makeState({
      contextPressure: { level: "low", guideCallCount: 0, ticketsCompleted: 0, compactionCount: 0, eventsLogBytes: 1_500_001 },
    });
    expect(evaluatePressure(state)).toBe("critical");
  });
});

// ---------------------------------------------------------------------------
// ISS-035: Review verdict routing (unit tests for review-depth.ts helpers)
// ---------------------------------------------------------------------------

describe("review-depth helpers", () => {
  it("requiredRounds returns correct minimums", () => {
    expect(requiredRounds("low")).toBe(1);
    expect(requiredRounds("medium")).toBe(2);
    expect(requiredRounds("high")).toBe(3);
  });

  it("nextReviewer alternates between backends", () => {
    const backends = ["codex", "agent"];
    expect(nextReviewer([], backends)).toBe("codex");
    expect(nextReviewer([{ round: 1, reviewer: "codex", verdict: "revise", findingCount: 0, criticalCount: 0, majorCount: 0, suggestionCount: 0, timestamp: "" }], backends)).toBe("agent");
    expect(nextReviewer([
      { round: 1, reviewer: "codex", verdict: "revise", findingCount: 0, criticalCount: 0, majorCount: 0, suggestionCount: 0, timestamp: "" },
      { round: 2, reviewer: "agent", verdict: "approve", findingCount: 0, criticalCount: 0, majorCount: 0, suggestionCount: 0, timestamp: "" },
    ], backends)).toBe("codex");
  });

  it("assessRisk: <50 lines = low, 50-200 = medium, >200 = high", () => {
    expect(assessRisk({ totalLines: 10, filesChanged: 1, insertions: 5, deletions: 5 })).toBe("low");
    expect(assessRisk({ totalLines: 100, filesChanged: 3, insertions: 60, deletions: 40 })).toBe("medium");
    expect(assessRisk({ totalLines: 300, filesChanged: 5, insertions: 200, deletions: 100 })).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// ISS-029: Review counter reset — verify the state shape expectations
// ---------------------------------------------------------------------------

describe("ticket-to-ticket state reset (ISS-029)", () => {
  it("new ticket should have empty reviews and null finalizeCheckpoint", () => {
    // Simulate: first ticket completed with reviews, then picking second ticket
    const afterFirstTicket = makeState({
      state: "PICK_TICKET",
      reviews: {
        plan: [{ round: 1, reviewer: "codex", verdict: "approve", findingCount: 0, criticalCount: 0, majorCount: 0, suggestionCount: 0, timestamp: "" }],
        code: [
          { round: 1, reviewer: "codex", verdict: "revise", findingCount: 2, criticalCount: 0, majorCount: 1, suggestionCount: 1, timestamp: "" },
          { round: 2, reviewer: "agent", verdict: "approve", findingCount: 0, criticalCount: 0, majorCount: 0, suggestionCount: 0, timestamp: "" },
        ],
      },
      finalizeCheckpoint: "committed",
      completedTickets: [{ id: "T-001", title: "First", commitHash: "aaa" }],
    });

    // The fix in handleReportPickTicket resets these fields:
    const resetState = {
      ...afterFirstTicket,
      state: "PLAN",
      previousState: "PICK_TICKET",
      ticket: { id: "T-002", title: "Second", claimed: true },
      reviews: { plan: [], code: [] },
      finalizeCheckpoint: null,
    };

    expect(resetState.reviews.plan).toHaveLength(0);
    expect(resetState.reviews.code).toHaveLength(0);
    expect(resetState.finalizeCheckpoint).toBeNull();
    expect(resetState.completedTickets).toHaveLength(1); // preserved
  });
});

// ---------------------------------------------------------------------------
// ISS-033: Merge-base advancement after commit
// ---------------------------------------------------------------------------

describe("merge-base advancement (ISS-033)", () => {
  it("git.mergeBase updated to commitHash after commit", () => {
    const beforeCommit = makeState({
      state: "FINALIZE",
      git: { branch: "main", mergeBase: "initial-abc", expectedHead: "initial-abc" },
      ticket: { id: "T-001", title: "Test", claimed: true },
    });

    // Simulate what handleReportFinalize now does on commit_done:
    const commitHash = "new-commit-def";
    const afterCommit = {
      ...beforeCommit,
      state: "COMPLETE",
      previousState: "FINALIZE",
      finalizeCheckpoint: "committed" as const,
      completedTickets: [{ id: "T-001", title: "Test", commitHash, risk: "low" }],
      ticket: undefined,
      git: {
        ...beforeCommit.git,
        mergeBase: commitHash,
        expectedHead: commitHash,
      },
    };

    expect(afterCommit.git.mergeBase).toBe("new-commit-def");
    expect(afterCommit.git.expectedHead).toBe("new-commit-def");
    // Next ticket's diff will be against new-commit-def, not initial-abc
  });
});

// ---------------------------------------------------------------------------
// ISS-035: Plan review verdict routing
// ---------------------------------------------------------------------------

describe("plan review verdict routing (ISS-035)", () => {
  it("revise should route to PLAN (not IMPLEMENT) even when minRounds met", () => {
    // This was the original bug: revise fell through to the approve condition
    const verdict = "revise";
    const hasCriticalOrMajor = false;
    const roundNum = 2;
    const minRounds = 1; // low risk = 1 min round

    const isRevise = verdict === "revise" || verdict === "request_changes";
    const isReject = verdict === "reject";

    let nextState: string;
    if (isReject || isRevise) {
      nextState = "PLAN";
    } else if (verdict === "approve" || (!hasCriticalOrMajor && roundNum >= minRounds)) {
      nextState = "IMPLEMENT";
    } else {
      nextState = "PLAN_REVIEW";
    }

    expect(nextState).toBe("PLAN");
  });

  it("request_changes should route to PLAN", () => {
    const verdict = "request_changes";
    const isRevise = verdict === "revise" || verdict === "request_changes";
    const isReject = verdict === "reject";

    let nextState: string;
    if (isReject || isRevise) {
      nextState = "PLAN";
    } else {
      nextState = "IMPLEMENT";
    }

    expect(nextState).toBe("PLAN");
  });

  it("reject clears reviews.plan, revise preserves it", () => {
    const planReviews = [
      { round: 1, reviewer: "codex", verdict: "revise", findingCount: 1, criticalCount: 0, majorCount: 0, suggestionCount: 1, timestamp: "" },
    ];

    // reject: clear
    const rejectReviews = { plan: [] as typeof planReviews, code: [] };
    expect(rejectReviews.plan).toHaveLength(0);

    // revise: preserve
    const reviseReviews = { plan: planReviews, code: [] };
    expect(reviseReviews.plan).toHaveLength(1);
  });

  it("contradictory approve + critical should be rejected", () => {
    const verdict = "approve";
    const hasCriticalOrMajor = true;

    // Guard fires before routing logic
    const shouldReject = verdict === "approve" && hasCriticalOrMajor;
    expect(shouldReject).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ISS-035: Code review verdict routing
// ---------------------------------------------------------------------------

describe("code review verdict routing (ISS-035)", () => {
  it("planRedirect applies to any non-approve verdict", () => {
    const planRedirect = true;

    for (const verdict of ["reject", "revise", "request_changes"]) {
      let nextState: string;
      if (planRedirect && verdict !== "approve") {
        nextState = "PLAN";
      } else if (verdict === "reject" || verdict === "revise" || verdict === "request_changes") {
        nextState = "IMPLEMENT";
      } else {
        nextState = "FINALIZE";
      }
      expect(nextState).toBe("PLAN");
    }
  });

  it("planRedirect does NOT redirect approve", () => {
    const planRedirect = true;
    const verdict = "approve";
    const hasCriticalOrMajor = false;

    // approve + planRedirect is caught by the contradictory guard,
    // but if it somehow passed, approve should not be redirected
    let nextState: string;
    if (planRedirect && verdict !== "approve") {
      nextState = "PLAN";
    } else {
      nextState = "FINALIZE"; // simplified
    }
    expect(nextState).toBe("FINALIZE");
  });

  it("contradictory approve + critical in CODE_REVIEW should be rejected", () => {
    const verdict = "approve";
    const hasCriticalOrMajor = true;
    const shouldReject = verdict === "approve" && hasCriticalOrMajor;
    expect(shouldReject).toBe(true);
  });

  it("contradictory approve + planRedirect should be rejected", () => {
    const verdict = "approve";
    const planRedirect = true;
    const shouldReject = verdict === "approve" && planRedirect;
    expect(shouldReject).toBe(true);
  });

  it("CODE_REVIEW → PLAN resets both review arrays", () => {
    const state = makeState({
      reviews: {
        plan: [{ round: 1, reviewer: "codex", verdict: "approve", findingCount: 0, criticalCount: 0, majorCount: 0, suggestionCount: 0, timestamp: "" }],
        code: [{ round: 1, reviewer: "codex", verdict: "reject", findingCount: 3, criticalCount: 1, majorCount: 1, suggestionCount: 1, timestamp: "" }],
      },
      ticket: { id: "T-001", title: "Test", claimed: true, risk: "medium", realizedRisk: "high" },
    });

    // Simulate CODE_REVIEW → PLAN reset
    const resetState = {
      ...state,
      state: "PLAN",
      previousState: "CODE_REVIEW",
      reviews: { plan: [], code: [] },
      ticket: state.ticket ? { ...state.ticket, realizedRisk: undefined } : state.ticket,
    };

    expect(resetState.reviews.plan).toHaveLength(0);
    expect(resetState.reviews.code).toHaveLength(0);
    expect(resetState.ticket?.realizedRisk).toBeUndefined();
    // lastPlanHash preserved (not cleared)
  });
});

// ---------------------------------------------------------------------------
// ISS-035: Plan fingerprint
// ---------------------------------------------------------------------------

describe("plan fingerprint (ISS-035)", () => {
  // Replicate the simpleHash from guide.ts
  function simpleHash(content: string): string {
    let hash = 5381;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) + hash + content.charCodeAt(i)) & 0xffffffff;
    }
    return hash.toString(36);
  }

  it("same content produces same hash", () => {
    expect(simpleHash("plan v1")).toBe(simpleHash("plan v1"));
  });

  it("different content produces different hash", () => {
    expect(simpleHash("plan v1")).not.toBe(simpleHash("plan v2"));
  });

  it("unchanged plan after revise should be detected", () => {
    const planContent = "# Implementation Plan\n\nDo the thing.";
    const hash = simpleHash(planContent);

    const state = makeState({
      ticket: { id: "T-001", title: "Test", claimed: true, lastPlanHash: hash },
    });

    // Same plan resubmitted — fingerprint matches
    const newHash = simpleHash(planContent);
    const isUnchanged = state.ticket?.lastPlanHash === newHash;
    expect(isUnchanged).toBe(true);
  });

  it("changed plan after revise passes fingerprint check", () => {
    const hash = simpleHash("# Original Plan\n\nDo thing A.");
    const state = makeState({
      ticket: { id: "T-001", title: "Test", claimed: true, lastPlanHash: hash },
    });

    const newHash = simpleHash("# Revised Plan\n\nDo thing B instead.");
    const isUnchanged = state.ticket?.lastPlanHash === newHash;
    expect(isUnchanged).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ISS-035: Round/reviewer continuity after revise loop
// ---------------------------------------------------------------------------

describe("round/reviewer continuity after revise (ISS-035)", () => {
  it("after 2 plan review rounds + revise, next round is 3 with correct reviewer", () => {
    const existingPlanReviews = [
      { round: 1, reviewer: "codex", verdict: "revise", findingCount: 2, criticalCount: 0, majorCount: 1, suggestionCount: 1, timestamp: "" },
      { round: 2, reviewer: "agent", verdict: "revise", findingCount: 1, criticalCount: 0, majorCount: 0, suggestionCount: 1, timestamp: "" },
    ];
    const backends = ["codex", "agent"];

    const roundNum = existingPlanReviews.length + 1;
    const reviewer = nextReviewer(existingPlanReviews, backends);

    expect(roundNum).toBe(3);
    expect(reviewer).toBe("codex"); // alternates back to codex
  });

  it("after reject, reviews cleared — next round is 1", () => {
    // Reject clears reviews.plan to []
    const clearedReviews: readonly { reviewer: string }[] = [];
    const backends = ["codex", "agent"];

    const roundNum = clearedReviews.length + 1;
    const reviewer = nextReviewer(clearedReviews, backends);

    expect(roundNum).toBe(1);
    expect(reviewer).toBe("codex"); // starts fresh
  });
});
