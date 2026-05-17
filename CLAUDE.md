# CLAUDE.md

Quality rules + fix recipes for raw-content fetchers (`tools/fetch-raw.ts`, `tools/sites/_shared/post-cleanup.ts`) and wiki ingest/refine workflows. Scan checklists, match symptoms to fixes, don't re-derive.

## Where to look

Match intent → canonical doc. Don't re-derive what's documented.

| Intent | Read |
|---|---|
| High-level corpus state machine (Raindrop → raw → wiki) | [`Meta/corpus-pipeline.md`](Meta/corpus-pipeline.md) |
| Operator pipeline (`hirono raindrop refresh-cache`, `fetch-all`, `sync`, `status`, cadence) | [`Meta/operator-workflows.md`](Meta/operator-workflows.md) |
| Wiki curation, source curation, auto-gen+refine, top-Synthesis, token-cost arch, refine-storm containment, drift detection, auto-fix/auto-curate/propose-curation | [`Meta/operator-workflows.md`](Meta/operator-workflows.md) §9–§13c |
| Site adapter triage / build / per-defect lookup | [`Meta/site-handling-patterns.md`](Meta/site-handling-patterns.md) |
| Fetcher architecture (site module contract, `_default`) | [`docs/fetcher-architecture.md`](docs/fetcher-architecture.md) |
| New per-host module recipe | [`tools/sites/MIGRATION.md`](tools/sites/MIGRATION.md) |
| **Fix recipes — full regex bodies** (activity timeline, mermaid splice, mdnice, GitHub chrome, KaTeX, avatars) | [`Meta/fix-recipes.md`](Meta/fix-recipes.md) (CLAUDE.md §4 indexes) |
| Per-file code pointers | [`docs/code-map.md`](docs/code-map.md) (CLAUDE.md §8 summarizes) |
| Pending punch-list | [`Meta/post-fetch-todo.md`](Meta/post-fetch-todo.md) |
| Wiki page conventions / canonical tag vocab / canonical rationale phrases | [`Meta/schema.md`](Meta/schema.md) |
| Known drift / cleanup TODOs | [`Meta/linting-notes.md`](Meta/linting-notes.md) |
| Karpathy gist + alignment map | [`Meta/references/karpathy-llm-wiki-gist.md`](Meta/references/karpathy-llm-wiki-gist.md) · [`Meta/references/karpathy-alignment.md`](Meta/references/karpathy-alignment.md) |
| **Wiki ingest mechanics** (raw → Source) | §10 below — read before any "ingest from raw" task |
| **Refine + curation workflows** (refine-batch, refine-entity, auto-curate, primitives) | §11 below — reach for the CLI, don't improvise |

Overlap with the docs above is intentional for rules that must fire on every commit (output contract, fidelity, fix recipes). For workflow / per-site depth, defer to the dedicated doc.

## Before shipping — failure modes to avoid

Fidelity before cleanliness. "Clean-looking" outputs often miss 30+ lines.

1. **Validate against source, not mental model.** A 1,645-line output can be missing all 28 code blocks. Diff feature counts against source.
2. **Greps match what's there, not what you intended to strip.** Validate with `grep -vE 'known-good-only'` to surface what slipped through.
3. **Post-processing is subtractive.** If opencli dropped categories, no regex recovers them — use an extraction fallback.
4. **Don't declare victory on the manifest.** `source.json` saying "spliced 3/3" ≠ output reads well. Eye-read the final `.md`.
5. **Cleanup creates artifacts.** Removed cell-run leaves orphan `**Label:**`; stripped nav leaves blank lines; spliced table leaves doubled blanks. Boundary-check before AND after each edit.
6. **Substring assertions are not UI tests.** `assert.match(/Foo Bar/) + /@foo/` both pass with broken layout. Anchor to rendered SHAPE (byline regex `/^\*\*Name\*\* \[@handle\]/m`), not substring presence.

## 1. Fidelity check (run first)

