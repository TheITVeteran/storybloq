---
name: performance
version: v1
model: sonnet
type: surface-activated
maxSeverity: critical
activation: ORM imports, nested loops >= 2, files > 300 lines, hotPaths config
---

# Performance Lens

Finds patterns causing measurable performance degradation at realistic scale. Checks: N+1 queries, missing indexes, unbounded result sets, sync I/O in hot paths, memory leaks, unnecessary re-renders, large bundle imports, missing memoization, O(n^2+) algorithms, missing pagination.

Does NOT flag: micro-optimizations, test code performance, premature optimization for infrequent code.

See `src/autonomous/review-lenses/lenses/performance.ts` for the full prompt.
