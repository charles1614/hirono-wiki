---
created: 2026-04-19
updated: 2026-04-19
type: meta
---

# Schema — conventions for this wiki

This document is the **governance layer**. It binds how the LLM and humans write pages here. When in doubt, follow this doc literally; if a convention feels wrong, change it here first, then update pages.

## Page types

Every page declares its `type` in frontmatter. Four types:

| Type | Lives in | Purpose |
|---|---|---|
| `source` | `Sources/YYYY/` | Summary of one ingested raw source (Raindrop bookmark, Space 1 node, URL) |
| `entity` | `Entities/` or `Entities/_seen/` | A person, project, paper, product, model, company |
| `topic` | `Topics/` | Synthesis across multiple sources; answers to questions; cross-cutting themes |
| `meta` | `Meta/` | Schema, index, log, linting notes |

## Frontmatter spec

Every doc starts with YAML frontmatter. Required for all:

```yaml
---
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: source | entity | topic | meta
---
```

**Sources** additionally require `raw_source:` and may include `tags:`:

```yaml
raw_source: https://example.com/article            # or lark://docx/...
tags: [rl, infra]                                   # optional
highlights: true                                    # raindrop highlighted subset
```

**Entities** additionally track reference count (auto-maintained by `tools/reindex.ts`):

```yaml
refs: 2                # number of source pages that link here
tier: seen | active    # seen = Entities/_seen/, active = Entities/
```

**Topics** may declare `source_count`:

```yaml
source_count: 7
```

Frontmatter is **local-only** — the preprocessor strips it on upload and renders it as a visible Meta callout at the top of the Lark doc.

## Wikilinks

Use `[[Slug]]` syntax, Obsidian-compatible. Resolution is by **slug** (file basename without `.md`), unique across the whole repo.

- `[[Megatron]]` → resolves to `Entities/Megatron.md` or `Entities/_seen/Megatron.md`
- `[[2026-04-19-aws-trainium3]]` → resolves to `Sources/2026/2026-04-19-aws-trainium3.md`
- `[[Training Infrastructure]]` → resolves to `Topics/Training Infrastructure.md`

The preprocessor rewrites `[[X]]` to a Lark `<mention>` node on upload, creating empty stubs in Lark if the target doesn't exist yet.

**Collision rule**: a slug is unique across the entire repo. If a new entity would collide with a topic, disambiguate with a suffix: `Megatron (company).md` vs `Megatron (framework).md`.

## Source page structure

File name: `Sources/YYYY/YYYY-MM-DD-<slug>.md`. Slug = kebab-case of title, English, ≤ 60 chars.

Body template:

```markdown
---
created: 2026-04-19
updated: 2026-04-19
type: source
raw_source: <URL>
tags: [optional, tags]
---

# [2026-04-19] Human Title

## TL;DR

2–3 sentence summary. What's the one thing this source says?

## Key claims

- Claim one. — bullet form, atomic.
- Claim two.
- Claim three.

## Entities touched

[[Megatron]], [[NVIDIA]], [[DeepMind]]

## Topics touched

[[Training Infrastructure]], [[Distributed Training]]

## Open questions

- Question the source raises but doesn't answer.

## Raw source

<URL or lark://docx/...>
```

## Entity page structure

File name: `Entities/<Name>.md` (or `Entities/_seen/<Name>.md` while 1–2 refs).

```markdown
---
created: 2026-04-19
updated: 2026-04-19
type: entity
refs: 3
tier: active
---

# Name

One-line kind: "GPU-era training framework by NVIDIA", "LLM research lab", etc.

## Synthesis

*Regenerated on demand from Observations below. Summarizes what we know.*

## Observations

- First observation. — [[Sources/2026-04-19-aws-trainium3]]
- Second observation. — [[Sources/2026-01-15-megatron-paper]]
- …
```

**Key rule**: Observations are **append-only** and every bullet cites its source. The Synthesis is regenerated from Observations; it is derived data. This makes contradictions visible (they appear as conflicting Observations) and keeps all claims attributable.

## Topic page structure

```markdown
---
created: 2026-04-19
updated: 2026-04-19
type: topic
source_count: 3
---

# Topic

## What

One paragraph: what this topic is, why it's worth a page.

## Current understanding

Synthesis across sources. Freely revised. Cite with [[Sources/...]].

## Open threads

- Things unresolved across sources.

## Sources drawn on

- [[Sources/2026-04-19-aws-trainium3]] — one-line relevance
- [[Sources/...]]
```

## Log entry format

`Meta/log-YYYY.md`, entries **prepended** (newest first). Three entry types:

```markdown
## [2026-04-19] ingest | AWS Trainium3 Deep Dive
- Source: [[Sources/2026-04-19-aws-trainium3]]
- Entities: [[AWS]], [[Trainium]]
- Topics: [[Accelerator Economics]]
- New pages: [[Entities/Trainium]] (_seen), [[Topics/Accelerator Economics]]

## [2026-04-19] query | What do I know about Megatron?
- Answer: [[Topics/Megatron review 2026-04-19]]
- Sources cited: [[Sources/2026-01-15-megatron-paper]], [[Sources/...]]

## [2026-04-19] refactor | Merge [[GPUs]] into [[Accelerators]]
- Reason: single-word "GPUs" too narrow; broadened to hardware class.
- Pages touched: 7 sources re-linked.
```

## Entity tiering rules

- **Tier "seen"** (`Entities/_seen/<Name>.md`): 1–2 incoming references (across the whole repo — sources, entities, topics, meta). Thin stub.
- **Tier "active"** (`Entities/<Name>.md`): ≥3 incoming references. Full entity page with Synthesis + Observations.
- **`refs` counts incoming wikilinks** from other pages (self-refs excluded). This matches Lark's graph-view semantics: tier reflects established-ness in the graph, not raw source citations.
- **Promotion** is automatic: `tools/reindex.ts` runs after every ingest (or on demand), recomputes `refs`, and when a `_seen` entity crosses the threshold, moves the file from `Entities/_seen/` to `Entities/` and rewrites `tier: active`. Wikilinks are slug-based, so no rewriting elsewhere is needed.
- **Demotion is not automatic** — once active, an entity stays active even if refs drop. (A `refactor |` log entry would document manual demotion.)

## Do / don't

- **Do** edit locally (here) or via chat with Claude.
- **Do** commit early, commit often — `git log` is the audit trail.
- **Do** use wikilinks generously. The graph is the point.
- **Don't** edit in Lark Space 2. Those edits are overwritten on next sync.
- **Don't** put math `$...$` inside headings (lark-hirono strips it).
- **Don't** nest callouts (lark-hirono flattens them).
- **Don't** rename a file without updating the log. A `refactor |` entry protects the audit trail.

## Raw source conventions

- **Raindrop**: `raw_source: https://raindrop.io/bookmark/<id>` or the underlying URL. Prefer the underlying URL for humans; include the Raindrop ID in a body line.
- **Lark Space 1**: `raw_source: lark://wiki/<space_id>/<node_token>` (custom scheme for unambiguous reference).
- **Arbitrary URL**: the URL itself.

URL normalization for dedup (see `tools/ingest.ts`): lowercase host, strip tracking params (`utm_*`, `ref`, `fbclid`), strip trailing slash, resolve xhslink.com and similar shorteners where feasible.