```bash
f=raw/raindrop/<host>/<slug>/content.md
echo "lines=$(wc -l < $f)  chars=$(wc -c < $f)" \
     "fences=$(grep -c '^```' $f)" \
     "tables=$(grep -c '^|' $f)" \
     "images=$(grep -oE '!\[' $f | wc -l)" \
     "headings=$(grep -c '^#' $f)" \
     "FM=$(head -5 $f | grep -c 原文链接)"
```

**Checks (any fail → STOP, extraction fix not cleanup):**
1. Feature count 0 in output but non-zero in source → fallback needed.
2. Output `wc -c` < 80% of source body → real content removed.
3. Every H2/H3 in source also in output (`diff <(grep -E '^#{1,3} ' src) <(... out)`).
4. Exactly one `# ` H1 (the frontmatter title). Second H1 from source = contract violation.

**Treat every `0` as STOP, not a data point.** For any zero column, verify against source: `curl -sfL <url> | grep -oE '<table|<pre|<img' | sort | uniq -c`. Don't rationalize.

**After counts pass, read the output.** Skim first 30 / last 30 / mid section around each spliced element. Counts are necessary, not sufficient.

**Per-host regression gate**: snapshot at `tools/__tests__/snapshots/<host>/<slug>.md` + `<slug>.invariants.json` sidecar. Asserts feature-count invariants, not byte equality.

## 2. Output contract

```markdown
# <Title> [· <org>/<repo>] [· Issue #NNN]

> 原文链接: <source URL>
[> <one-line metadata — released by / authors / date>]

---

[body]
```

**Conversation pages (PR/issue/discussion)** use split speaker format:

```markdown
## <username>

> opened this [discussion] on <Mon D, YYYY> [· <Role>]

<body — H3 and below>

## <other-username>

> commented on <Mon D, YYYY> [· <Role>]

<comment body>
```

Discussion replies use `> replied on ...` (distinct from `> commented on ...`).

## 3. Formatting rules (do not re-ask)

- **No `**bold**` inside headings or already-emphasized text.**
- **Attribution is a blockquote below the name heading**, not part of it.
- **PR/issue/discussion bodies = OP + comments only.** No activity timeline (merged/added label/mentioned/pushed/closed/reopened), no avatars, no emoji reactions.
- **Heading hierarchy follows outline**: speakers `##`, body `###`+. When injecting a speaker heading, demote body's `##` → `###`.
- **Backticks for semantic tokens only** (SHAs, label names, paths, flags). Not actor names, dates, section titles.
- **Avatars: strip.** Relative `/username` links with no non-image text → DROP whole unit. External (badges/shields) → keep `[alt](url)`.
- **Images: all local.** Never ship `![](https://...)` remote. Pipe through `processImages` before returning.
- **Stubs are deliberate.** Auth-gated/interactive/removed → stub template (below) + `extraFlags: ["intentional-stub"]`.
- **Raw files are user-visible.** Defects belong in host's `tools/sites/<host>/converter.ts` (DOM, pre-turndown), NOT downstream regex.
- **Splicer insertions self-check spacing.** Exactly one blank line each side. Reason through surrounding whitespace; `\n\n + block + \n` after `Heading\n\n` produces triple newline.
- **Removals check boundaries.** Inspect line before (orphan `**Label:**`?) and after (stray blank? merged paragraph?). Extend range to swallow the orphan.

### Stub template

```markdown
# <Type>: <identifier>

> **Source:** <original URL>
> **Status:** <one-line reason — auth-gated / interactive-app / page-removed>

*This entry is a metadata stub. <what reader should do>*
```

## 4. Fix recipes — symptom → recipe index

When §1 flags a bug matching a recipe below, **apply — don't ask**. Full regex bodies in [`Meta/fix-recipes.md`](Meta/fix-recipes.md).

| Symptom | Recipe in `Meta/fix-recipes.md` |
|---|---|
| Missing body / comments / tables / fences | "Missing body…" — HF blog/github API/raw-mirror fallback. Set `GITHUB_TOKEN` for 5000/hr. |
| Activity timeline leak | "Activity timeline leaking…" — 4 avatar-residual prefix variants. |
| DeepWiki mermaid as orphan labels | "DeepWiki mermaid…" — wiki.litenext.digital + deepwiki.com paths; `isDiagramNode` thresholds; `splice-incomplete` guard. |
| WeChat/mdnice malformed bold/lists/code | "WeChat / mdnice…" — 11-row table: unbalanced `*`, nested `<strong>`, mis-tagged `data-lang`, jsdom crash, SVG-as-image. |
| x.com / Twitter | "x.com / Twitter" — deterministic stub only (auth-walled). |
| KaTeX triple-rendered (HF blog) | "KaTeX triple-rendered" — V1/V3 collapse + `\\cmd → \cmd`. |
| Avatar residuals / badges (3 DOM shapes) | "Avatar residuals…" — order: Nested → Separated → Bare `[@name](/name)`. |
| GitHub UI chrome bleed-through | "GitHub UI chrome" — 10-row table + `match` predicate (don't widen beyond `pull|issues|discussions/\d+`) + 14-stage ordering. |

The pause to ask is only warranted when fix is novel / destructive / scope-unclear. Documented symptom → commit, not ticket.

## 5. New-URL / new-host protocol

### 5a. Universal pattern

Every URL → self-contained module under `tools/sites/<host>/`. opencli = browser+auth only; never consume its markdown as canonical. Routing is total: `tools/sites/_default/` is registered last with `match: () => true`. After `site.fetch()`, `applyPostCleanups()` runs 8 host-agnostic fixes.

**References for new modules:**
- Simple article: `tools/sites/aleksagordic/` (15-line factory)
- API source: `tools/sites/github/`
- Raw markdown mirror: `tools/sites/huggingface/`
- Browser-eval SPA: `tools/sites/{weixin,xhs,zhihu}/`
- Stub-only: `tools/sites/{feishu,x-twitter,qwen-ai}/`
- Catch-all: `tools/sites/_default/`

Architecture: [`docs/fetcher-architecture.md`](docs/fetcher-architecture.md). Migration recipe: [`tools/sites/MIGRATION.md`](tools/sites/MIGRATION.md).

**Source-of-truth selection** (cleanest first):

| Source available | Use via | Examples |
|---|---|---|
| REST/GraphQL API | `curl`/`fetch` directly; convert JSON→md | github |
| Raw markdown in repo/CDN | `curl raw URL` + image localization | huggingface /blog |
| Server-rendered HTML, stable selectors | `curl` + JSDOM + per-host rules (article factory) | aleksagordic, lmsys, arxiv, anthropic |
| JS-rendered SPA / auth-gated | `opencli browser open` + `eval` for `outerHTML` | xhs, weixin, zhihu |
| No usable content | emit `intentional-stub` | feishu, x.com, qwen.ai |

Defects belong in the site's `converter.ts` (DOM-level, pre-turndown), NOT cross-cutting cleanup. Cross-cutting pipeline does only 8 universal fixes.

**Steps to add a host module** (see [`tools/sites/MIGRATION.md`](tools/sites/MIGRATION.md)):

```
1. Pick source per table above.
2. Build tools/sites/<host>/{index,test-hooks,converter?}.ts
3. Register in tools/sites/index.ts (BEFORE _default) + test-hooks-registry.ts
4. Generate fresh md for ≥3 URLs. EYE-READ. Show user for approval.
5. AFTER approval: npx tsx tools/__tests__/approve.ts --site <host> --name <slug> --url <url> --slug <host>-snap-<slug> --yes  (≥3 fixtures, distinct shapes)
6. npm test green + commit (one host per commit).
```

**Don't** capture fixtures before user-approval — locks regressions in.

### 5b. Long-tail graduation watchdog

`hirono raindrop check` flags hosts crossing count==1 → ≥2. Address per 5a, then `--update-graduation-snapshot` bakes counts into `tools/opencli/host-counts.json`.

### 5c. Iterate on first 1–2 outputs before bulk

Quality bar isn't knowable from md alone. Show user, iterate.

### 5d. Where code lives

- Per-host: `tools/sites/<host>/{index,fetcher,converter,metadata}.ts` + fixtures `tools/__tests__/fixtures/converters/<host>/` + snapshots `tools/__tests__/snapshots/<host>/`.
- Cross-site primitives: `tools/sites/_shared/` (`article-site-factory.ts`, `article-converter.ts`, `post-cleanup.ts` [8 cleanups], `markdown-cleanups.ts`, `generic-converter.ts`, `types.ts`, `test-hooks-types.ts`, `browser-eval-json.ts`).
- Non-obvious recipes → §4.

### 5e. Direction-finding for new hosts

Content-shape taxonomy, chrome categories, cleanup ordering, eye-read checklist, source-of-truth heuristics: [`Meta/site-handling-patterns.md`](Meta/site-handling-patterns.md) §7. Read before writing a new module.

## 6. Regression set

Before committing post-processor/adapter changes, re-export and check.

| URL | Contract | Status |
|---|---|---|
| `huggingface.co/blog/train_memory` | 19 KaTeX triplets + 5 single-var, `\cmd` not `\\cmd`, author callout | good ~14KB |
| `huggingface.co/blog/smollm3` | 23 anchor prefixes stripped, 23-author callout, no KaTeX | good ~26KB |
| `huggingface.co/blog/moe` | GitHub-raw fallback, ~30KB body, 12 images | good ~30KB |
| `huggingface.co/spaces/mteb/leaderboard` | L2 skip, no raw/ dir | skipped |
| `github.com/huggingface/trl/pull/3521` | 3 speakers, ≥1 table, ≥4 fences, zero activity | good ~6KB |
| `github.com/sgl-project/sglang/issues/8965` | OP + ~12 commenters, split-speaker, zero activity | good ~11KB |
| `github.com/pytorch/torchtitan` | README raw fetch, ≥18 fences, 8 local badge images | good ~11KB |
| `github.com/pytorch/pytorch/releases/tag/v2.5.0` | Release API, ≥18 fences, ≥10 table rows | good ~91KB |
| `github.com/ggml-org/llama.cpp/discussions/5138` | 24 speakers (7 top + 17 replied) | good ~9KB |
| `wiki.litenext.digital/wiki/slime?file=02-distributed-orchestration` | 9 mermaid blocks, 0 orphan labels | good ~29KB |
| `mp.weixin.qq.com/s/PcyKi5q8zT-tJ_9rzgKSqg` (Anthropic Skills) | 30 fences, 0 doubled markers, YAML intact | good ~6KB |
| `mp.weixin.qq.com/s/FcK3QmzudPZzqsz85odFlQ` (GPU container) | 14 fences, 21 table rows, 1 SVG preserved | good ~6KB + 20KB SVG |
| `mp.weixin.qq.com/s/44_UrbaQu2U1EAB9OrGNxQ` (Xiaomi interview) | 15 images, `**作者丨何煦阳**` merged | good ~12KB |
| `x.com/garrytan/status/2042497872114090069` | stub: `# Tweet / X post` + `intentional-stub` | stub ~500B |

**Block-ship one-liner** (any `>0` for remote_imgs/activity, `FM==0`, or feature < contract → DO NOT SHIP):

```bash
f=raw/raindrop/<host>/<slug>/content.md
echo "$f:" \
  "lines=$(wc -l < $f)" \
  "fences=$(grep -c '^```' $f)" \
  "tables=$(grep -c '^|' $f)" \
  "remote_imgs=$(grep -cE '!\[[^]]*]\(https?://' $f)" \
  "activity=$(grep -cE '(merged \[|mentioned this|added .+ commits?|deleted the|self-assigned|approved these|pushed a|\[@[A-Za-z0-9_-]+\]\(/)' $f)" \
  "FM=$(head -5 $f | grep -c 原文链接)"
```

## 6b. Test suite

Run `cd tools && npm test` before every commit touching adapter/converter/post-processor. Don't bypass.

**Five layers:**

| Layer | File | Fails on |
|---|---|---|
| Coverage gate | `__tests__/coverage-gate.test.ts` | Site module registered without ≥1 fixture or ≥1 snapshot |
| Structural rules | `__tests__/structural-rules.ts` | Captured ground-truth contains defect shapes (multi-line link wrappers, over-escaped emoji/images, empty headings, triple newlines, quad-asterisk) |
| Per-host snapshot | `__tests__/per-host-snapshot.test.ts` | Snapshot edited away from sidecar; h1≠1; missing FM; remote refs; structural violation; unresolved local image |
| Converter fixture | `__tests__/converter-fixtures.test.ts` | **byte-equal diff** vs saved `expected.md` + structural rules |
| Pure-function | `__tests__/post-process-fixtures.test.ts` | input md → exact output. Use `assertStructurallyClean()` helper |

**Canonical capture: `approve.ts`**

```bash
npx tsx tools/__tests__/approve.ts --site <site> --name <fixture-name> --url <url> [--slug <slug>] [--yes]
```

Fetches via test hook → runs converter + structural rules (refuses to write on rule fire) → prints eye-read sections → diffs vs current → prompts y/n → atomic write of fixture (3 files) + snapshot.

**When fixture tests fail:**
1. Read byte-offset diff.
2. Bug in new code → fix code, don't regenerate fixture. Intentional improvement → `approve.ts` (read diff before approving). Never `--no-verify`.

**Adding a new site to tests**: write `tools/sites/<X>/test-hooks.ts` (see `_shared/test-hooks-types.ts`), add import in `test-hooks-registry.ts`. Coverage gate enforces ≥1 fixture + ≥1 snapshot. Capture via `approve.ts`. **Target ≥3 fixtures per converter** (diverse shapes).

**Live-fetch drift detection** (operator, not CI):

```bash
npx tsx tools/__tests__/check-drift.ts [--host <h>] [--site <n>] [--diff-only]
```

Re-fetches snapshot URLs (via sidecar `source_url`), categorizes unchanged/trivial/significant. Pre-source_url snapshots skipped; backfill via `snapshot-helpers.ts backfill-source-url`.

**Assertion shape > substring.** `/Foo Bar/` confirms a token survived; says nothing about rendering. Anchor to byline regex (`/^\*\*Name\*\* \[@handle\]/m`), card separator (`/\n---\n/`), absence of broken wrappers (`/\[\s*\n\s*!\[/` must NOT match).

**Path-resolution gotcha**: tests MUST use `fileURLToPath(import.meta.url)`, not cwd-relative literals. `npm test` cwd=`tools/`; literal `"tools/__tests__/..."` resolves to non-existent `tools/tools/...` and silently no-ops. (Commit `4ca244e`.)

**Stability**: run `npm test` 3× back-to-back; count must be identical, `fail=0` every time.

## 7. Quality flags (in `source.json.quality_flags`)

| Flag | Meaning |
|---|---|
| `short-body` | Body < 500 chars |
| `below-host-expected-size` | < `HOST_MIN_BODY_SIZES[host].minChars` (URL-path aware; HF `/blog/*`=2KB, `/spaces/*` excluded) |
| `no-headings-in-body` | ≥2KB body, zero `#{1,6}` headings — likely sidebar |
| `loading-skeleton` | `Loading…`/`加载中`/`Please wait` in <2KB body |
| `images-declared-but-none-downloaded` | Markdown has images, disk empty |
| `xhs-download-silent-fail` | xhs exited 0 but saved no images |
| `weixin-image-download-partial` | Layer-4 weixin: ≥1 image URL failed curl |
| `auto-skipped-hf-space` | L2 pre-fetch skip |
| `deepwiki-{mermaid,table}-{extraction-failed,splice-incomplete}` | Browser pass failed or extracted N placed <N |

`intentional-stub` is consumed by classifyQuality → suppresses size-based flags.

## 8. Code pointers

See [`docs/code-map.md`](docs/code-map.md) for per-file/per-export breakdown.

- **`tools/fetch-raw.ts`** — dispatch + raw-archive layout (`AUTO_SKIP_RULES`, `HOST_MIN_BODY_SIZES`, `classifyQuality`, `fetchUrlAndStore`, `downloadImage`).
- **`tools/fetch-raw-handlers.ts`** — CLI handlers for raindrop fetch.
- **`tools/bin/`** — CLI entry: `hirono.ts`, `lint.ts`, `reindex.ts`, `preprocess.ts`, `sync.ts`, `ingest_batch.ts`, `build-sources-index.ts`.
- **`tools/sites/`** — host modules + `_shared/` (article factory + post-cleanup) + `_default/` (last).
- **`tools/shared/`** — `atomic-write.ts`, `browser-lock.ts`.
- **`tools/hirono/`** — bulk-fetching: `doctor.ts`, `raindrop/{check,export,fetch-all,refresh-cache}.ts`.
- **`tools/opencli/`** — `clis/<site>/`, `host-counts.json`.
- **`tools/__tests__/`** — coverage gate, snapshots, fixtures, structural rules, `approve.ts`.

## 9. Q&A depth fallback

Sources are summaries. For detail not carried (algorithm steps, table rows, code, captions), Read `raw/raindrop/<host>/<slug>/content.md` directly. `<host>` from Source's `source_url:`. Siblings: `<slug>.pdf`, `<slug>-figures/`, `<slug>-images-extract.md`, `source.json`, `revisions.jsonl`.

**Trust the snapshot — don't refetch.** `content.md` is curated; URL refetch bypasses cleanup. Stale → `hirono raindrop refetch <slug>`. Cite as `[[Sources/<slug>]]`. Path mapping lives only here + Meta/schema.md (never in Source body).

**Image-heavy workflow**: when `shouldExtractImages` triggers, Sonnet subagent extracts verbatim → `<slug>-images-extract.md`. Opus inline-verifies any number/§-ref/parameter before citing. **Never Haiku** for dense Chinese (1568px cap drops specifics + hallucinates). Details: memory `feedback_image_extraction_hybrid.md` + `feedback_haiku_image_resolution.md`.

**Image-ref rule**: 2–5 `![]()` refs only for genuinely visual (diagrams, charts, heatmaps, schematics, dashboards, photos). Text-in-spatial-layout → use a canonical rationale phrase from Meta/schema.md's documented list (lint exact-string match — paraphrasing breaks gate).

## 10. Wiki ingest mechanics (raw → `Sources/YYYY/<slug>.md`)

LLM is the authoring layer; no single command converts raw → Source. Rules below = what `lint.ts` enforces. Get them right first pass.

### Decision tree (user said X → run Y)

| User said | First command |
|---|---|
| "fetch new bookmarks" | `hirono raindrop refresh-cache && hirono raindrop fetch-all` |
| "what's ingestable" | `hirono raindrop ingest-candidates --limit 50 --md` |
| "triage fetch failures" | `hirono raindrop status --filter <kind>` |
| **"ingest N from raw"** | follow §10 — candidates → per-item LLM authorship → validation gate |
| "ingest cost preview" | `hirono ingest-preview --since HEAD~1` |
| "refine stale" (≥3 items) | **`hirono refine-batch --from-stale --limit N`** (§11) |
| "refine stale" — preview cost | `hirono refine-all-stale --preview` (§11) |
| "refine one entity/topic" | `hirono refine-entity "<N>"` → Agent (model per §11) → `--response <path> --apply` (§11) |
| "regenerate top Synthesis" | `hirono refine-synthesis` (§11) |
| "scaffold Entity/Topic" | `hirono new-entity "<N>" --kind "<one-liner>"` / `new-topic "<N>" --what "<one-liner>"` |
| "rename Foo → Bar" | `hirono rename-entity "Foo" "Bar" --reason "..."` (atomic — never sed) |
| "merge Foo into Bar" | `hirono merge-entities "Foo" --into "Bar"` |
| "delete Source X" | `hirono delete-source <slug> --reason "..."` |
| "clean orphan entities" | `hirono bulk-delete-orphans --confirm` |
| "audit wiki health" | `hirono health-check --scope drift` |
| "one-tap cleanup" | `hirono auto-fix` (Tier-1) or `hirono auto-curate` (Tier-1+2) |
| "lint" | `npx tsx tools/bin/lint.ts` (must end `0 error(s)`) |

CLIs are atomic + log to `Meta/refactor-log.md` + update indexes. Hand-rolled equivalents skip those invariants.

### Flow

```
fetch-all → pick candidates → ingest_batch start <id> → write Sources/YYYY/<slug>.md
                                                       + append Observations
                                                       + scaffold missing entities
                            → ingest_batch mark-done → reindex + lint (gate)
```

### Picking candidates + subagent fanout

```bash
npx tsx tools/bin/hirono.ts raindrop ingest-candidates --limit 50 > /tmp/cands.json
npx tsx tools/bin/ingest_batch.ts plan /tmp/cands.json
npx tsx tools/bin/ingest_batch.ts next --count N    # emits NDJSON
```

**N ≥ 5**: parallel Sonnet subagents (5 items each). Subagent contexts are independent — they don't inherit CLAUDE.md, so the spawning prompt MUST embed §10 verbatim. **N ≤ 4**: serial in main context (prompt cache amortizes).

### Slug rule (load-bearing — most-missed)

Filename in `Sources/YYYY/<slug>.md` MUST equal raw folder name EXACTLY. NO stripping suffixes (`-小红书`, `-trai`, `-在`) or trimming dashes. `checkRawOrphan` lint errors on mismatch.

**Resolve**: `grep -lr "<url>" raw/raindrop/*/*/source.json | head -1` → parent directory IS the slug. Copy-paste, don't retype.

### Source schema

```markdown
---
created: <today YYYY-MM-DD>
updated: <today YYYY-MM-DD>
type: source
source_url: <verbatim from source.json — keep utm/share>
tags: [tag-1, tag-2, ...]            # ≥1 from CANONICAL_TAGS (Meta/schema.md); lint ERROR if missing
---

# [<source-pub-date YYYY-MM-DD>] <Clean Title>

## TL;DR

<1–3 sentence high-density abstract>

## Key claims

- <claim with numbers; wikilink [[Entity]]/[[Topic]]>
- <...>

## Visual observations

*<canonical rationale phrase OR 2–5 ![](../../raw/raindrop/<host>/<slug>/<img>.ext) refs>*

## What this changes

<optional — 1–2 bullets on implications; skip if not load-bearing>

## Entities touched

[[E1]], [[E2]], ...

## Topics touched

[[T1]], [[T2]], ...

## Raw source

[host.tld/slug](<URL>) — <provenance: author/date/format>. Read <today>.
```

### Frontmatter rules

**Two date fields, distinct meanings:**

- `created:` / `updated:` — date YOU write the Source (today; both equal "today" on first write).
- `# [YYYY-MM-DD] <Title>` H1 — date SOURCE was published. Resolution order:
  1. `source.json.published_at`
  2. `source.json.created` (Raindrop bookmark date)
  3. `YYYY-MM-DD-` prefix of the raw archive slug
  4. First `<time>` element in `content.md`

  Source slug `2025-08-23-tensorrt-llm` with `created: 2026-05-15` is CORRECT — source published 2025, ingested today.

**`tags:` lint-required**. 2–5 from `Meta/schema.md` "Canonical tag vocabulary" (5 axes: workload / subdomain / hardware / source-shape / special). Non-canonical → WARN; missing → ERROR. **Don't tag proper nouns** (companies/models/SKUs) — those go in `## Entities touched`.

**`source_url:`** verbatim from `source.json.url`. Keep utm/share; lint exact-string compares.

### Canonical "Visual observations" rationale phrases (exact-string match)

Paraphrasing breaks lint. Pick ONE for text-only sources:

- `*No load-bearing images — all panels redundant with body text.*` (xhs comment screenshots; weixin where prose paraphrases)
- `*No load-bearing images — all panels decorative (logos, badges, photos).*` (github READMEs chrome-only; non-technical xhs)
- `*No load-bearing images — all images text-only (typed content extracted into body).*` (xhs typed summary cards; PDF cover/TOC; "screenshot of paragraphs")
- `*No load-bearing images — figures inline-captioned in raw, no standalone images.*` (Marker-captioned papers)
- `*No load-bearing images — source has no images.*` (text-only blog, API JSON, prose)

**Mixed**: include load-bearing `![](...)` refs AND append `*Other images decorative — <category list>.*`

**Litmus**: can image content be fully conveyed in md prose/tables/code? Yes → text-only. No → 2–5 refs with factual captions.

### Image-extract sidecar

If `raw/raindrop/<host>/<slug>/<slug>-images-extract.md` exists, **read it before writing Key claims**. Sonnet-pre-extracted verbatim record; cite specifics verbatim, don't paraphrase.

### Bullet citation scope

- **Source file `## Key claims`**: NO `— [[<own-slug>]]` trailing citation. The Source IS the citation. (Most-missed by subagents.)
- **Entity/Topic file `## Observations`**: DO end with `— [[<source-slug>]]` (slug only, NO path prefix).

### Image-path depth

Sources live at `Sources/YYYY/<slug>.md` (2 levels). Refs: `../../raw/raindrop/<host>/<slug>/<image>.ext`. Not `../raw/...`, not `../../../raw/...`.

### Dead wikilinks → scaffold inline

Writing `[[Name]]` with no match in `ls Entities/ Entities/_seen/ Topics/` → MUST scaffold via `hirono new-entity "<N>" --kind "..."` (or `new-topic`) before declaring done. Match case + spelling exactly. Check `ls` BEFORE writing the wikilink.

### Append observations

For each `[[Entity]]`/`[[Topic]]` in the Source, append to that page's `## Observations`:

```markdown
- <one-paragraph cited claim with numbers; wikilink sibling [[Entities]]>. — [[<source-slug>]]
```

- Em-dash `—` (U+2014, ` — `), not hyphen.
- Slug only — NO `Sources/2026/` prefix.
- Append at END of `## Observations`. If section doesn't exist (freshly-scaffolded `_seen/` stub), add heading first.
- **Atomic**: Read immediately before each Edit; retry up to 3× on collision when parallel subagents touch the same file. Edit only — no wholesale Write.

### Stub-skip rule

If `source.json.extraFlags` has `intentional-stub` OR `content.md` is auth-walled/empty/stub-template → do NOT write Source. Run `npx tsx tools/bin/ingest_batch.ts mark-errored <id> "stub-only"` and move on. (Examples: x.com, qwen.ai blog, feishu, most xhslink shortlinks.)

### Validation gate (every ingest)

```bash
npx tsx tools/bin/reindex.ts
npx tsx tools/bin/build-sources-index.ts
npx tsx tools/bin/lint.ts                   # must end "0 error(s)"
```

Fix errors before reporting done. Warnings/info acceptable.

### Parallel-subagent prompt template

Subagent has no CLAUDE.md. Embed §10 verbatim. Prompt must include:

1. "Follow CLAUDE.md §10 for ingest mechanics."
2. The 5 items as `{id, url, title}` JSON.
3. Per-item loop: `ingest_batch start` → resolve slug → Read raw + source.json → if stub `mark-errored` → write Source → append Observations / scaffold → `mark-done`.
4. Report shape: "slugs created, slugs errored (reason), entities/topics scaffolded. Under 300 words."

### Chunking knobs (subagent fanout)

- §10 default: **5 items/subagent** — conservative, bounded blast radius, comfortable context.
- Token-efficiency tradeoff: bigger chunks (8–10 items) save preamble duplication (one cache amortization, not N). Smaller chunks (5) maximize parallelism + cap context pressure. Pick per batch.
- **Wall-clock**: 9 agents × 5 items finishes ~10min; 3 agents × 15 items ~25min (each serial). Parallelism wins latency.
- **Collision cost**: shared Entity files (NVIDIA, Blackwell) touched by ½ the agents — more parallel agents = more retry-on-collision.

### Post-ingest summary

After lint green:
```
hirono ingest-preview --since HEAD~1
```
Reports new-Sources / touched-Entities/Topics / stale count / est refine cost. Headline number for the user.

## 11. Refine + curation workflows

CLI for each common task. Reach for it, don't improvise. Many use a two-step pattern: CLI writes prompt to disk → spawn Agent (model per memory `feedback_model_choice_opus_vs_sonnet.md`) → re-run CLI with `--response <path> --apply`.

### The `--response <path> --apply` two-step

```bash
# 1. Prepare (cheap; no model spend)
hirono <command> "<target>"                      # writes prompt to disk

# 2. Spawn Agent (model per memory `feedback_model_choice_opus_vs_sonnet.md`), save response

# 3. Dry-run (preview the diff)
hirono <command> "<target>" --response <path>

# 4. Apply atomically
hirono <command> "<target>" --response <path> --apply
```

Never skip dry-run for production runs. Reveals scaffolded entities, retained Observations, changed wikilinks.

### Subagent (Step 2)

ALWAYS via Agent tool — never `curl` API, never shell `claude`. Preamble caching depends on Anthropic-side prefix-match; only Agent-tool calls hit that path.

**Model choice**: per memory `feedback_model_choice_opus_vs_sonnet.md`. Defaults if memory missing: **Opus** for `refine-synthesis` (top), `propose-curation`, and `refine-batch`/`refine-entity` on active-tier entities (refs ≥ 10). **Sonnet** for ingest, `auto-detect-entities`, image-bulk extraction, and refine-entity on long-tail (refs < 5). Pick at the spawn site.

```
Agent({
  description: "Refine <Name> Synthesis",
  subagent_type: "general-purpose",
  model: "sonnet",  // or "opus" per policy above
  prompt: `Read .refine-prompts/<Name>-synthesis-prompt.md (CLI prints path). Follow exactly. Output ONLY the requested artifact (e.g., 4–6 sentences plain prose) — CLI pastes verbatim. Write to .refine-prompts/<Name>-synthesis-response.txt then report path. Under 50 words of meta.`
})
```

**Response paths** (CLI looks here when `--response <path>`):

| Command | Prompt file | Response file |
|---|---|---|
| `refine-entity "<N>"` | `.refine-prompts/<N>-synthesis-prompt.md` | `.refine-prompts/<N>-synthesis-response.txt` |
| `refine-topic "<N>"` | `.refine-prompts/<N>-topic-prompt.md` | `.refine-prompts/<N>-topic-response.txt` |
| `refine-synthesis` | `.refine-prompts/top-synthesis-prompt.md` | `.refine-prompts/top-synthesis-response.txt` |
| `auto-detect-entities <slug>` | `raw/raindrop/<host>/<slug>/<slug>-entities-prompt.md` | `<slug>-entities-response.json` |
| `propose-curation` | `Meta/.propose-curation/prompt.md` | `Meta/.propose-curation/response.json` |

Use these literal paths. Don't invent custom ones.

### Prompt-cache invariants

Strict layout: preamble FIRST (cache-friendly, stable), curated Source excerpts MIDDLE, variable context LAST. Anthropic caches by exact-prefix match, 5-min TTL — every byte change invalidates.

Preambles live in `tools/hirono/_shared/prompt-preamble.ts` as deterministic constants. **Never edit inline in a `.refine-prompts/*.md`** — breaks every cache hit for ~5 min. To refine wording, edit `prompt-preamble.ts` (one commit, all callers updated).

Subagent response is paste-verbatim: 4–6 sentences for `refine-entity`, no preamble, no wikilinks inside Synthesis (per `REFINE_ENTITY_PREAMBLE` in `prompt-preamble.ts:24-50`). CLI prepends `## Synthesis\n\n`; if response has its own header/fence → doubled heading.

### `auto-detect-entities <slug>` — LLM-NER per Source

Run AFTER authoring `Sources/YYYY/<slug>.md` per §10, to discover missed entities/topics.

```bash
hirono auto-detect-entities <slug>                         # writes prompt
hirono auto-detect-entities <slug> --response <path>       # dry-run
hirono auto-detect-entities <slug> --response <path> --apply  # creates _seen/<canon>.md
```

Does NOT insert wikilinks into Source body — that's your job. Consults `Meta/entity-aliases.md` for normalization (LLaMA→Llama, bfloat16→BF16).

### `refine-entity` / `refine-topic` / `refine-synthesis`

7-day staleness lag (`STALE_LAG_DAYS=7` in `lint.ts:862`): page Synthesis older than newest citing Source by >7d.

```bash
hirono refine-entity "<N>" [--response <r> --apply]
hirono refine-topic "<N>" [--response <r> --apply]
hirono refine-synthesis [--response <r> --apply]      # corpus-wide top Synthesis.md
```

Use cache-friendly preamble + curated Source excerpts (`tools/hirono/_shared/source-excerpt.ts`). Measure sidecar at `<prompt>-measure.json`.

### `refine-batch` — N entities in ONE Agent call (preferred ≥3)

Per-entity `refine-entity` = 3 tool calls each. `refine-batch` = **3 tool calls TOTAL** for any N.

```bash
hirono refine-batch <n1> <n2> ...                  # explicit
hirono refine-batch --from-stale [--limit N]       # top-N stale

# Spawn ONE Agent (model per policy — Opus for active-tier batches, Sonnet for tail) → read .refine-prompts/batch.md → write marker-delimited .refine-prompts/batch-response.txt

hirono refine-batch --response .refine-prompts/batch-response.txt           # dry-run
hirono refine-batch --response .refine-prompts/batch-response.txt --apply
```

**Why batched > parallel-N**: preamble bills once within one conversation (vs N). One model call aligns framing across shared Sources. 1 Agent call vs N. Opus 4.7 1M context fits ~60 entities per call; Sonnet ~10–15.

**Marker format** (parser-strict):

```
=== entity: <Name1> ===
<4–6 sentence Synthesis; plain prose; no wikilinks inside>

=== entity: <Name2> ===
<...>
```

CLI cross-checks parsed names against `batch.md`: reports `missingFromResponse` (subagent skipped) + `unmatchedInResponse` (subagent hallucinated). Per-entity atomic apply.

**When to use**: 1–2 entities → `refine-entity`. ≥3 entities or any "refine all stale" → **`refine-batch --from-stale --limit N`**.

### `refine-all-stale` — batch with cost discipline

```bash
hirono refine-all-stale --preview     # no model spend — count + tokens + $
hirono refine-all-stale --list        # stale items sorted by lag-days
hirono refine-all-stale --limit N     # top-N most-stale
hirono refine-all-stale               # full batch (only after --preview)
```

**Discipline**:
- Ingest frequently, refine rarely. Let 7-day lag batch multiple Sources' drift.
- `--preview` before any refine batch. Always.
- `--limit N` resumable — per-item counters independent. Chain across days safely.
- Cadence: when `ingest-preview --since HEAD~7` shows >10 stale, preview → cap 10–20 → `--limit N`.

### `ingest-preview` — post-ingest cost preview

```bash
hirono ingest-preview --since HEAD~1
```

Reports new-Sources / touched-Entities/Topics / stale count / est refine cost. Run after every ingest.

### Curation primitives (atomic, log-tracked)

```bash
hirono rename-entity "<Old>" "<New>" --reason "..."        # rewrites all wikilinks
hirono merge-entities "<Src>" --into "<Tgt>"               # transfers Observations + links
hirono merge-topics   "<Src>" --into "<Tgt>"
hirono delete-source <slug> [--keep-raw] --reason "..."    # removes Source + raw (unless --keep-raw)
hirono bulk-delete-orphans [--confirm | --all-zero]        # _seen/ refs=0
```

Each atomic + logs to `Meta/refactor-log.md` + updates indexes. Hand-rolled `mv`+`sed` skips wikilink rewrite + audit trail.

### `auto-fix` / `auto-curate` (one-tap)

- **`auto-fix`** (Tier-1, no model spend, no deletions): safe alias merges + prompt prep + index refresh. Pre-commit-hook-safe.
- **`auto-curate`** (Tier-1 + Tier-2): runs auto-fix → propose-curation (Opus) → apply-queue. Default full-auto Phase 2; `--review` for checkbox; `--continue` to resume.

User says "tidy up" / "fix what's broken" / "one-tap" → `auto-curate`.

### `propose-curation` / `apply-queue`

```bash
hirono propose-curation                     # spawn Opus (judgment quality > cost here) → writes Meta/curation-queue.md
# operator marks [x] APPROVED
hirono apply-queue [--auto-apply <level>]   # dispatcher executes via atomic CLIs
```

### `health-check` — read-only LLM audit

```bash
hirono health-check                          # all scopes
hirono health-check --scope drift            # cross-source contradictions
hirono health-check --scope sources          # source-quality
```

Proposes WITHOUT executing. Run weekly or when things feel drifty.

### Validation gate (after refine/curation)

Same as §10:
```bash
npx tsx tools/bin/reindex.ts
npx tsx tools/bin/build-sources-index.ts
npx tsx tools/bin/lint.ts                   # 0 error(s)
```

## Auto-capturing learnings

When work finishes, ask: **"would a future session avoid the trap or shorten the path if I capture this?"** If yes, capture immediately — don't wait for a reminder.

**Triggers**: class-of-bugs fix · tool/library/site quirk that would have saved 30+min · user correction · benchmarked choice · constraint hit · pattern-discovery iteration.

**Skip**: genuinely one-off · already documented · hunch (wait for second instance).

### Destination

| Lesson | File |
|---|---|
| Site-handling pattern | `Meta/site-handling-patterns.md` §2 (P-NN) + §1 row + §3 if novel |
| Recurring anti-pattern | `Meta/site-handling-patterns.md` §6 (AP-NN) |
| Workflow change / new command | `Meta/operator-workflows.md` |
| Actionable TODO | `Meta/post-fetch-todo.md` |
| Wiki conventions | `Meta/schema.md` |
| Cross-doc drift | `Meta/linting-notes.md` |
| Code-quality rule for every commit | CLAUDE.md §3 |
| Fetcher architecture shift | `docs/fetcher-architecture.md` |
| New host module variant | `tools/sites/MIGRATION.md` |

Straddling files → write in both + cross-link (P-37 + post-fetch-todo §2 is the example).

### Quality bar (both gates)

1. **Durable** — won't disappear in a month (design constraints pass; version-specific quirks usually fail).
2. **Generalizable** — applies beyond one slug/file (class-of-bugs passes; single-slug content fixes fail).

### Capture shape

- **P-NN / AP-NN**: five-bullet — Symptom · Root cause · Remediation · Generalization · Reference. Mirror surrounding tone.
- **TODOs**: `- [ ] **<title>** (<scope>). <description + recipe + commands>.`
- **Workflows**: flow diagram + commands + success/failure markers. Match `operator-workflows.md` shape.
- **CLAUDE.md §3**: imperative + short rationale + match formatting-rules style.

## Keeping this file fresh

Update AFTER landing a fix, not during investigation. Durable + generalizable only. Remove resolved entries once a session passes without triggering the old bug.
