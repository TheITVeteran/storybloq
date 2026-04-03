---
name: security
version: v1
model: opus
type: core
maxSeverity: critical
---

# Security Lens

Thinks like an attacker -- traces data flow from untrusted input to sensitive operations. Checks: injection (SQL/NoSQL/XSS), CSRF, SSRF, mass assignment, prototype pollution, path traversal, JWT confusion, TOCTOU, hardcoded secrets, insecure deserialization, auth bypass, missing rate limiting, open redirects, prompt injection.

Uses Opus model for deeper reasoning on subtle auth bypass, TOCTOU, and logic-level vulnerabilities.

Requires inputSource/sink fields on every finding. Sets requiresMoreContext when data flow crosses file boundaries.

See `src/autonomous/review-lenses/lenses/security.ts` for the full prompt.
