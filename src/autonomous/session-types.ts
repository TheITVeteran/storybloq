import { realpathSync } from "node:fs";

// ---------------------------------------------------------------------------
// Workflow states from N-005 v5.1 state machine
// ---------------------------------------------------------------------------

export type WorkflowState =
  | "INIT"
  | "LOAD_CONTEXT"
  | "PICK_TICKET"
  | "PLAN"
  | "PLAN_REVIEW"
  | "IMPLEMENT"
  | "CODE_REVIEW"
  | "FINALIZE"
  | "COMPACT"
  | "HANDOVER"
  | "COMPLETE"
  | "SESSION_END";

// ---------------------------------------------------------------------------
// Claude status derivation — exhaustive mapping
// ---------------------------------------------------------------------------

export type ClaudeStatus = "working" | "idle" | "waiting" | "unknown";

const WORKING_STATES: ReadonlySet<string> = new Set([
  "PLAN",
  "PLAN_REVIEW",
  "IMPLEMENT",
  "CODE_REVIEW",
  "FINALIZE",
  "COMPACT",
]);

const IDLE_STATES: ReadonlySet<string> = new Set([
  "INIT",
  "LOAD_CONTEXT",
  "PICK_TICKET",
  "HANDOVER",
  "COMPLETE",
  "SESSION_END",
]);

/**
 * Derives Claude's operational status from workflow state.
 * Pure function, no I/O.
 */
export function deriveClaudeStatus(
  state: string | undefined,
  waitingForRetry?: boolean,
): ClaudeStatus {
  if (waitingForRetry) return "waiting";
  if (!state) return "idle";
  if (WORKING_STATES.has(state)) return "working";
  if (IDLE_STATES.has(state)) return "idle";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Workspace ID — shared between hook-status (reader) and guide (writer)
// ---------------------------------------------------------------------------

/**
 * Derives a stable workspace ID from the project root path.
 * Uses realpathSync to resolve symlinks — deterministic across sessions.
 * T-119 may extend to include branch/worktree info.
 *
 * @throws {Error} If projectRoot does not exist or is not readable (ENOENT, EACCES).
 */
export function deriveWorkspaceId(projectRoot: string): string {
  return realpathSync(projectRoot);
}

// ---------------------------------------------------------------------------
// Session state — minimal shape that hook-status reads from state.json
// ---------------------------------------------------------------------------

export interface SessionState {
  readonly sessionId: string;
  readonly state: WorkflowState | string;
  readonly waitingForRetry?: boolean;
  readonly lastGuideCall?: string;
  readonly ticket?: {
    readonly id: string;
    readonly title: string;
    readonly risk?: string;
  };
  readonly completedTickets?: ReadonlyArray<{ readonly id: string }>;
  readonly contextPressure?: {
    readonly level: string;
  };
  readonly git?: {
    readonly branch?: string;
  };
  readonly lease?: {
    readonly workspaceId?: string;
    readonly expiresAt: string;
  };
}

// ---------------------------------------------------------------------------
// Status payload — written to .story/status.json by hook-status
// ---------------------------------------------------------------------------

export const CURRENT_STATUS_SCHEMA_VERSION = 1 as const;

export interface StatusPayloadActive {
  readonly schemaVersion: typeof CURRENT_STATUS_SCHEMA_VERSION;
  readonly sessionActive: true;
  readonly sessionId: string;
  readonly state: string;
  readonly ticket: string | null;
  readonly ticketTitle: string | null;
  readonly risk: string | null;
  readonly claudeStatus: ClaudeStatus;
  readonly observedAt: string;
  readonly lastGuideCall: string | null;
  readonly completedThisSession: readonly string[];
  readonly contextPressure: string;
  readonly branch: string | null;
  readonly source: "hook";
}

export interface StatusPayloadInactive {
  readonly schemaVersion: typeof CURRENT_STATUS_SCHEMA_VERSION;
  readonly sessionActive: false;
  readonly source: "hook";
}

export type StatusPayload = StatusPayloadActive | StatusPayloadInactive;
