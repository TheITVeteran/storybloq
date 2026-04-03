---
name: error-handling
version: v1
model: sonnet
type: core
maxSeverity: critical
---

# Error Handling Lens

Ensures failures are anticipated, caught, communicated, and recovered from. Checks: missing try/catch on I/O, unhandled promise rejections, swallowed errors, missing null checks, no graceful degradation, leaking internals, missing cleanup, unchecked array access, missing error propagation, inconsistent error types.

Verifies TypeScript strict mode before flagging type-guaranteed values. Checks RULES.md for established error patterns.

See `src/autonomous/review-lenses/lenses/error-handling.ts` for the full prompt.
