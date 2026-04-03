# Multi-Lens Review

The multi-lens review orchestrator runs 8 specialized review agents in parallel, each analyzing the same diff or plan through a focused perspective. Findings are deduplicated semantically by a merger, then calibrated and judged for a final verdict.

## When This Runs

The autonomous guide invokes lenses automatically when `reviewBackends` includes `"lenses"` during CODE_REVIEW or PLAN_REVIEW stages. You don't need to invoke this manually.

## Manual Invocation

For debugging or standalone use:

```
/story review-lenses
```

This reads the current diff and runs the full lens pipeline outside the autonomous guide.

## The 8 Lenses

**Core (always run):**
1. Clean Code -- structural quality, SRP, naming, duplication
2. Security -- OWASP top 10, injection, auth, secrets (Opus model)
3. Error Handling -- failure modes, missing catches, null safety

**Surface-activated (based on changed files):**
4. Performance -- N+1 queries, memory leaks, algorithmic complexity
5. API Design -- backward compat, REST conventions, error responses
6. Concurrency -- race conditions, deadlocks, actor isolation (Opus model)
7. Test Quality -- coverage gaps, flaky patterns, missing assertions
8. Accessibility -- WCAG, keyboard nav, screen reader support

## Synthesis Pipeline

1. **Merger** -- semantic dedup + conflict identification
2. **Judge** -- severity calibration + stage-aware verdict

## Configuration

In `.story/config.json` under `recipeOverrides`:

```json
{
  "reviewBackends": ["lenses", "codex"],
  "lensConfig": {
    "lenses": "auto",
    "maxLenses": 8,
    "hotPaths": ["src/engine/**"],
    "lensModels": {
      "default": "sonnet",
      "security": "opus"
    }
  }
}
```

## Prompt Files

Individual lens prompts are in `references/` in this directory. Each has a version in its filename (e.g., `lens-security-v1.md`). The orchestrator reads these and injects context variables.
