---
created: 2026-04-19
updated: 2026-04-21
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

**Sources** additionally require `raw_source:` and `tags:`:

```yaml
raw_source: https://example.com/article            # or lark://docx/...
tags: [rl, infra]                                   # ≥1 tag, lint-enforced
```

`tags:` is checked by `tools/bin/lint.ts` — Sources without at least one
tag fail lint. No controlled vocabulary at present (revisit at 100+ sources);
domain-descriptive kebab-case is the convention.

**Entities** additionally track reference count (auto-maintained by `tools/bin/reindex.ts`):

```yaml
refs: 2                # number of content pages (Sources+Entities+Topics) that wikilink here
tier: seen | active    # seen = Entities/_seen/, active = Entities/
```

Note: `refs` counts **all** content-page wikilinks (excluding Meta/ navigation files and self-refs). Matches the Lark graph-view notion of established-ness, not raw source citation count.

**Topics** may declare `source_count`:

```yaml
source_count: 7
```

Frontmatter is **local-only** — the preprocessor strips it on upload and renders it as a visible Meta callout at the top of the Lark doc.

**Two dates, distinct meanings**:
- `created:` / `updated:` (frontmatter) — when the WIKI page was written / last edited.
- `YYYY-MM-DD` prefix in `Sources/YYYY/YYYY-MM-DD-<slug>.md` — the SOURCE publication / capture date (per Raindrop bookmark `created` or the article's `<time>` element). A Source filed `2025-08-23-...` but frontmatter `created: 2026-05-11` is consistent — the source was published in 2025, we ingested it into the wiki on 2026-05-11.

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
tags: [at, least, one, tag]
---

# [2026-04-19] Human Title

## TL;DR

2–3 sentence summary. What's the one thing this source says?

## Key claims

- Claim one. — bullet form, atomic.
- Claim two.
- Claim three.

## Visual observations  ← optional

*Optional. Populate only when images carry information not already in the body text.
Heuristic: always for xhs / weixin / zhihu-image-heavy hosts; also for any source
where `body_chars < 2000` AND `image_count >= 3`; also for PDF sources when
figures change the claims.*

### Three-tier image rule

Every image in `raw/<host>/<slug>/...` falls into one of three buckets:

| Tier | When | Treatment in Source page |
|---|---|---|
| **Load-bearing** | The figure IS the claim — architecture diagrams, headline spec tables, the single chart that drives the paper's main argument | **Inline the image** at its Visual obs bullet, AND keep the textual finding |
| **Supporting** | Charts whose numbers you already extracted into Key Claims; methodology diagrams; verification-only material | Visual obs **bullet only**, no inline image |
| **Decorative** | Logos, event banners, avatars, hero images, sidebar graphics | **Skip silently** — don't even mention in Visual obs |

### Path convention

Inline images reference the **raw archive** by relative path; don't copy bytes
into `Sources/`. From `Sources/YYYY/<slug>.md`, the relative path is:

```
../../raw/raindrop/<host>/<slug>/<file>
```

Obsidian + Lark sync (via lark-hirono) both render this. The raw archive
remains the single canonical location for image bytes.

### Shape (load-bearing image)

```markdown
**Fig 3 — TPU spec progression** (`../../raw/raindrop/blog.google/<slug>/blog-google-img-003.webp`)

![TPU spec progression](../../raw/raindrop/blog.google/<slug>/blog-google-img-003.webp)

v4 / v5p / Ironwood spec table with absolute numbers. Pod size 4,096 → 8,960 → 9,216;
HBM 32 GB → 95 GB → 192 GB; TFLOPS/chip 275 → 459 → 4,614.
```

### Shape (supporting image — bullet only)

```markdown
- **Fig 13 — Post-init throughput chart** (`../../raw/raindrop/ai.meta.com/<slug>/default-img-013.png`) — SPDL @ 32 workers hits 7,700 FPS vs PyTorch's 6,500 FPS. (Numbers already in Key Claims; image is verification material.)
```

## What this changes  ← optional

*Optional. Include when the source's downstream-impact framing is genuinely
additive to Key claims (e.g. "first publicly-documented 4-bit pretraining run
matching FP8 quality" — that's a landscape claim, not a Key-claim restatement).
Skip when this would just paraphrase Key claims.*

- One or two bullets on what this source changes about the surrounding
  literature, the operator stack, or the design space. Cite Entities/Topics
  with `[[wikilinks]]` naturally inline; don't use a structural "Pairs with:"
  bullet — cross-links belong in `## Entities touched` / `## Topics touched`
  or as inline wikilinks in Key claims.

## Entities touched

[[Megatron]], [[NVIDIA]], [[DeepMind]]

## Topics touched

[[Training Infrastructure]], [[Distributed Training]]

## Raw source

<URL or lark://docx/...> — short prose with format, length, fetch date.
Source-specific provenance TODOs ("PDF not fetched; re-fetch /pdf/ URL to
unlock figures") also go here.
```

**Section order is load-bearing.** Pages SHOULD follow the order shown
above; reordering hurts scan-ability across the corpus. Optional sections
(`## Visual observations`, `## What this changes`) can be skipped, but
when present they go at the position shown. The order is not lint-enforced;
it's a convention.

### Source-page rules

**Reproduce load-bearing tables verbatim.** When a source's headline numbers
or structured comparison live in a table — a 3-generation spec progression,
a model × hardware benchmark grid, a feature × version matrix — inline-
reproduce that table in the Source page (under `## Key claims` or right
below). Paraphrasing into bullets loses the 2D structure that made the
table useful. Skip when the table is ≤ 2 rows OR the source itself already
expressed it as prose. Don't create a parallel "## Tables observed" section —
tables are text and integrate into Key Claims naturally; only their inline-
reproduction needs a discipline rule.

**Selective image-reading.** Don't enumerate every image in `raw/<slug>/`.
Most are chrome (avatars, badges, decorative). Pick 2–6 images per source that
*change the claims* and put each in `## Visual observations` with a one-sentence
factual observation. For PDF sources, prefer reading the preserved `<slug>.pdf`
directly over the per-page PNG renderings — same data, much cheaper.

**Citation discipline carries over.** A bullet in Visual observations is
content. If it makes a claim about an Entity, the Entity's Observations block
gets a corresponding bullet citing this Source. Same compounding rule as Key
Claims.

**Open questions don't live at the Source level.** Karpathy's pattern treats
unresolved questions as a lint-time / cross-cutting concern, and per-Source
sections don't compound — they're locked to a single page future-you won't
reopen. Route questions by type:

- **Source-specific re-fetch TODOs / provenance notes** → `## Raw source`
  footer (e.g. `"PDF not fetched; re-fetch with /pdf/ URL to unlock figures"`).
- **Cross-source research questions** → `Topics/<X>.md ## Open threads` (the
  Topic schema already has this section). When the same question gets asked
  by three sources, it's evidence the Topic page needs more synthesis.
- **Source-internal critique** ("authors assert X without justifying") →
  fold into the relevant `## Key claims` bullet as a continuation (`— authors
  don't justify why X; treated as a primitive`).
- **Filler** ("what's perf at scale?", "is it open-source?") → drop.

**`## What this changes` is optional.** Include it when the source carries
genuine landscape-shift framing additive to Key claims; skip when it would
just paraphrase. Light blog posts and small PRs usually don't need it;
substantive papers and announcements usually do.

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
- Source: [[2026-04-19-aws-trainium3-deep-dive]]
- Entities: [[AWS]], [[Trainium3]]
- Topics: [[Accelerator Economics]]
- New pages: [[Trainium3]] (_seen), [[Accelerator Economics]]

## [2026-04-19] query | What do I know about Megatron?
- Answer: [[Megatron review 2026-04-19]]
- Sources cited: [[2026-01-15-megatron-paper]]

## [2026-04-19] refactor | Merge [[GPUs]] into [[Accelerators]]
- Reason: single-word "GPUs" too narrow; broadened to hardware class.
- Pages touched: 7 sources re-linked.
```

**Wikilink syntax rule**: always use **bare slugs** — `[[Trainium3]]`, not `[[Entities/Trainium3]]`; `[[aws-trainium3-deep-dive]]`, not `[[Sources/aws-trainium3-deep-dive]]`. Paths are for the filesystem; wiki resolution is by unique slug. `tools/bin/lint.ts` flags path-style wikilinks as errors.

## Entity tiering rules

- **Tier "seen"** (`Entities/_seen/<Name>.md`): 1–2 incoming references (across the whole repo — sources, entities, topics, meta). Thin stub.
- **Tier "active"** (`Entities/<Name>.md`): ≥3 incoming references. Full entity page with Synthesis + Observations.
- **`refs` counts incoming wikilinks** from other pages (self-refs excluded). This matches Lark's graph-view semantics: tier reflects established-ness in the graph, not raw source citations.
- **Promotion** is automatic: `tools/bin/reindex.ts` runs after every ingest (or on demand), recomputes `refs`, and when a `_seen` entity crosses the threshold, moves the file from `Entities/_seen/` to `Entities/` and rewrites `tier: active`. Wikilinks are slug-based, so no rewriting elsewhere is needed.
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

URL normalization for dedup (see `tools/bin/build-sources-index.ts`): lowercase host, strip tracking params (`utm_*`, `ref`, `fbclid`), strip trailing slash.

## Raw-source archive layer

Per [[Karpathy]]'s invariant ("raw sources are immutable — the source of truth"), every `Sources/<slug>.md` summary has a paired local archive containing the full content we summarized from. This is what lets us re-ingest when conventions evolve and survives URL rot / provider disappearance.

### Structure (one dir per source)

```
raw/raindrop/<host>/<slug>/
    ├── content.md              # fetched article text in markdown
    ├── source.json             # fetch metadata (origin, ts, fetcher, quality flags, image manifest)
    ├── revisions.jsonl         # append-only audit trail; one row per fetch
    ├── <slug>.pdf              # preserved binary for PDF sources (arxiv, etc.)
    ├── <slug>-images/          # per-page PNG renderings for PDFs
    │   └── page-NNN.png
    └── <slug>-img-NNN.{png,jpg,…}  # localized web-source images, siblings of content.md
```

**Slug contract**: raw dir name = Source summary filename (minus `.md`). `tools/bin/lint.ts`'s `raw-orphan` check **lists** raw dirs not yet referenced by a Sources/ page — INFO-level (it's the ingest-ready inventory), not an error.

**Append-only audit trail**: `revisions.jsonl` gets a new row on every fetch (rev number, timestamp, content SHA, length, quality_status). On `hirono raindrop refetch`, the live `content.md` is overwritten with the new bytes by default, **but**:
- The previous rev's metadata is preserved in `revisions.jsonl`.
- The **downgrade-protection guard** (`isFetchRegression` in `tools/fetch-raw.ts`) refuses the write if the new fetch substantially regresses the previous — see [`corpus-pipeline.md`](corpus-pipeline.md) § "Backward edge: refetch regression" for the predicate.

### Operator commands

The canonical entry point is `tools/bin/hirono.ts`. See
[`operator-workflows.md`](operator-workflows.md) §Command reference for the
full surface (`refresh-cache`, `fetch`, `fetch-all`, `sync`, `refetch`,
`verify`, `status`, `history`, `diff`, `store`, `fetch-lark`, `export`,
`check`, `new`) and example flows. This file only governs the on-disk
page conventions; it does not duplicate the command catalog.

### Post-processors

Cross-cutting cosmetic cleanups live in `tools/sites/_shared/post-cleanup.ts`
as `applyPostCleanups()`. The current list is the source of truth — when
adapter-level fixes belong somewhere host-specific, they go in the host's
site module, not here. See [`CLAUDE.md`](../CLAUDE.md) §5 + the
post-cleanup.ts file itself for the live list (host-specific fixes belong
in `tools/sites/<host>/converter.ts`, NOT in the cross-cutting layer).

### Project-local opencli adapters

Custom opencli adapters live under `tools/opencli/clis/<site>/<name>.js`
(committed to the repo). `hirono doctor --fix` symlinks
`~/.opencli/clis/wiki-custom` to that directory so opencli discovers them
at invocation time. Makes the repo self-contained — `git clone` +
`hirono doctor --fix` is enough setup on a new machine.

**Cache file**:

`.wiki-raindrop-cache.json` (gitignored) is the Raindrop bookmark
snapshot. Refreshed by `hirono raindrop refresh-cache`. Read by
`hirono raindrop check` (for the full-corpus view) and
`hirono raindrop export <id>` (for ID-based lookup).

### Fetch pipeline entry points

The raw-archive lifecycle commands all live under `hirono raindrop`:

- `hirono raindrop fetch <url|slug|id> [--slug <slug>]` — fetches one URL via the routed site module.
- `hirono raindrop fetch-lark <node-token> --slug <slug>` — for Lark Space 1 nodes.
- `hirono raindrop store <slug> --origin <origin> --origin-url <url>` — stores pre-fetched content from stdin / `--input`; used by Claude when piping MCP output (Raindrop MCP is Claude-side).
- `hirono raindrop sync` / `refetch` / `verify` / `status` — incremental + ad-hoc operations.

The library lives at `tools/fetch-raw.ts`; the CLI handler shims at `tools/fetch-raw-handlers.ts`. The standalone `tools/bin/fetch-raw.ts` binary was removed when the pipeline was consolidated under `hirono`.

**Prerequisite** (one-time per workstation):
1. Install opencli Chrome extension (`opencli doctor` to verify `[OK] Extension: connected`)
2. Log into xiaohongshu.com, zhihu.com, mp.weixin.qq.com in that Chrome — adapters use cookie auth
3. For xhs specifically: URLs must include `xsec_token` query param (from the shared-link copy, not a manually-typed URL)

### Error escalation protocol (applies to v1 + every incremental ingest, forever)

The fetch pipeline classifies failures into three severity levels. Codified here so future sessions follow the same protocol.

**L1 — Auto-retry (transient, no user action):**

- `network-timeout`, `server-error` (5xx), `rate-limited-transient` (429 w/ Retry-After)

Exponential backoff 2s → 5s → 15s, up to 3 attempts. If still failing, escalate to L3.

**L2 — Queue-and-continue (known-unfixable, logged for weekly review):**

Codes: `dead-link` (404/410), `app-only-url` (xhs resolving to app), `raindrop-broken`, `empty-body`, `paywalled-partial`.

Action: write a stub `content.md` with whatever metadata we captured, append to `.wiki-fetch-issues.md`, mark the `ingest_batch` entry as `done` with `quality_flags`, continue. Source summary notes `content_complete: false` so lint/query treat with skepticism.

**L3 — Halt and ask user (fixable but needs action):**

Codes: `extension-offline`, `login-expired`, `captcha-required`, `ip-blocked` (429 without Retry-After), `parse-failure`, `opencli-timeout`, `opencli-error`.

Action: **nothing written to `raw/<slug>/`**. `ingest_batch` entry goes to `errored` with a structured `{ code, domain, remediation }` message. Batch exits non-zero. User handles (re-login / reconnect extension / wait out rate-limit / re-fetch a signed URL from the source app), then `tools/bin/ingest_batch.ts reset <id>` and rerun.

### `.wiki-fetch-issues.md` (gitignored, append-only)

Each L2 occurrence appends one line:

```
2026-04-20T12:34:56Z  app-only-url         raindrop:1664763106  http://xhslink.com/o/9AJZn5rYEHv
2026-04-20T12:35:10Z  short-body           raindrop:...         https://...
```

Review weekly: some entries accepted as-is (xhs app-only), some fixable retroactively (log into a paywalled newsletter, re-fetch). A future `tools/fetch-retry.ts` (deferred) would replay L2-flagged slugs.

### Content-complete flag on Source summaries

When an L2 flag fires, the Source summary's frontmatter should include:

```yaml
content_complete: false
quality_flags: [app-only-url]
```

Signals to query-loop and lint passes that this source's summary is based on partial raw data. Claude's ingest step is expected to surface this in the summary body (e.g., "Only the bookmark title was fetchable; full content is behind the Xiaohongshu app.").

### Quality tracking + idempotent sync

Every `raw/<slug>/source.json` carries a **`quality_status`** field — a coarse
three-level summary derived from `quality_flags`:

| status | meaning | typical cause |
|---|---|---|
| `good` | content fetched + no flags fired | normal happy path |
| `flagged` | raw saved, but at least one quality issue | login-wall, short-body, loading-skeleton, image-download-failed, xhs-download-silent-fail, images-declared-but-none-downloaded |
| `failed` | no usable content on disk at all | L3 abort; adapter never wrote content.md |

`quality_status` is what `hirono raindrop status` + `sync` dispatch on. Raw
`quality_flags` stay as the fine-grained signal for debugging / filtering.

#### Scan-able status view

```
tsx tools/bin/hirono.ts raindrop status
```

Walks `raw/` + reads `Meta/fetch-decisions.md`, re-classifies each slug (cheap
— just reads content.md), and groups output:

- **needs attention** — flagged or failed AND not listed in `fetch-decisions.md`. Each entry prints slug + flags + origin URL + one-line remediation hint.
- **accepted-as-is** — listed in `Meta/fetch-decisions.md`. Harmless; just audit.
- **good** — clean. Elided when list gets long (>20); set `FETCH_RAW_STATUS_QUIET=1` to hide entirely.

Exit code: 1 if anything in `needs attention`, 0 otherwise. Hook into CI / batch close like lint.

#### Idempotent re-fetch: `sync`

```
tsx tools/bin/hirono.ts raindrop sync [--limit N] [--retry-flagged] [--only <slug,...>] [--dry-run] [--verbose]
```

Walks `raw/` + `.wiki-batch-state.json` pending entries. For each candidate slug, decides:

| condition | action |
|---|---|
| slug in `fetch-decisions.md` | skip (accepted-as-is) |
| `quality_status = good` and no `--only` | skip |
| `quality_status = good` and in `--only` | fetch (forced) |
| `quality_status = flagged` and `--retry-flagged` not set | skip |
| `quality_status = flagged` and `--retry-flagged` set | fetch |
| `quality_status = failed` | fetch |
| new batch entry (pending, has slug, no raw/ dir yet) | fetch |
| new batch entry without slug | skip-no-origin (user must provide) |
| `--limit N` reached | skip-over-limit |

L3 errors during a fetch halt the whole sync (matches batch semantics).

Key invariants:
- Safe to re-run. First run drains all work; subsequent runs do zero work unless new candidates arrived or flagged slugs were requested.
- Always writes a fresh `source.json` (updated `quality_flags` + `quality_status` + `fetched_at`) on successful fetch.
- Preserves append-only: re-fetches land as `content-rev2.md`, `-rev3`, etc.

#### Force-refetch a single slug

```
tsx tools/bin/hirono.ts raindrop refetch <slug>
```

Reads `source.json` to get the origin, re-runs the fetcher. Useful after a
user-side fix (re-login, fresh xsec_token, paywall subscription acquired).

### `Meta/fetch-decisions.md` — accepted exceptions (gitted)

Sibling to `.wiki-fetch-issues.md` (the L2 append log). `fetch-decisions.md`
is **human-authored, gitted**, and captures decisions of the form "this flag
is not fixable — stop retrying it". Listed slugs are always skipped by
`sync` (even `--retry-flagged`) and grouped under "accepted-as-is" by
`status`.

Format: markdown with H2 date sections, bullet-per-decision:

```markdown
## 2026-04-21 · xhs app-only posts accepted as-is

- 2026-03-30-xhs-cuda-black-magic — xhs app-only URL; content gone; title-only
- 2026-02-15-xhs-other-post — paywall / private account

## 2026-04-25 · paywalled newsletters

- 2026-04-22-stratechery-weekly — paywalled; only free excerpt captured
```

Parser matches `- <slug> — <reason>` (em-dash, en-dash, or `--` accepted).
Anything else — H2 titles, narrative, HTML-commented examples — is ignored.

### v1 workflow including quality sync

```bash
# 1. Queue candidates for the batch
npx tsx ingest_batch.ts plan candidates-batch-1.json

# 2. Pre-fetch raw content for everything pending (idempotent — skips good)
npx tsx tools/bin/hirono.ts raindrop sync --limit 20

# 3. Check quality; fix any L3 issues the report names
npx tsx tools/bin/hirono.ts raindrop status

# 4. Retry anything that came back flagged after fixing issues
npx tsx tools/bin/hirono.ts raindrop sync --retry-flagged

# 5. Accept genuinely can't-fix cases by editing Meta/fetch-decisions.md
#    (then re-run status to confirm they moved to "accepted-as-is")

# 6. Run the LLM ingest loop — each item reads raw/<slug>/content.md
npx tsx ingest_batch.ts next
# ...LLM writes Sources/... → ingest_batch.ts mark-done...

# 7. Close the batch
npx tsx reindex.ts && npx tsx sync.ts up && npx tsx lint.ts
git commit -m "ingest: batch-1 (N sources)"
```

## Lint operation

Per Karpathy's three-operation model (ingest · query · lint), **lint** is a periodic health-check of the wiki's internal graph and structure. We do the mechanical parts in code, the judgment parts in session.

**Mechanical checks** (`tools/bin/lint.ts`, no LLM calls):

- `orphans` — entities/topics with 0 incoming content-page refs. WARN severity; may be intentional for query-loop synthesis pages.
- `dead-wikilinks` — `[[X]]` where slug X doesn't exist as a file. ERROR severity. Scope-excludes Meta/ by default (schema.md's own docstring examples would false-positive); pass `--include-meta` to audit Meta too. Fenced code blocks are never scanned.
- `tier-mismatch` — entity in `_seen/` with refs ≥ 3 (should be promoted), or entity in active tier with refs < 3 (investigate). Usually indicates reindex is overdue.
- `frontmatter` — missing required fields or wrong `type:` value for the bucket.

**Judgment-level checks** (LLM-invoked, session-local, not automated):

- Contradictions between observations on the same entity page
- Stale claims superseded by newer sources
- Concepts mentioned in prose that deserve their own entity/topic page
- Missing cross-references between topically-adjacent pages
- Data gaps suggesting a source-search query

**Cadence**:
- After every ingest → auto-run `lint.ts` (cheap; ~50ms on 50 docs).
- After every batch (v1 workflow) → `lint.ts` + a short LLM-invoked judgment pass.
- Weekly / on-demand → deep LLM lint across all entity pages for contradictions.

## Ingest pace + batching

Ingest is **session-scoped + supervised**, not autonomous bulk. Two paths,
either is valid:

- **Conversational** (preferred for small/curated runs, ≤ 10 sources):
  chat with Claude per slug — "ingest `<slug>`" — Claude reads
  `raw/raindrop/<host>/<slug>/content.md` (and `<slug>.pdf` when present),
  writes `Sources/YYYY/<slug>.md`, touches Entities + Topics, appends a
  log entry. See [`README.md`](../README.md) §"How to use the wiki" Mode 2.

- **Programmatic batch** (for queued-up backlogs, 20-50 sources per batch):
  `npx tsx tools/bin/ingest_batch.ts plan <candidates.json>` queues; per
  pending item the LLM fetches + writes; `ingest_batch mark-done` /
  `mark-errored` advances state.

Either way, the **batch-close ritual** is the same:

```bash
npx tsx tools/bin/reindex.ts             # refs + tier promotions + indexes
npx tsx tools/bin/lint.ts                # schema + dead-link checks
npx tsx tools/bin/build-sources-index.ts # URL → slug map (for state-derivation)
git commit -m "ingest: ..."              # commit-per-batch, not per slug
```

After each batch: read 2-3 of the new Source pages. If conventions feel
wrong, **update this schema doc first**, then regenerate affected pages.
That's the discipline that keeps the corpus consistent as it grows.
