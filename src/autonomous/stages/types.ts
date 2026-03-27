import type {
  ContextAdvice,
  FullSessionState,
  GuideReportInput,
} from "../session-types.js";
import { writeSessionSync, appendEvent } from "../session.js";
import { loadProject } from "../../core/project-loader.js";
import type { ProjectState } from "../../core/project-state.js";

// ---------------------------------------------------------------------------
// Stage result — returned by enter() when the stage needs Claude to act
// ---------------------------------------------------------------------------

export interface StageResult {
  readonly instruction: string;
  readonly reminders?: readonly string[];
  readonly contextAdvice?: ContextAdvice;
  readonly transitionedFrom?: string;
}

// ---------------------------------------------------------------------------
// Stage advance — returned by report() and optionally by enter()
// ---------------------------------------------------------------------------

export type StageAdvance =
  | { action: "advance" }
  | { action: "advance"; result: StageResult }
  | { action: "retry"; instruction: string; reminders?: readonly string[] }
  | { action: "back"; target: string; reason: string }
  | { action: "goto"; target: string }
  | { action: "goto"; target: string; result: StageResult };

// ---------------------------------------------------------------------------
// Type guard — discriminates StageResult from StageAdvance
// ---------------------------------------------------------------------------

export function isStageAdvance(value: StageResult | StageAdvance): value is StageAdvance {
  return "action" in value;
}

// ---------------------------------------------------------------------------
// Resolved recipe — frozen pipeline + config for a session
// ---------------------------------------------------------------------------

export interface ResolvedRecipe {
  readonly id: string;
  readonly pipeline: readonly string[];
  readonly postComplete: readonly string[];
  readonly stages: Readonly<Record<string, Record<string, unknown>>>;
  readonly dirtyFileHandling: string;
  readonly defaults: {
    readonly maxTicketsPerSession: number;
    readonly compactThreshold: string;
    readonly reviewBackends: readonly string[];
  };
}

// ---------------------------------------------------------------------------
// Stage context — stateful wrapper passed to stage enter/report methods
// ---------------------------------------------------------------------------

/**
 * StageContext is a CLASS, not a plain object. `ctx.state` is a getter that
 * always returns the latest snapshot after any writeState() call.
 * This prevents the walker from writing on a stale snapshot after stages
 * do multi-write operations (FINALIZE checkpoints, CODE_REVIEW→PLAN resets).
 */
export class StageContext {
  readonly root: string;
  readonly dir: string;
  readonly recipe: ResolvedRecipe;
  private _state: FullSessionState;

  constructor(root: string, dir: string, state: FullSessionState, recipe: ResolvedRecipe) {
    this.root = root;
    this.dir = dir;
    this._state = state;
    this.recipe = recipe;
  }

  /** Current session state — always reflects the latest writeState() call. */
  get state(): FullSessionState {
    return this._state;
  }

  /**
   * Write state updates atomically. Returns the written state with incremented revision.
   * Updates the internal snapshot so subsequent reads via `this.state` are consistent.
   */
  writeState(updates: Partial<FullSessionState>): FullSessionState {
    const merged = { ...this._state, ...updates } as FullSessionState;
    const written = writeSessionSync(this.dir, merged);
    this._state = written;
    return written;
  }

  /** Append a supplementary event to events.log. */
  appendEvent(type: string, data: Record<string, unknown>): void {
    appendEvent(this.dir, {
      rev: this._state.revision,
      type,
      timestamp: new Date().toISOString(),
      data,
    });
  }

  /** Load the .story/ project state (tickets, issues, roadmap). */
  async loadProject(): Promise<{ state: ProjectState }> {
    return loadProject(this.root);
  }
}

// ---------------------------------------------------------------------------
// Workflow stage interface
// ---------------------------------------------------------------------------

/**
 * A pipeline stage in the autonomous workflow.
 *
 * - `enter()` is called when the stage becomes active (after a transition).
 *   Returns StageResult (instruction for Claude) or StageAdvance (auto-advance,
 *   e.g. CompleteStage immediately routes to PICK_TICKET or HANDOVER).
 *
 * - `report()` is called when Claude reports back with results.
 *   Returns StageAdvance to indicate the next action.
 *
 * - `skip()` (optional) is called by the walker during pipeline traversal.
 *   If true, the walker skips this stage and advances to the next.
 */
export interface WorkflowStage {
  readonly id: string;
  enter(ctx: StageContext): Promise<StageResult | StageAdvance>;
  report(ctx: StageContext, report: GuideReportInput): Promise<StageAdvance>;
  skip?(ctx: StageContext): boolean;
}
