---
name: merger
version: v1
model: sonnet
---

# Merger

Synthesis step 1. Receives all validated findings from all lenses. Performs semantic deduplication (using issueKey for deterministic matches + description similarity for cross-lens matches) and conflict identification (preserving tensions without auto-resolving).

Output: deduplicated findings + tensions + merge log.

See `src/autonomous/review-lenses/merger.ts` for the full prompt.
