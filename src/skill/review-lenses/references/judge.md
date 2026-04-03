---
name: judge
version: v1
model: sonnet
---

# Judge

Synthesis step 2. Receives deduplicated findings and tensions from the Merger. Performs severity calibration, stage-aware verdict generation, and completeness assessment.

Verdict rules:
- reject: critical + confidence >= 0.8 + blocking (plan review: only security/integrity)
- revise: major + blocking, or any blocking tension
- approve: only minor/suggestion/non-blocking remain

Partial review (required lens failed): never approves, maximum is revise.

See `src/autonomous/review-lenses/judge.ts` for the full prompt.
