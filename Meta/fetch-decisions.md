---
created: 2026-04-20
updated: 2026-04-20
type: meta
---

# Fetch decisions — accepted-as-is exceptions

This file is the human-authored companion to `.wiki-fetch-issues.md` (which
is gitignored, append-only, machine-written). When a source repeatedly
comes back flagged and you've decided the flag is **not** fixable (e.g. the
xhs post is app-only, the newsletter is paywalled and you don't have a
subscription, the URL has genuinely rotted), list the slug here.

`hirono raindrop sync` reads this file and skips any listed slug on
subsequent runs — so repeat invocations don't keep retrying the same
lost causes. `hirono raindrop status` groups them under
"accepted-as-is exceptions" rather than "needs attention".

## Format

Group decisions under date-prefixed H2 sections for a light audit trail.
Under each H2, one line per slug. The parser matches:

```
- <slug> — <one-line rationale>
```

Everything above / below is human narrative — write as much context as you
want. The parser ignores anything that isn't a matching bullet line.

## Examples (delete once real entries arrive)

<!--
## 2026-04-21 · xhs app-only posts accepted as-is

- 2026-03-30-xhs-cuda-black-magic — xhs app-only URL; content gone; retain bookmark title only
- 2026-02-15-xhs-some-other-post — paywall / private account; title-only

## 2026-04-25 · paywalled newsletters

- 2026-04-22-stratechery-weekly — paywalled; only free excerpt captured; acceptable
-->

<!-- Real decisions go below. Keep the newest section at the top. -->
