---
name: test-quality
version: v1
model: sonnet
type: surface-activated
maxSeverity: major
activation: "test files changed, or source files changed without corresponding test changes"
---

# Test Quality Lens

Finds patterns that reduce test reliability, coverage, and signal. Checks: missing assertions, testing implementation not behavior, flaky patterns, missing edge cases, over-mocking, no error path tests, missing integration tests, snapshot abuse, test data coupling, missing cleanup, missing test coverage for changed source files.

When activated by "source-changed-no-tests", primary focus shifts to identifying untested source files.

See `src/autonomous/review-lenses/lenses/test-quality.ts` for the full prompt.
