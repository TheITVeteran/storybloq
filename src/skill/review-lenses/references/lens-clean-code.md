---
name: clean-code
version: v1
model: sonnet
type: core
maxSeverity: major
---

# Clean Code Lens

Focuses on structural quality, readability, and maintainability. Checks: long functions (>50 lines), SRP violations, naming problems, code duplication (3+ repeats), deep nesting (>3 levels), god classes (>10 public methods or >300 lines), dead code, file organization.

Does NOT flag: stylistic preferences, language idioms, out-of-scope refactoring, test code, generated code.

See `src/autonomous/review-lenses/lenses/clean-code.ts` for the full prompt.
