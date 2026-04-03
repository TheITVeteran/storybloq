---
name: accessibility
version: v1
model: sonnet
type: surface-activated
maxSeverity: major
scope: web-first
activation: ".tsx, .jsx, .html, .vue, .svelte, .css, .scss"
---

# Accessibility Lens

Finds WCAG compliance issues preventing users with disabilities from using the application. Web-first scope. Checks: missing alt text, non-semantic HTML, missing ARIA labels, no keyboard navigation, color contrast, missing focus management, skip-to-content, form labels, ARIA landmarks, auto-playing media, missing live regions, CSS focus removal, hidden-but-focusable elements.

Native mobile/desktop accessibility is out of scope for v1.

See `src/autonomous/review-lenses/lenses/accessibility.ts` for the full prompt.
