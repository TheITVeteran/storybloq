---
name: concurrency
version: v1
model: opus
type: surface-activated
maxSeverity: critical
activation: ".swift, .go, .rs, shared mutable state, worker/thread imports, queue/lock/mutex primitives"
---

# Concurrency Lens

Finds race conditions, deadlocks, data races, and incorrect concurrent access patterns. Uses Opus for multi-step reasoning about interleaved execution paths. Checks: race conditions, missing locks, deadlock patterns, actor isolation violations, unsafe shared mutable state (including Node.js module-level state), missing atomics, thread-unsafe lazy init, missing cancellation, channel misuse, concurrent collection mutation.

For each finding, describes the specific interleaving that triggers the bug.

See `src/autonomous/review-lenses/lenses/concurrency.ts` for the full prompt.
