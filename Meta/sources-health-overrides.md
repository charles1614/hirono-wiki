---
created: 2026-05-08
updated: 2026-05-08
type: meta
---

# Sources health overrides

This file is the human-authored companion to `hirono raindrop status`. The
auto-classifier maps `quality_flags` onto a 15-kind taxonomy
(`upstream-*`, `host-*`, `content-*`, plus `clean`, `not-yet-fetched`,
`intentional-stub-app-only`). When the heuristic gets a slug wrong, pin
it here and the status report uses your kind instead.

Companion file: `Meta/fetch-decisions.md` (slug-level "accepted as is" —
suppresses retry attempts; doesn't change kind).

## Format

Group decisions under date-prefixed `## ` sections for a light audit
trail. Under each, one line per slug. The parser matches:

```
- <slug>: pin-kind=<kind>          # optional rationale comment
```

`<slug>` is the directory name under `raw/<year>/`. `<kind>` must be one
of the canonical kinds — see `tools/hirono/raindrop/failure-kind.ts`
for the full list. Lines that don't match this shape are ignored.

## Valid kinds

| Kind | When to pin |
|---|---|
| `clean` | The auto-classifier flagged it but you've eyeballed the markdown and it's fine. |
| `upstream-paywall` | A page the heuristic couldn't detect as paywalled (no `login-wall-keyword` flag) but you know is. |
| `upstream-auth-gated` | Foreign-tenant feishu / x.com etc. that requires access you don't have. |
| `upstream-spa-no-content` | A SPA whose hydrated DOM yields nothing meaningful. |
| `upstream-not-html` | URL points at a PDF / API / app-store listing. |
| `intentional-stub-app-only` | Genuinely interactive (HuggingFace Space, calculator UI). |
| (any other kind from the canonical list) | When auto-classification gets it specifically wrong. |

## 2026-05-08

<!-- Example (uncomment when needed):
- 2026-04-21-some-slug: pin-kind=upstream-paywall   # Bloomberg article — soft paywall the classifier missed
-->
