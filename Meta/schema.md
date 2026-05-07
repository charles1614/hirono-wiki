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

**Sources** additionally require `raw_source:` and may include `tags:`:

```yaml
raw_source: https://example.com/article            # or lark://docx/...
tags: [rl, infra]                                   # optional
highlights: true                                    # raindrop highlighted subset
```

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

Per [[Karpathy]]'s invariant ("raw sources are immutable — the source of truth"), every `Sources/<slug>.md` summary has a paired local archive at `raw/<YYYY>/<slug>/` containing the full content we summarized from. This is what lets us re-ingest when conventions evolve and survives URL rot / provider disappearance.

### Structure (one dir per source)

```
raw/
└── 2026/
    └── 2026-04-19-aws-trainium3-deep-dive/
        ├── content.md              # fetched article text in markdown
        ├── source.json             # fetch metadata (origin, ts, fetcher, quality flags, image manifest)
        ├── images/                 # wechat/zhihu put assets here; xhs puts them flat
        │   ├── img_001.png
        │   └── ...
        └── <noteid>_N.jpg          # xhs puts flat here
```

**Slug contract**: raw dir name = Source summary filename (minus `.md`). `tools/bin/lint.ts`'s `raw-orphan` check enforces the pairing.

**Append-only**: re-fetching a source writes `content-rev2.md` (then `-rev3`, etc.); original `content.md` never overwritten. Source summaries stay pointed at the latest revision implicitly — inspect `raw/<slug>/` to see all revisions.

### The hirono CLI

As of 2026-04-21 the canonical entry point for raw-source operations is
`tools/bin/hirono.ts`. Previous scripts (`fetch-raw.ts`, `ingest_batch.ts`,
`build-sources-index.ts`) still work but hirono is the long-term home;
later phases will fold them under `hirono` subcommands.

**Commands (Phase 1)**:

- `hirono raindrop check [--input <path>] [--json]` — scan the cached
  Raindrop corpus for (a) duplicate URLs, (b) hostname coverage gaps.
  Reads `.wiki-raindrop-cache.json` (gitignored) by default. Exits
  non-zero if duplicates exist or any uncovered hostname has ≥5
  bookmarks — useful as a batch-close signal.

- `hirono raindrop refresh-cache [--token <t>]` — pull all bookmarks
  from the Raindrop public API into the cache. Token comes from
  `--token`, `$RAINDROP_TOKEN`, or `~/.config/hirono/raindrop-token`
  (get one at https://app.raindrop.io/settings/integrations).

- `hirono raindrop fetch <id|url|slug> [--slug <s>] [--force] [--no-images]` —
  fetch a single source into `raw/<year>/<slug>/`. Accepts (a) a
  Raindrop bookmark ID (`123` or `raindrop:123`; looked up in cache),
  (b) a raw URL with explicit `--slug`, or (c) an existing slug which
  triggers a refetch. Runs the `applyPostCleanups` pipeline between
  adapter output and `writeRawArchive`, which strips UI chrome,
  resolves relative image URLs, collapses exploded SVG text, and
  strips HTML color tags. **Append-only by default** — refetches
  write `content-revN.md` rather than clobbering (helpful when a second
  fetch is worse, e.g. SPA cold-cache). `--force` overwrites.

- `hirono doctor [--fix]` — health check:
  1. `opencli doctor` (extension + daemon).
  2. `~/.opencli/clis/wiki-custom` symlink → `tools/opencli-adapters`
     (the self-contained-project pattern; `--fix` creates it).
  3. `node --check` on every adapter file under `tools/opencli-adapters/`.
  4. Surface any `raw/<slug>/source.json` whose `quality_status != good`.

**Post-processors** (see `tools/sites/_shared/post-cleanup.ts`):

| Processor | Domain filter | What it does |
|---|---|---|
| `resolve-relative-image-urls` | all | Convert `![](/path)` → `![](https://host/path)`; emit absolute URLs to the downloader |
| `deepwiki-strip-file-nav` | `wiki.litenext.digital` | Strip the file-sibling navigator block |
| `github-strip-ui-chrome` | `github.com` | Strip "Pull Request Toolbar", "Expand file tree", line-change annotations |
| `anthropic-strip-svg-explosion` | `anthropic.com` | Collapse char-per-line SVG text into a placeholder |
| `strip-color-tags` | all | Remove `<text color="...">` verbatim tags |

Pipeline order: site-specific strips first, then generic relative-URL
resolver, then cosmetic cleanups. Each processor is pure (markdown-in,
markdown-out); composition is order-independent for
non-overlapping site filters but deterministic per the list in
`PROCESSORS`.

**Project-local opencli adapters**:

Custom opencli adapters live under `tools/opencli-adapters/<site>/<name>.js`
(committed to the repo). `hirono doctor --fix` creates a symlink from
`~/.opencli/clis/wiki-custom` to that directory so opencli discovers
the adapters at invocation time. This makes the repo self-contained —
`git clone` + `hirono doctor --fix` is enough setup on a new machine.

Phase 1 ships the infrastructure but no custom adapters yet; the first
adapter comes when a site's quality problems can't be fixed with
post-processors alone.

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

## Image handling

Per [[Karpathy]]'s original method, images should ideally be downloaded locally for URL-rot durability. For this wiki we take a minimal stance:

- **Default**: preserve image URLs as-is in source page bodies. Lark renders remote images via URL, which works for now.
- **Summaries are text-only**: the ingest LLM fetches text-level content; visual claims (diagrams, charts) require click-through to the original source. Where an image is central to a source's claim, note it explicitly — e.g. *"See diagram at URL for the two-stage pipeline architecture."*
- **Optional local download** (`tools/bin/ingest_batch.ts --download-images`, if built) saves images under `raw/assets/<date>-<slug>/`. Off by default; opt in when a specific source's visuals are worth the storage.
- **Deferred to v1.5 if needed**: a post-hoc `tools/fetch-images.ts` that walks existing Source pages and backfills any still-remote images. Build when URL rot starts biting.

This is a deliberate trade-off against the cost of storing ~2000 images at v1 scale. Revisit if the text-only summary quality becomes a real limitation.

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

## v1 workflow: supervised batches

v1 (full-corpus init) is **not** a single autonomous 700-source run. It's a sequence of supervised 20–50 source batches, one per session, with lint + review between.

1. **Queue**: `tools/bin/ingest_batch.ts plan <candidates.json>` adds non-duplicate candidates to `.wiki-batch-state.json`.
2. **Work**: per pending item, the ingest LLM fetches content (Raindrop MCP / lark-hirono fetch / WebFetch) and writes source + entity/topic files. Calls `ingest_batch mark-done <id>` or `mark-errored <id> <msg>`.
3. **Batch close**: run `reindex.ts` → `sync.ts up` → `lint.ts`. Address any lint issues before calling the batch done.
4. **Commit per batch** (not per item) so `git log` shows batch boundaries cleanly.
5. **Pause between batches**: read a few of the source pages, see if conventions feel right. If not, update `schema.md` and regenerate affected pages before next batch.

Priority order for v1 candidates:
- Remaining 40 highlighted Raindrop bookmarks (user-curated high-signal)
- Space 1 "Hirono Raw" nodes the user picks (existing curated knowledge)
- Unhighlighted Raindrop (~540; lowest signal; dedupe aggressively; many may be skipped after manual review)

Estimated cost: ~700 sources at ~30s-3min of LLM time each, in batches of 30, over ~20 sessions.
