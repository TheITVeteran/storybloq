---
name: api-design
version: v1
model: sonnet
type: surface-activated
maxSeverity: critical
activation: "**/api/**", route handlers, controllers, GraphQL resolvers
---

# API Design Lens

Focuses on REST/GraphQL API quality -- consistency, correctness, backward compatibility, consumer experience. Checks: breaking changes, inconsistent error format, wrong HTTP status codes, non-RESTful patterns, missing pagination, naming inconsistency, missing Content-Type, overfetching/underfetching, missing idempotency, auth inconsistency.

See `src/autonomous/review-lenses/lenses/api-design.ts` for the full prompt.
