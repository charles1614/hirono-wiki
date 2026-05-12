---
created: 2026-05-12
updated: 2026-05-12
type: meta
---

# Sources ingest skip-list

**Last-resort registry of URLs / slugs that should NEVER be ingested.** This is NOT the default cleanup path for off-topic Sources — Karpathy's wiki ingests every URL in raw, and operator-curation happens at the Raindrop-bookmark layer. The skip-list is reserved for:

- **spam** — recurring spam URLs that show up via shared bookmarks but aren't worth curating.
- **duplicate** — the same content appears under multiple URLs; one is canonical, others are skip.
- **deprecated** — content the operator explicitly decides should never enter the wiki, even though the bookmark is present.
- **bookmarked-by-mistake** — a one-off accident the operator wants permanently shielded.
- **other** — anything else, with explanation in the rationale.

**Format** (one entry per line under any `## ` heading):

```
- <URL or slug> — skip-reason=<reason> · <free-text rationale>
```

The arrow is an em-dash (`—`). ASCII `--` is also accepted.

**To skip a URL**: hand-edit this file OR run `hirono raindrop forget <url-or-slug> --reason "..."` (operator-driven; the CLI appends to this file and cleans up local artifacts in one shot).

**To un-skip**: delete the line. Next `hirono raindrop fetch-all` will reconsider the URL.

## Entries

(none yet — operator adds via `hirono raindrop forget` or manual edit)
