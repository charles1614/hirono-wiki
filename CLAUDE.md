# CLAUDE.md

Quality rules and fix recipes for raw-content fetchers (`tools/fetch-raw.ts`, `tools/sites/_shared/post-cleanup.ts`). Scan the checklists, match symptoms to fixes, don't re-derive from scratch.

## Where to look

Match your intent to the canonical doc; don't re-derive what's already written down.

| Intent | Read |
|---|---|
| **High-level state machine** of the corpus (Raindrop → raw → wiki ingestion; the 3 states + transitions + protections + per-scenario runbooks) | [`Meta/corpus-pipeline.md`](Meta/corpus-pipeline.md) |
| Run / understand the operator pipeline (`hirono raindrop refresh-cache`, `fetch-all`, `sync`, `status`, daily/weekly cadence) | [`Meta/operator-workflows.md`](Meta/operator-workflows.md) |
| Wiki curation (rename / merge / delete entities; periodic health-check audit; stale-Synthesis regeneration) | [`Meta/operator-workflows.md`](Meta/operator-workflows.md) §9 Curation |
| Source curation (delete-source, raindrop forget, skip-list registry) — accident cleanup primitives, NOT default paths (Karpathy: every URL in raw gets ingested; gate is at the bookmark layer) | [`Meta/operator-workflows.md`](Meta/operator-workflows.md) §10 Source curation |
| Auto-gen + refine entities (LLM-NER per Source; Synthesis regeneration via Sonnet subagent; refine-all-stale batch mode) | [`Meta/operator-workflows.md`](Meta/operator-workflows.md) §11 Auto-gen and refine |
| Top-level [[Synthesis]] regeneration (`hirono refine-synthesis`; `stale-top-synthesis` lint; auto-fix + propose-curation integration) | [`Meta/operator-workflows.md`](Meta/operator-workflows.md) §11.4 Top-level Synthesis |
| Token-cost architecture (cache-friendly preamble; curated-source mode; measure sidecars; `--full-source` escape hatch) — applies to every `refine-*` / `auto-detect-entities` / `propose-curation` | [`Meta/operator-workflows.md`](Meta/operator-workflows.md) §11.2 + `tools/hirono/_shared/` (prompt-preamble.ts, source-excerpt.ts, prompt-measure.ts) |
| Bulk-ingest refine-storm containment (`hirono ingest-preview`, `refine-all-stale --preview` / `--limit N`) — visibility + cap before authorizing a refine batch. Per-item `synthesis_updated_at` counters are independent; safe to chain `--limit N` runs across sessions. **Discipline: ingest frequently, refine rarely.** | [`Meta/operator-workflows.md`](Meta/operator-workflows.md) §11.3 + §11.3a |
| Drift detection cadence (`hirono health-check --scope drift\|sources`, `hirono raindrop gc`, `dead-link-accepted` pin) | [`Meta/operator-workflows.md`](Meta/operator-workflows.md) §12 Drift detection |
| Tier-1 safe auto-fix (`hirono auto-fix`): alias merges + refine-prompt prep + index refresh. Never deletes. Safe for pre-commit hook / cron. | [`Meta/operator-workflows.md`](Meta/operator-workflows.md) §13 Tier-1 safe auto-fix |
| Unified curation loop (`hirono auto-curate`): two-phase orchestrator wrapping auto-fix + propose-curation + apply-queue into one command. Default Phase 2 is full-auto; pass `--review` for one-tap. | [`Meta/operator-workflows.md`](Meta/operator-workflows.md) §13b Unified loop |
| Tier-2 batch curation (propose-curation → apply-queue): one Sonnet pass over health-check findings, operator reviews queue, dispatcher executes approved items via existing atomic CLIs | [`Meta/operator-workflows.md`](Meta/operator-workflows.md) §13c One-tap / full-auto |
| Triage a sub-good site, build a new site adapter, or look up a specific defect pattern (SPA hydration, auth-walled, mermaid splice, etc.) | [`Meta/site-handling-patterns.md`](Meta/site-handling-patterns.md) — symptom→cause→remediation index |
| Architectural overview of the fetcher (site module contract, `_default` catchall, opencli vs legacy) | [`docs/fetcher-architecture.md`](docs/fetcher-architecture.md) |
| Step-by-step recipe for a new per-host site module | [`tools/sites/MIGRATION.md`](tools/sites/MIGRATION.md) |
| **Fix recipes — full regex bodies + tables for every documented-symptom-to-commit fix** (activity-timeline leak, DeepWiki mermaid splice, mdnice quirks, GitHub UI chrome, KaTeX triplets, avatar residuals, etc.) | [`Meta/fix-recipes.md`](Meta/fix-recipes.md) — CLAUDE.md §4 is the symptom→recipe index pointing here |
| Per-file / per-export code pointers for the fetch / lint / ingest toolchain | [`docs/code-map.md`](docs/code-map.md) — CLAUDE.md §8 is the top-level summary pointing here |
| Pending punch-list after the most recent bulk fetch | [`Meta/post-fetch-todo.md`](Meta/post-fetch-todo.md) |
| Wiki page conventions (frontmatter, page types, tier rules — the governance layer for `Sources/`, `Entities/`, `Topics/`). **As of the pre-scale schema lockdown (2026-05-11): per-Source `## Open questions` was removed; cross-source research questions now live in `Topics/<X>.md ## Open threads`; source-specific re-fetch TODOs live in the Source's `## Raw source` footer. `## What this changes` is explicitly optional. `tags:` frontmatter is lint-required.** | [`Meta/schema.md`](Meta/schema.md) |
| Known drift / contradictions / cleanup TODOs across the wiki | [`Meta/linting-notes.md`](Meta/linting-notes.md) |
| External inspiration — Karpathy's "LLM Wiki" gist (the loose pattern this project rhymes with; not a binding spec) | [`Meta/references/karpathy-llm-wiki-gist.md`](Meta/references/karpathy-llm-wiki-gist.md) |
| **How this wiki maps to Karpathy** — coverage map, deliberate deviations, acknowledged gaps. Re-run periodically. | [`Meta/references/karpathy-alignment.md`](Meta/references/karpathy-alignment.md) |
| **Wiki ingest mechanics** — raw → `Sources/YYYY/<slug>.md` authoring (decision tree, slug rule, schema, frontmatter rules + lint-required tags, citation scope, image-path depth, image-extract sidecar, canonical Visual-observations rationale phrases, scaffold-on-dead-link rule, validation gate). The rote rules subagents miss on first pass. **Read before any "ingest from raw" task.** | §10 of this file |
| **Refine + curation workflows** — the `--response <path> --apply` two-step; `auto-detect-entities` / `refine-entity` / `refine-topic` / `refine-synthesis` / `refine-all-stale --preview --limit N`; curation primitives (`rename-entity`, `merge-entities`, `delete-source`, `bulk-delete-orphans`); `auto-fix` / `auto-curate` / `propose-curation` / `apply-queue`; `health-check`. **Reach for the CLI; don't improvise.** | §11 of this file |
| What this file (`CLAUDE.md`) covers | the section list immediately below — quality rules, fidelity check, output contract, formatting rules, fix recipes, regression set, code pointers |

This file deliberately overlaps with the docs above on a few load-bearing topics (output contract, fidelity checks, fix recipes) — those are the rules that should fire on every commit, regardless of whether the operator opened the workflow / patterns docs first. When in doubt about a workflow or a per-site fix, defer to the dedicated doc.

## Before shipping anything — read this first

Fidelity before cleanliness, always. I've shipped "clean-looking" outputs that were missing 30+ lines of content every time I skipped this order.

**Five failure modes I keep hitting**:

1. **Validating against my mental model, not source truth.** A 1,645-line prose output can be missing all 28 code blocks; fence count = "looks right", feature count against source = "broken". Always diff against source.
2. **Greps that match what I wanted to strip, not what's in the file.** If my cleanup regex says `^- NAME verb` but the file has `[@user](/user) - NAME verb`, my "0 activity lines" report is a lie. Validate with `grep -vE 'known-good-only' <file>` to surface what slipped through.
3. **Post-processing is subtractive.** If opencli dropped whole structural categories, no regex recovers them — use an extraction fallback (API / raw / git mirror), not another cleanup pass.
4. **Declaring victory on the manifest, not the output.** `source.json` notes "spliced 3/3 mermaid + 3/3 tables" and I call it done — but never opened the `.md` file. Mechanism-level success ("splicer ran") ≠ output-level success ("markdown reads well"). Every claim of "pass" must be grounded in the final file, read end-to-end. Deepwiki splicer shipped with duplicate cell-runs below every spliced table; the manifest said 3/3; the user had to point it out.
5. **Cleanup creates its own artifacts.** Removing a cell-run leaves the `**Label:**` bold lead-in orphaned. Stripping a nav block leaves stray blank lines. Splicing a table leaves a double-blank gap after the heading. Every removal/insertion needs a boundary-check on the paragraph immediately before and after.
6. **Substring assertions are not UI tests.** `assert.match(r.md, /Foo Bar/)` + `assert.match(r.md, /@foo/)` both pass even when "Foo Bar" and "@foo" are 4 paragraphs apart in a stew of half-stripped link wrappers. A green test suite is a necessary gate, not a sufficient one — eye-read the actual output before declaring done. When converting conversational/threaded content, assertions must check rendered SHAPE (`/^\*\*Foo Bar\*\* \[@foo\]\(.*\) · \[date\]\(.*\)$/m`), not just substring presence. The x.com cleaner shipped twice with passing tests before the second pass actually produced a readable thread — the first pass had multi-line link-card wrappers and 4-paragraph-per-tweet whitespace that the substring tests missed entirely.

## 1. Fidelity check (ALWAYS run first)

Count features in output, compare to source. Any category zero in output but non-zero in source → extraction failure, needs a fallback.

```bash
f=raw/raindrop/<host>/<slug>/content.md
echo "lines=$(wc -l < $f)  chars=$(wc -c < $f)" \
     "fences=$(grep -c '^```' $f)" \
     "tables=$(grep -c '^|' $f)" \
     "images=$(grep -oE '!\[' $f | wc -l)" \
     "headings=$(grep -c '^#' $f)" \
     "FM=$(head -5 $f | grep -c 原文链接)"
```

For source-truth: use raw/API when available (clean markdown); curl HTML only as last resort (feature counts are proxies: `<pre>`, `<table>`, `<img>`).

**Questions in order**:
1. Any feature count 0 in output but non-zero in source? → fallback needed.
2. Output `wc -c` < 80% of source body `wc -c`? → real content removed (not chrome).
3. Every H2/H3 in source also in output? → `diff <(grep -E '^#{1,3} ' src) <(grep -E '^#{1,3} ' out)`.
4. Exactly one `# ` H1 in the output? → `grep -c '^# ' $f` must equal 1 (the frontmatter title). A second H1 from the source's own page-title block is a contract violation — demote or strip.

If any fail, STOP. Extraction fix, not cleanup.

**Treat every `0` in the counts line as a STOP, not a data point.** "Plausible for a prose article" is how I rationalized `tables=0` on a zhihu article that had two comparison tables flattened into per-cell paragraphs. The counts are a pass/fail test, not a readout. For any column that's 0, spend 30s on the source: `curl -sfL <url> | grep -oE '<table|<pre|<img' | sort | uniq -c`. If the source has non-zero instances and the output has zero, that's an extraction bug, full stop — no "maybe this article just doesn't have any."

**After counts pass, read the output.** Counts are necessary but not sufficient. Before declaring done: skim the first 30 lines (chrome at top?), last 30 lines (chrome at tail?), and one mid-document section around each spliced element (orphan lead-ins? missing blank lines around fences/tables? doubled blank lines after headings?). If I can't spot these in counts, I have to read the text.

**Per-host regression gate**: each adapter-covered host has a snapshot at `tools/__tests__/snapshots/<host>/<slug>.md` paired with a `<slug>.invariants.json` sidecar (feature counts captured at snapshot time). The test suite asserts feature-count invariants, not byte equality, so legitimate editorial revisions don't flake. When a snapshot test fails: re-fetch fresh, diff against snapshot, decide site-changed vs adapter-regressed (per the regression-triage workflow in the per-site plan).

## 2. Output contract

Every fetched source must produce markdown in this shape:

```markdown
# <Title> [· <org>/<repo>] [· Issue #NNN]

> 原文链接: <source URL>
[> <one-line metadata — released by / authors / date — if available>]

---

[body]
```

For conversation-style pages (PR / issue / discussion), body uses the **split speaker format**:

```markdown
## <username>

> opened this [discussion] on <Mon D, YYYY> [· <Role>]

<body markdown — H3 and below>

## <other-username>

> commented on <Mon D, YYYY> [· <Role>]

<comment body>
```

Discussion replies use `> replied on ...` (distinct from `> commented on ...` so threading is visible).

## 3. Formatting rules (do not re-ask)

- **No `**bold**` inside headings or already-emphasized text.** "When everything is bold, nothing is emphasized." Applies to H2/H3/H4, list-item leaders that are already bold, etc.
- **Attribution is a blockquote below the name heading, not part of the heading.** `## qgallouedec\n\n> opened this on Jun 1, 2025 · Member` — NOT `## qgallouedec opened this on Jun 1, 2025 (Member)`.
- **PR / issue / discussion bodies contain only OP + comments.** No activity timeline (merged / added label / mentioned this / self-assigned / closed / pushed / reopened / etc.), no reviewer rows, no participant avatars, no emoji-reaction counts. If it isn't a contentful message from a human or bot, strip it.
- **Heading hierarchy follows the outline.** Speakers at `##`, their body at `###`+, sub-subsections at `####`+. When injecting a speaker heading, demote the body's existing `##` → `###` so nothing outranks its parent.
- **Backticks for semantic tokens only.** Commit SHAs (`` `c0925be` ``), label names (`` `enhancement` ``), paths, flags. Not actor names, not dates, not section titles.
- **Avatars: strip.** Three DOM shapes (below). For `/username`-style relative links with no non-image text, DROP the whole unit. For external links (badges, shields), keep `[alt](url)` so the label survives.
- **Images: all local.** Never ship a `![](https://...)` remote URL. Any URL surviving to final output means `processImages` didn't see it. New adapters must pipe their markdown through `processImages` before returning.
- **Stubs are a deliberate output, not a failure.** Auth-gated, interactive-app, or page-removed pages produce a stub template (below) AND the processor emits `extraFlags: ["intentional-stub"]`. classifyQuality strips the flag and suppresses size-based flags.
- **Raw files are user-visible too.** `raw/<slug>/content.md` is not an internal cache — it's opened for inspection. Defects belong in the host's converter under `tools/sites/<host>/converter.ts` (DOM level, before turndown), NOT as downstream regex patches. The shared post-cleanup pipeline (`tools/sites/_shared/post-cleanup.ts`) does host-agnostic cosmetic fixes only.
- **Splicer insertions must self-check spacing.** When inserting a block between existing content, the result should have exactly one blank line on each side — not zero, not two. Don't blindly prepend `\n\n`: if the preceding chunk already ends with `\n` (e.g. `insertAt` is right after a heading line), one `\n` is enough. Same for trailing. A `\n\n + block + \n` inserted after `...Heading\n\nintro...` produces `Heading\n\n\nblock\n\nintro` → triple newline. Reason through the surrounding whitespace before choosing the glue.
- **Removals must check boundaries.** After deleting a span, inspect the line immediately before the cut (might now be an orphan label like `**Component Roles:**` with no body) and the line immediately after (stray blank? merged paragraph?). Extend the removal range to swallow the orphan when it's clearly tied to the removed content.

### Stub template

```markdown
# <Type>: <identifier>

> **Source:** <original URL>
> **Status:** <one-line reason — auth-gated / interactive-app / page-removed>

*This entry is a metadata stub. <what the reader should do — "visit the URL" / "fetch via X tool" / "page archived">*
```

## 4. Fix recipes

**When §1 flags a bug whose shape matches a recipe below, apply — don't ask.** Full regex bodies + tables live in [`Meta/fix-recipes.md`](Meta/fix-recipes.md); this section is the symptom-to-recipe index.

| Symptom | Recipe (in `Meta/fix-recipes.md`) |
|---|---|
| Missing body / comments / tables / code blocks | "Missing body / comments / tables / code blocks" — fallback table for HF blog / github API / raw-mirror routing. Rate-limit note: set `GITHUB_TOKEN` for 5000/hr. |
| Activity timeline leak (`merged`, `mentioned this`, `pushed a` lines bleeding through) | "Activity timeline leaking through" — regex shape + ordering rules for the 4 avatar-residual prefix variants. |
| DeepWiki mermaid diagrams as orphan labels (`Cluster GPU Resources` floating loose) | "DeepWiki mermaid diagrams leaking as orphan labels" — covers wiki.litenext.digital data-attr + deepwiki.com hydration-JSON paths; `isDiagramNode` thresholds + `minRun` heuristic; `deepwiki-mermaid-splice-incomplete` guard. |
| WeChat / mdnice malformed bold / lists / multi-line code (Layer-4 hosts) | "WeChat / mdnice malformed bold + lists + code" — 11-row symptom table: unbalanced `*`, nested `<strong>`, mis-tagged `data-lang`, jsdom style-shorthand crash, SVG-diagram-as-image, etc. |
| x.com / Twitter | "x.com / Twitter" — deterministic stub only (auth-walled). Visible-content extraction lives in git history. |
| KaTeX triple-rendered math (HuggingFace blog) | "KaTeX triple-rendered math" — V1/V3 suffix-match collapse + `\\cmd → \cmd` cleanup. |
| Avatar residuals / badges (3 DOM shapes) | "Avatar residuals / badges" — process order: Nested → Separated → Bare `[@name](/name)`. |
| GitHub UI chrome bleed-through (CI / Verified / Editor toolbar / Release reactions / etc.) | "GitHub UI chrome bleed-through" — 10-row category table + `match` predicate (DO NOT widen beyond `pull|issues|discussions/\d+`) + 14-stage post-processor ordering. |

**The pause to ask is only warranted when the fix is novel, destructive, or scope-unclear.** If the recipe is documented, apply it. The recipes exist so documented-symptom bugs become commits, not tickets. ("Want me to fix?" after finding a recipe-matched bug wastes a round-trip — on zhihu I ran §1, found `tables=0`, wrote an abstract report, and asked permission instead of applying the `<table>` DOM-extraction recipe. Don't do that.)

## 5. New-URL / new-host protocol

### 5a. The universal pattern (the only architecture)

Every URL flows through a self-contained site module under `tools/sites/<host>/`. The module owns the full pipeline from URL to clean §2 markdown. opencli is used for browser session + auth ONLY (or not at all if a structured source exists); we never consume opencli's lossy markdown output as the canonical content.

Routing is **total**: `tools/sites/_default/` is registered last in the router with `match: () => true`, so `routeSite(url)` always returns a Site (never null). There is no legacy fallback path. After every `site.fetch()` returns a Result, `applyPostCleanups()` runs 8 host-agnostic cosmetic fixes — see `tools/sites/_shared/post-cleanup.ts`. That's the entire pipeline.

References for new modules:
- Simplest article-shape host: `tools/sites/aleksagordic/` (15-line factory config)
- API source: `tools/sites/github/` (REST + raw-URL paths)
- Raw-markdown mirror: `tools/sites/huggingface/` (GitHub mirror for /blog/)
- Browser-eval SPA: `tools/sites/weixin/`, `tools/sites/xhs/`, `tools/sites/zhihu/`
- Stub-only: `tools/sites/feishu/`, `tools/sites/x-twitter/`, `tools/sites/qwen-ai/`
- Catch-all: `tools/sites/_default/` (permissive selectors + chrome dropSelectors)

Architecture doc: [`docs/fetcher-architecture.md`](docs/fetcher-architecture.md). Migration recipe: [`tools/sites/MIGRATION.md`](tools/sites/MIGRATION.md).

**Source-of-truth selection** for the site's fetcher — pick the cleanest available source:

| Source available | Use it via | Examples |
|---|---|---|
| **REST / GraphQL API** that returns structured data | `curl` or `fetch` directly; convert JSON → markdown ourselves | github (issue/PR/discussion/release APIs) |
| **Raw markdown** in a public repo or CDN | `curl raw URL`; pass through with image localization | huggingface /blog (`raw.githubusercontent.com/huggingface/blog`) |
| **Server-rendered HTML with stable selectors** | plain `curl` + JSDOM + per-host rules — usually via the article-site factory | aleksagordic, lmsys, qwenlm.github.io, arxiv abstracts, sebastianraschka, anthropic |
| **JS-rendered SPA / auth-gated** | `opencli browser open` + `browser eval` to extract `outerHTML`; then own the conversion | xhs, weixin, zhihu, reddit (web-components) |
| **No usable content** | emit `intentional-stub` deterministically from the URL | feishu, x.com, qwen.ai |

When adding a new host module, defects belong in the site's own `converter.ts` (DOM-level, before turndown), NOT in cross-cutting cleanup. The cross-cutting pipeline only does 8 universal fixes (color tags, single-H1, relative-URL resolution, etc.) — anything host-specific is the host module's responsibility.

**Steps to add a new host module** (see [`tools/sites/MIGRATION.md`](tools/sites/MIGRATION.md) for the full recipe):

```
   ├─ Step 1: Pick the source per the table above.
   ├─ Step 2: Build tools/sites/<host>/:
   │     index.ts       — { name, match(url), fetch(url, opts) ⇒ Result }
   │     test-hooks.ts  — re-export from index.ts (factory does it for you)
   │     converter.ts   — only if not using the factory (custom DOM logic)
   │   Most blog-shape hosts are 15-line `makeArticleSite({...})` configs.
   ├─ Step 3: Register the site in tools/sites/index.ts (BEFORE _default)
   │   AND tools/sites/test-hooks-registry.ts.
   ├─ Step 4: Generate fresh markdown for ≥3 representative URLs. EYE-READ
   │   each (do not skip). Show to the user for approval before locking.
   ├─ Step 5 (AFTER user approves md quality): capture fixture + snapshot:
   │     npx tsx tools/__tests__/approve.ts --site <host> --name <slug>
   │       --url <url> --slug <host>-snap-<slug> --yes
   │   Capture ≥3 fixtures covering distinct content shapes.
   └─ Step 6: Run npm test (must be green) + commit (one host per commit).
```

**Do NOT** add fixtures or snapshot-tests until the user has eye-read the markdown and approved the quality. Locking in tests around bad output silently bakes regressions in.

### 5b. Long-tail graduation watchdog

`hirono raindrop check` flags hosts that crossed from count==1 → count>=2 since the last accepted snapshot. Address each via Step 1+ above, then `hirono raindrop check --update-graduation-snapshot` to bake the new counts into `tools/opencli/host-counts.json`. Non-zero exit code if there are unaddressed graduations.

### 5c. Iterate on the first 1–2 outputs before bulk-processing

Don't guess the quality bar — preferences (what's content vs chrome, formatting choices) aren't knowable from markdown alone. Show the user the first sample and iterate.

### 5d. Where code lives (universal pattern)

- **All per-host code** → `tools/sites/<host>/{index,fetcher,converter,metadata}.ts` + fixtures under `tools/__tests__/fixtures/converters/<host>/` and snapshots under `tools/__tests__/snapshots/<host>/`. Every host module owns its full pipeline.
- **Cross-site primitives** → `tools/sites/_shared/`:
  - `article-site-factory.ts` + `article-converter.ts` — the 15-line config pattern most hosts use
  - `post-cleanup.ts` — `applyPostCleanups()` and the 8 host-agnostic cosmetic cleanups
  - `markdown-cleanups.ts` — bold-spacing walker + quad-asterisk collapse (used by converters before turndown output is finalized)
  - `generic-converter.ts` — JSDOM + turndown plumbing
  - `types.ts` — the `Site` contract every module exports
  - `test-hooks-types.ts` — `SiteTestHooks` contract
  - `browser-eval-json.ts` — opencli browser-eval helpers (only for D-bucket modules)
- **Recipes for non-obvious patterns** (auth walls, hidden APIs, multi-step extraction) → §4 of this file.

There is no legacy location for new code. All host-specific cleanup belongs in the host's site module; only host-agnostic cosmetic fixes belong in `_shared/post-cleanup.ts`.

### 5e. Direction-finding for new hosts (cross-host patterns)

Content-shape taxonomy, universal chrome categories, cleanup ordering invariants, first-pass eye-read checklist, and source-of-truth detection heuristics — all live in [`Meta/site-handling-patterns.md`](Meta/site-handling-patterns.md) §7. Read it before writing a new site module; the catalogues classify the host shape, scan for chrome categories, and plan cleanup ordering so you converge on the right recipe instead of starting from blank.

## 6. Regression set

Before committing post-processor/adapter changes, re-export these AND check each against the contract. `block-ship` one-liner below each table row flags obvious regressions.

| URL | Contract | Status |
|---|---|---|
| `huggingface.co/blog/train_memory` | 19 KaTeX triplets + 5 single-var collapsed, `\cmd` not `\\cmd`, author callout, images local | good · ~14KB |
| `huggingface.co/blog/smollm3` | 23 anchor prefixes stripped, 23-author `> **Authors:**` callout, no KaTeX | good · ~26KB |
| `huggingface.co/blog/moe` | GitHub-raw fallback fires, ~30KB body, 12 images | good · ~30KB |
| `huggingface.co/spaces/mteb/leaderboard` | L2 skip, no `raw/` dir written | skipped (exit 0) |
| `github.com/huggingface/trl/pull/3521` | 3 speakers (OP + 2 comments), ≥1 table, ≥4 fences, zero activity, zero `@`-mentions | good · ~6KB |
| `github.com/sgl-project/sglang/issues/8965` | OP + ~12 commenters, split-speaker format, OTel-tracing FR, 4 visualization screenshots, zero activity/avatars | good · ~11KB |
| `github.com/pytorch/torchtitan` | README raw fetch, ≥18 fences, 8 local badge images, no `<div>` | good · ~11KB |
| `github.com/pytorch/pytorch/releases/tag/v2.5.0` | Release API body, ≥18 fences, ≥10 table rows, `> Released by ... · date · tag` metadata | good · ~91KB |
| `github.com/ggml-org/llama.cpp/discussions/5138` | REST API body + 24 speakers (7 top + 17 `> replied on`) | good · ~9KB |
| `wiki.litenext.digital/wiki/slime?file=02-distributed-orchestration` | 9 mermaid code blocks via deepwiki splicer, 0 orphan `\n` labels outside fences (see "DeepWiki mermaid diagrams leaking as orphan labels" recipe) | good · ~29KB |
| `mp.weixin.qq.com/s/PcyKi5q8zT-tJ_9rzgKSqg` (Anthropic Skills) | Layer 4 raw-HTML, 30 fences, 0 doubled markers, 0 unbalanced bold runs, YAML body intact | good · ~6KB |
| `mp.weixin.qq.com/s/FcK3QmzudPZzqsz85odFlQ` (GPU container) | Layer 4 raw-HTML, 14 fences, 21 table rows, 1 SVG diagram preserved as `weixin-snap-gpu-container-images/weixin-svg-001.svg` (with inline styles), all multi-line code blocks intact | good · ~6KB + 20KB SVG |
| `mp.weixin.qq.com/s/44_UrbaQu2U1EAB9OrGNxQ` (Xiaomi interview) | Layer 4 raw-HTML, image-heavy interview, 15 images downloaded, `**作者丨何煦阳**` properly merged from adjacent strongs | good · ~12KB |
| `x.com/garrytan/status/2042497872114090069` | tools/sites/x-twitter/ stub: `# Tweet / X post` + `intentional-stub` flag — Twitter/X auth-gates content | stub · ~500B |

**Block-ship one-liner** (anything > 0 for remote_imgs/activity, or FM == 0, or feature < contract → DO NOT SHIP):

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

## 6b. Test suite (the gate before commit)

Run `npm test` (cwd `tools/`) before every commit that touches an adapter, converter, or post-processor. The suite is the regression gate; do not bypass it.

```bash
cd tools && npm test           # runs node --import tsx --test __tests__/*.test.ts
```

**Five layers of test coverage** — each catches a different class of bug:

| Layer | File | What fails it |
|---|---|---|
| **Coverage gate** (NEW) | `__tests__/coverage-gate.test.ts` | A site module under `tools/sites/<X>/` is registered in `test-hooks-registry.ts` but missing fixture(s) under `__tests__/fixtures/converters/<X>/` OR a snapshot under `__tests__/snapshots/<host>/`. Surfaces incomplete migrations as failing tests with actionable next-step commands. |
| **Structural rules** (NEW) | `__tests__/structural-rules.ts` (applied by both fixture + snapshot tests) | Captured ground truth (expected.md / snapshot.md) contains a known defect shape: multi-line link wrappers, over-escaped emoji shortcodes, over-escaped image syntax, empty headings, triple newlines, quad-asterisk runs. Layers ON TOP of byte-equal — catches the case where a buggy converter's output got captured as ground truth. |
| Per-host snapshot tests | `__tests__/per-host-snapshot.test.ts` | (a) snapshot `.md` was hand-edited away from its sidecar `.invariants.json`; (b) hard-rule defect (h1 != 1, missing frontmatter, remote refs, etc.); (c) structural-rule violation; (d) local image ref unresolved on disk. |
| Converter-fixture tests | `__tests__/converter-fixtures.test.ts` | **byte-equal diff** between `convertX(frozen-input)` and the saved `expected.md`. ANY drift trips this. PLUS structural rules over the saved `expected.md` (catches buggy ground truth). |
| Pure-function fixture tests | `__tests__/post-process-fixtures.test.ts` | input markdown → assert exact output. Use `assertStructurallyClean(r.md, label)` helper as a backstop for substring matchers. |

**Canonical workflow: `approve.ts` for ground-truth capture / refresh.**

```bash
npx tsx tools/__tests__/approve.ts --site <site> --name <fixture-name> --url <url> [--slug <slug>] [--yes]
```

What it does, in order:
1. Fetches the URL via the site-module's test hook.
2. Runs the converter; runs structural rules over the output (refuses to write if any rule fires).
3. Prints eye-read sections (top 30 / mid 30 / tail 30) per CLAUDE.md §5e.iv.
4. Prints diff vs current ground truth (if exists).
5. Prompts y/n (skip with `--yes` for scripted use).
6. On y, writes fixture (3 files) + snapshot atomically, with rollback on partial failure.

This replaces the legacy multi-step ritual (`capture-fixtures.ts` + `snapshot-create.ts` + manual eye-reading). The legacy scripts remain as low-level primitives for scripting bulk operations, but `approve.ts` is the canonical "I confirmed the output is good" command.

**When converter-fixture tests fail:**

1. Read the byte-offset diff in the failure message.
2. Decide:
   - **Bug** in the new code → fix the code, do NOT regenerate the fixture.
   - **Intentional improvement** → regenerate via `approve.ts` (interactive, runs structural rules):
     ```bash
     npx tsx tools/__tests__/approve.ts --site <site> --name <name> --url <url>
     ```
     The diff vs the existing `expected.md` is shown before the prompt. Always read the diff before approving. Silent fixture regeneration bakes regressions in.
3. Never `--no-verify` past a fixture test failure.

**Adding a new site module to the test infrastructure** (one-file change):

Write `tools/sites/<X>/test-hooks.ts` exporting a `testHooks` declaration (see `tools/sites/_shared/test-hooks-types.ts` for the contract). Add an import to `tools/sites/test-hooks-registry.ts`. The coverage gate (`__tests__/coverage-gate.test.ts`) will then enforce that `<X>` has ≥1 fixture and ≥1 snapshot. Capture via `approve.ts`.

**Coverage target per converter: ≥3 fixtures.** A single fixture catches only the bugs its URL happens to exercise. Three diverse shapes give meaningful regression coverage. The coverage gate accepts ≥1 today (low floor for incremental migration); bump in `coverage-gate.test.ts` when all sites reach ≥3.

**Live-fetch upstream-drift detection** (operator-run, NOT in CI):

```bash
npx tsx tools/__tests__/check-drift.ts [--host <host>] [--site <name>] [--diff-only]
```

Re-fetches every snapshot URL (read from the `source_url` field in the sidecar) and diffs against the saved snapshot. Categorizes per-snapshot as `unchanged` / `trivial-diff` / `significant-diff`. Detects upstream site changes (DOM rearrangements, content updates) that fixture tests miss because they run on captured input. Pre-source_url snapshots are skipped with a message; backfill via `npx tsx tools/__tests__/snapshot-helpers.ts backfill-source-url <md-path> <url>`.

**Coverage target per converter: ≥3 fixtures.** A single fixture catches only the bugs its URL happens to exercise. Three diverse shapes give meaningful regression coverage.

**Assertion shape, not substring presence.** When testing conversion / formatting output, `assert.match(out, /Foo Bar/)` is almost always wrong — it confirms a token survives but says nothing about whether the token is rendered well. Anchor assertions to the rendered SHAPE: byline regex (`/^\*\*Name\*\* \[@handle\]\(.+\)$/m`), card-separator presence (`/\n---\n/`), absence of broken multi-line wrappers (`/\[\s*\n\s*!\[/` must NOT match). When the test would still pass on visibly-bad output, the assertion is too weak. Failed-the-eye-read but passed-the-test is a category of regression that the test suite must catch, because the eye-read step is the most-skipped step in the workflow.

**Path-resolution gotcha** (learned the hard way): test files MUST resolve fixture/snapshot paths via `fileURLToPath(import.meta.url)`, not via cwd-relative literals like `"tools/__tests__/snapshots"`. `npm test` runs with cwd=`tools/`, so a literal would resolve to non-existent `tools/tools/__tests__/...` — the suite degrades to a "no fixtures present" sentinel and silently no-ops every assertion. Caught when running tests reported "60 pass" then `npm test` reported "1 pass" for the same file. (See commit `4ca244e` for the fix.)

**Stability check before relying on a green run:** run `npm test` 3 times back-to-back; the count must be identical and `fail = 0` every time. Filesystem-cache jitter is normal in the duration_ms; test count must not vary.

## 7. Quality flags

`classifyQuality` emits to `source.json.quality_flags`:

| Flag | Meaning |
|---|---|
| `short-body` | Body < 500 chars (generic floor) |
| `below-host-expected-size` | Above 500 but below `HOST_MIN_BODY_SIZES[host].minChars`. URL-path aware (HF `/blog/*` gets 2KB; HF `/spaces/*` excluded) |
| `no-headings-in-body` | ≥ 2KB body with zero `#{1,6}` headings — likely sidebar, not article |
| `loading-skeleton` | `Loading…` / `加载中` / `Please wait` in a < 2KB body |
| `images-declared-but-none-downloaded` | Markdown has images but disk is empty (silent adapter failure) |
| `xhs-download-silent-fail` | xhs adapter exited 0 but saved no images |
| `weixin-image-download-partial` | Layer-4 weixin pipeline: at least one image URL failed to curl-download |
| `auto-skipped-hf-space` | L2 pre-fetch skip |
| `deepwiki-mermaid-extraction-failed` / `deepwiki-mermaid-splice-incomplete` | Browser pass failed, or extracted N sources but placed < N (orphan labels remain) |
| `deepwiki-table-extraction-failed` / `deepwiki-table-splice-incomplete` | Browser pass failed, or some tables couldn't find their preceding heading anchor |

`intentional-stub` (set by stub-producing processors) is consumed by classifyQuality → suppresses size-based flags → never appears in final flags.

## 8. Code pointers

Top-level entry points; click through to [`docs/code-map.md`](docs/code-map.md) for the per-file / per-export breakdown.

- **`tools/fetch-raw.ts`** — library: single dispatch point + raw-archive layout (`AUTO_SKIP_RULES`, `HOST_MIN_BODY_SIZES`, `classifyQuality`, `fetchUrlAndStore`, `downloadImage`, status helpers).
- **`tools/fetch-raw-handlers.ts`** — CLI handler library for the raindrop fetch pipeline. Dispatched from `tools/bin/hirono.ts`.
- **`tools/bin/`** — CLI entry-point scripts: `hirono.ts` (single entry with `raindrop {…}` + `doctor`), `lint.ts`, `reindex.ts`, `preprocess.ts`, `sync.ts`, `ingest_batch.ts`, `build-sources-index.ts`, etc.
- **`tools/sites/`** — every host module (`<host>/index.ts` + `test-hooks.ts` + optional `converter.ts`). `_default/` is registered LAST as the catch-all. `_shared/` holds the article-site factory + post-cleanup pipeline + types.
- **`tools/shared/`** — infrastructure utilities: `atomic-write.ts`, `browser-lock.ts`.
- **`tools/hirono/`** — `hirono` CLI for raindrop-driven bulk fetching: `doctor.ts`, `raindrop/{check,export,fetch-all,refresh-cache}.ts`.
- **`tools/opencli/`** — in-repo home of project-local opencli adapters (`clis/<site>/`, `host-counts.json` graduation snapshot).
- **`tools/__tests__/`** — coverage gate, per-host snapshots, converter fixtures, post-process fixtures, structural rules, `approve.ts` capture command. See `docs/code-map.md` for the per-file purpose.

## 9. Q&A depth fallback

Sources are summaries. When a question needs detail the Source doesn't carry (algorithm steps, specific table rows, full prose, code, caption text), read the raw archive directly via the Read tool. Path mapping: `Sources/YYYY/<slug>.md ↔ raw/raindrop/<host>/<slug>/content.md`, where `<host>` comes from the Source's `source_url:` frontmatter. Siblings: `<slug>.pdf`, `<slug>-figures/`, `<slug>-images-extract.md` (Sonnet multimodal extract — read alongside `content.md` for image-heavy Sources), `source.json`, `revisions.jsonl`.

**Trust the snapshot — don't fetch from the URL.** `content.md` is curated (Marker / browser-eval / site-adapter cleanup); query-time refetch bypasses that. Stale snapshot → `hirono raindrop refetch <slug>` (deliberate state change). Cite answers as `[[Sources/<slug>]]` — Source is the canonical citation node; raw is the receipt store. Path mapping lives here + Meta/schema.md only; never in Source body (Obsidian / Lark can't follow filesystem paths).

### Image-heavy Source workflow

When `shouldExtractImages` triggers (same 5 signals the `source-image-count` lint uses): **Sonnet subagent** extracts verbatim → cache at `<slug>-images-extract.md`. **Opus inline-verifies** any number / §-ref / parameter before citing — Sonnet blends adjacent numbers. **Never Haiku** for dense Chinese text (1568 px cap drops specifics + hallucinates). Prompt + caveat details: memory `feedback_image_extraction_hybrid.md` + `feedback_haiku_image_resolution.md`.

**Image-ref rule (strict)**: 2-5 `![]()` refs only for **genuinely visual** images (diagrams, charts, heatmaps, schematics, dashboards, photos). Text-in-spatial-layout → use a canonical rationale phrase from Meta/schema.md's documented list — the lint enforces canonical-only via exact-string match; paraphrasing breaks the gate.

## 10. Wiki ingest mechanics (raw → `Sources/YYYY/<slug>.md`)

When the user says "ingest N raw sources" / "ingest from raw" / "continue ingesting", this is the canonical flow. There is **no single command** that converts raw → Source; the LLM IS the authoring layer. The rules below are what `lint.ts` enforces — get them right on the first pass, don't ship a cleanup round.

### Decision tree (user said X → run Y)

The hirono CLIs exist because they encode invariants the LLM keeps getting wrong. **Always reach for the CLI first**, not a hand-rolled equivalent. Common asks and their canonical commands:

| User said | First command |
|---|---|
| "fetch new bookmarks" / "pull from raindrop" | `hirono raindrop refresh-cache && hirono raindrop fetch-all` |
| "what's ingestable" / "show pending" | `hirono raindrop ingest-candidates --limit 50 --md` |
| "triage fetch failures" / "what's broken" | `hirono raindrop status --filter <kind>` |
| **"ingest N from raw"** | follow §10 — pick candidates → per-item LLM authorship → validation gate |
| "after ingest, what's the cost?" | `hirono ingest-preview --since HEAD~1` |
| "refine stale" / "regenerate Syntheses" (≥3 items) | **`hirono refine-batch --from-stale --limit N`** — one Sonnet call, 3 tool calls total (see §11) |
| "refine stale" — preview cost first | `hirono refine-all-stale --preview` (see §11) |
| "refine one entity / topic" | `hirono refine-entity "<Name>"` → operator runs Sonnet → `--response <path> --apply` (see §11) |
| "regenerate top-level Synthesis" | `hirono refine-synthesis` (see §11) |
| "find/scaffold a new Entity for X" | `hirono new-entity "<Name>" --kind "<one-liner>"` |
| "find/scaffold a new Topic for X" | `hirono new-topic "<Name>" --what "<one-liner>"` |
| "rename Entity Foo → Bar" | `hirono rename-entity "Foo" "Bar" --reason "<...>"` (atomic — never sed) |
| "merge Foo into Bar" | `hirono merge-entities "Foo" --into "Bar"` (atomic; transfers Observations) |
| "delete Source X" | `hirono delete-source <slug> --reason "<...>"` (atomic; removes raw too unless `--keep-raw`) |
| "clean up orphan entities" | `hirono bulk-delete-orphans --confirm` (lists _seen/ entities with refs=0) |
| "audit the wiki health" | `hirono health-check --scope drift` (read-only LLM-judgment audit) |
| "one-tap curation" / "fix everything safe" | `hirono auto-fix` (Tier-1, no Sonnet spend) or `hirono auto-curate` (Tier-1+2) |
| "lint" / "ready to commit?" | `npx tsx tools/bin/lint.ts` — must end `0 error(s)` |

If a CLI matches the ask, **run the CLI**. Don't hand-roll a sed/awk replacement for `rename-entity`. Don't manually delete Source files for `delete-source`. The CLIs are atomic + log to `Meta/refactor-log.md` + update indexes; hand-rolled equivalents skip those invariants.

### Flow

```
raindrop fetch-all  (already run)  →  pick candidates  →  per-item LLM authorship
                                              ↓                    ↓
                                     ingest_batch start <id>   write Sources/YYYY/<slug>.md
                                                               + append Observations to
                                                               touched Entities/Topics
                                                               + scaffold missing entities
                                              ↓                    ↓
                                     ingest_batch mark-done    reindex + lint (gate)
```

### Picking candidates

```bash
npx tsx tools/bin/hirono.ts raindrop ingest-candidates --limit 50 > /tmp/cands.json
npx tsx tools/bin/ingest_batch.ts plan /tmp/cands.json
npx tsx tools/bin/ingest_batch.ts next --count N    # emits N NDJSON lines
```

For N ≥ 5: spawn parallel Sonnet subagents (5 items each). Subagent contexts are **independent** — they don't inherit CLAUDE.md, so the spawning prompt MUST embed §10 verbatim or the subagent re-derives bugs. For N ≤ 4: serial in the main context (cheaper — prompt cache amortizes, no duplicated `ls Entities/` reads).

### Slug rule (load-bearing — most-missed)

The filename in `Sources/YYYY/<slug>.md` MUST equal the raw folder name **EXACTLY**. The raw folder is `raw/raindrop/<host>/<slug>/`. Do not strip trailing `-小红书`, `-trai`, `-在`, or any other suffix. Do not trim trailing dashes. `checkRawOrphan` in lint emits a hard error on mismatch.

**Resolution**: `grep -lr "<url>" raw/raindrop/*/*/source.json | head -1` → the **parent directory name IS the slug**. Use that literal string; copy-paste, don't retype.

### Source schema (exact)

```markdown
---
created: <ingest-date, YYYY-MM-DD>   # today's date when YOU write this file
updated: <ingest-date, YYYY-MM-DD>   # same as created on first write
type: source
source_url: <verbatim from source.json — keep original utm/share params; lint compares exact strings>
tags: [tag-1, tag-2, ...]            # ≥1 from CANONICAL_TAGS (Meta/schema.md §"Canonical tag vocabulary"); lint ERROR if missing
---

# [<source-publication-date, YYYY-MM-DD>] <Clean Title>

## TL;DR

<1–3 sentence high-density abstract — what + why-it-matters>

## Key claims

- <claim with concrete numbers/specifics; wikilink [[Entity]] / [[Topic]]>
- <...>

## Visual observations

*<canonical rationale phrase, OR 2–5 `![](../../raw/raindrop/<host>/<slug>/<img>.ext)` refs for genuinely visual images>*

## What this changes

<optional — 1–2 bullets on implications; skip if not load-bearing>

## Entities touched

[[E1]], [[E2]], ...

## Topics touched

[[T1]], [[T2]], ...

## Raw source

[host.tld/slug](<URL>) — <1-line provenance: author/date/format>. Read <ingest-date>.
```

### Frontmatter rules (lint-enforced)

**Two date fields, distinct meanings** (per Meta/schema.md):

- `created:` / `updated:` (frontmatter) — the date YOU write/update the Source file (today's real-world date, from `date +%Y-%m-%d` or system time). Both equal "today" on first write.
- `# [YYYY-MM-DD] <Title>` (H1 heading) — the date the SOURCE itself was published or captured. Resolution order:
  1. `source.json.published_at` if set
  2. `source.json.created` (Raindrop bookmark date) if set
  3. The `YYYY-MM-DD-` prefix of the raw archive slug (since `fetch-all` slugifies with that prefix)
  4. First `<time>` element in `content.md` if present
  
  A Source slug `2025-08-23-tensorrt-llm-...` with `created: 2026-05-15` is CORRECT — the source was published in 2025, you ingested it today.

**`tags:` is lint-required**. Pick 2–5 tags from `Meta/schema.md` §"Canonical tag vocabulary" — 5 axes (workload / subdomain / hardware / source-shape / special). Non-canonical tags emit WARN; missing tags emit ERROR. **Don't tag proper nouns** (companies, models, hardware SKUs) — those go in `## Entities touched`.

**`source_url:` is verbatim** from `source.json.url`. Keep utm/share params; lint compares exact strings against the index.

### Canonical "Visual observations" rationale phrases (exact-string match)

If raw has no load-bearing images (the common case for text-heavy sources), use ONE of these exact phrases — paraphrasing breaks the lint check:

- `*No load-bearing images — all panels redundant with body text.*` (xhs comment-screenshots; weixin posts where prose paraphrases each diagram)
- `*No load-bearing images — all panels decorative (logos, badges, photos).*` (github READMEs with chrome only; non-technical xhs)
- `*No load-bearing images — all images text-only (typed content extracted into body).*` (xhs typed summary cards; PDF cover + TOC pages; "screenshot of paragraphs" pattern)
- `*No load-bearing images — figures inline-captioned in raw, no standalone images.*` (papers where Marker captioned figures inline)
- `*No load-bearing images — source has no images.*` (text-only blog posts, API JSON, pure prose)

For mixed cases (some load-bearing + some decorative), include the load-bearing `![](...)` refs AND append: `*Other images decorative — <brief category list>.*`

Litmus test for "load-bearing": can the image's content be fully conveyed in markdown prose, tables, and code blocks? If yes → text-only (use rationale phrase). If no (visual relationships text would lose) → 2–5 `![](...)` refs with one-sentence factual captions.

### Image-extract sidecar (read alongside `content.md`)

If `raw/raindrop/<host>/<slug>/<slug>-images-extract.md` exists, **read it before writing Key claims**. It's a Sonnet-pre-extracted verbatim record of image content (charts, diagrams, dense Chinese text) — saves a re-extraction and surfaces specifics the body text doesn't restate. Don't paraphrase the extract; cite specifics verbatim. (Image-heavy Source signal — see §9.)

### Bullet citation scope (subtle but load-bearing)

- `## Key claims` bullets in a **Source** file have **NO `— [[<own-slug>]]` trailing citation**. The Source IS the citation; self-citing is a category error. (Every subagent gets this wrong on first read; it generated 41 of 50 cleanup edits in the 2026-05-15 batch.)
- `## Observations` bullets in an **Entity/Topic** file DO end with `— [[<source-slug>]]` (just the slug, no `Sources/2026/` path prefix).

### Image-path depth

Source files live at `Sources/YYYY/<slug>.md` (2 levels deep). Image refs use `../../raw/raindrop/<host>/<slug>/<image>.ext`. Not `../raw/...` (1 level), not `../../../raw/...` (3 levels).

### Dead wikilinks → scaffold inline

If you write `[[Some Entity]]` and `ls Entities/ Entities/_seen/` shows no match, you MUST scaffold via `npx tsx tools/bin/hirono.ts new-entity "Some Entity" --kind "<one-liner>"` before declaring done. Topics: same pattern with `new-topic "<Name>" --what "<one-liner>"`. Leaving dead wikilinks for a follow-up pass is the bug shape that produces the most lint errors.

Match existing names exactly — case + spelling. `ls Entities/ Entities/_seen/ Topics/` BEFORE writing the wikilink, not after.

### Append observations (exact shape + atomicity)

For each `[[Entity]]` or `[[Topic]]` mentioned in the new Source, append a bullet to that page's `## Observations` section. Exact shape (mind the em-dash + slug-only citation):

```markdown
- <one-paragraph cited claim with concrete numbers/specifics; wikilink sibling [[Entities]] mentioned in the claim>. — [[<source-slug>]]
```

Notes:
- The trailing citation is the bare slug only — **NO `Sources/2026/` prefix**.
- The em-dash is `—` (U+2014, ` — `), not a hyphen.
- Append at the END of `## Observations`, after existing bullets.
- If the Entity/Topic file doesn't have a `## Observations` heading yet (rare — happens with freshly-scaffolded `_seen/` stubs), add it before the bullet.

**Atomicity**: Read the file immediately before each Edit; retry up to 3× on collision when sibling parallel subagents touch the same file. Don't use Write to wholesale-replace; targeted Edit only.

### Stub-skip rule

If `source.json.extraFlags` includes `intentional-stub`, OR `content.md` is auth-walled / empty / a stub template, do **NOT** write a Source page. Run `npx tsx tools/bin/ingest_batch.ts mark-errored <id> "stub-only"` and move on. Examples: x.com, qwen.ai blog, feishu (foreign tenant), most xhslink shortlinks pointing to xiaohongshu.

### Validation gate (every ingest, no exceptions)

Work is not done until:

```bash
npx tsx tools/bin/reindex.ts                # refs / tier / Meta indexes
npx tsx tools/bin/build-sources-index.ts    # URL→slug index
npx tsx tools/bin/lint.ts                   # must end "0 error(s)"
```

If lint fires errors, fix them before reporting done. `0 error(s)` is the gate — warnings and info are acceptable. Don't commit, don't claim success, don't post the summary until lint is green.

### Parallel-subagent prompt template

When spawning a Sonnet subagent for bulk ingest, the prompt must include:

1. Pointer: "Follow CLAUDE.md §10 for ingest mechanics. Read it first if you haven't."
2. The 5 items as `{id, url, title}` JSON.
3. The per-item loop: `ingest_batch start` → resolve slug → Read raw + source.json → if stub mark-errored skip → write Source → append Observations / scaffold entities → `mark-done`.
4. Report shape: "slugs created, slugs errored (with reason), entities/topics scaffolded. Under 300 words."

The subagent has no CLAUDE.md in its context. If §10 isn't paraphrased in the prompt, the subagent re-derives bugs.

### Post-ingest summary (what to report)

After lint is green:
```
hirono ingest-preview --since HEAD~1
```
Shows new-Sources count + touched-Entities/Topics + stale-flag count + est refine cost. This is the headline number to report back to the user.

## 11. Refine + curation workflows

When the user says "refine X" / "regenerate Synthesis" / "clean up the wiki" / "fix orphans" — there's a canonical CLI for each. **Reach for it, don't improvise**. Many use a common two-step pattern: command writes a prompt to disk → operator (you) runs Sonnet on it → re-run command with `--response <path> --apply` to atomically write back.

### The `--response <path> --apply` two-step (recurring pattern)

Multiple commands (`auto-detect-entities`, `refine-entity`, `refine-topic`, `refine-synthesis`) follow this shape:

```bash
# Step 1: prepare prompt (cheap; no Sonnet spend)
hirono <command> "<target>"                      # writes <prompt>.md to disk

# Step 2: spawn Sonnet subagent
# Use the Agent tool with model:"sonnet" and feed it the prompt-file path.
# Save its raw response (whatever shape the prompt asks for) to <response>.json or .txt.

# Step 3: dry-run (preview the diff)
hirono <command> "<target>" --response <path>

# Step 4: apply atomically (writes Synthesis / scaffolds entities / etc.)
hirono <command> "<target>" --response <path> --apply
```

Never skip Step 3 (dry-run) for production runs. The dry-run reveals which entities will be scaffolded, which Observations will be retained, what wikilinks change.

### Sonnet subagent template (Step 2 of the two-step)

The "spawn Sonnet" step is **always via the Agent tool with `model:"sonnet"`** — never `curl` to the API, never a shell `claude` invocation. The wiki's preamble caching depends on the Anthropic-side prefix-match — only Agent-tool calls hit the right code path.

Literal template (paraphrase per command):

```
Agent({
  description: "Refine <Name> Synthesis",
  subagent_type: "general-purpose",
  model: "sonnet",
  prompt: `Read the file at <repo-root>/.refine-prompts/<Name>-synthesis-prompt.md (or wherever the CLI wrote it; the CLI prints the path on success). Follow its instructions exactly. Output ONLY the requested artifact (e.g., 4–6 sentences of plain prose for refine-entity) with no preamble or wrapper text. The CLI pastes your output verbatim — extra text breaks the apply step.

Write your output to <repo-root>/.refine-prompts/<Name>-synthesis-response.txt then report the file path. Under 50 words of meta-commentary.`
})
```

Response-file path convention per command (where the CLI looks when you pass `--response <path>`):

| Command | Prompt file (CLI writes) | Response file (you write) |
|---|---|---|
| `refine-entity "<N>"` | `.refine-prompts/<N>-synthesis-prompt.md` | `.refine-prompts/<N>-synthesis-response.txt` |
| `refine-topic "<N>"` | `.refine-prompts/<N>-topic-prompt.md` | `.refine-prompts/<N>-topic-response.txt` |
| `refine-synthesis` | `.refine-prompts/top-synthesis-prompt.md` | `.refine-prompts/top-synthesis-response.txt` |
| `auto-detect-entities <slug>` | `raw/raindrop/<host>/<slug>/<slug>-entities-prompt.md` | `raw/raindrop/<host>/<slug>/<slug>-entities-response.json` (JSON, not text) |
| `propose-curation` | `Meta/.propose-curation/prompt.md` | `Meta/.propose-curation/response.json` (JSON) |

Use these literal paths; the CLI's `--response <path>` accepts absolute or repo-relative. **Don't invent custom paths** — operator-workflows.md §11.2 indexes the canonical locations.

### Prompt-cache invariants (don't reorder, don't paraphrase)

The token-cost architecture depends on a strict layout: cache-friendly preamble FIRST, curated-Source excerpts MIDDLE, variable context LAST. The Anthropic API caches by exact-prefix match on a 5-min TTL — every byte change invalidates the cache.

The preamble strings live in `tools/hirono/_shared/prompt-preamble.ts` as deterministic constants (no interpolation, no dates). **Never edit them inline in a prompt file or response text** — that breaks every cache hit for ~5 minutes. If you need to refine the wording of an Entity-refine instruction, edit `prompt-preamble.ts` in code (a single commit, all callers updated) — don't hack the generated `.refine-prompts/*.md` file.

The Sonnet subagent's response (Step 2 output) is also paste-verbatim: 4–6 sentences for `refine-entity`, no preamble, no wikilinks inside the Synthesis itself (per `REFINE_ENTITY_PREAMBLE` in `prompt-preamble.ts:24-50`). The CLI prepends `## Synthesis\n\n` and writes the file atomically; if the response has a `## Synthesis` header or markdown fence, you get a doubled heading.

### `auto-detect-entities <slug>` — LLM-NER for a Source

When to run: AFTER you've manually authored `Sources/YYYY/<slug>.md` per §10 and want to discover entities/topics you missed.

```bash
hirono auto-detect-entities <slug>                                       # writes prompt
# spawn Sonnet → save JSON response
hirono auto-detect-entities <slug> --response <path>                     # dry-run
hirono auto-detect-entities <slug> --response <path> --apply             # creates _seen/<canon>.md stubs
```

Does NOT insert wikilinks into the Source body — that's still your job (read the dry-run output, decide which to add, edit the Source). Consults `Meta/entity-aliases.md` for normalization (LLaMA → Llama, bfloat16 → BF16). Operator-workflows.md §11.1 is the deep-dive.

### `refine-entity` / `refine-topic` / `refine-synthesis` — regenerate Synthesis sections

Each Entity has a `## Synthesis` and each Topic has a `## Current understanding` paragraph. These rot as Sources accumulate. The 7-day staleness lag (`STALE_LAG_DAYS = 7` in `lint.ts:862`) marks pages whose Synthesis is older than the newest citing Source by >7 days.

```bash
# Single Entity
hirono refine-entity "<Name>"                                            # writes prompt to .refine-prompts/
hirono refine-entity "<Name>" --response <resp> --apply                  # atomic rewrite

# Single Topic
hirono refine-topic "<Name>" [--response <resp> --apply]

# Top-level Synthesis.md (corpus-wide thesis)
hirono refine-synthesis [--response <resp> --apply]
```

All three use the cache-friendly preamble (stable across calls; Anthropic's 5-min cache TTL amortizes) + curated Source excerpts (`tools/hirono/_shared/source-excerpt.ts`) — see `Meta/operator-workflows.md` §11.2 for the token-cost architecture. The per-call measure sidecar at `<prompt>-measure.json` shows char-count + est-tokens.

### `refine-batch` — N entities in ONE Sonnet call (preferred for ≥3 entities)

Per-entity `refine-entity` is 3 tool calls each — for 10 entities that's 30 tool calls + 10 fresh Sonnet contexts each paying full preamble cost. `refine-batch` collapses this to **3 tool calls total** for any N:

```bash
# Prepare: one merged prompt covering N entities (preamble FIRST, blocks LAST)
hirono refine-batch <name1> <name2> ...                    # explicit names
hirono refine-batch --from-stale [--limit N]               # pull top-N stale

# Spawn ONE Sonnet via Agent tool — instruct it to read .refine-prompts/batch.md
# and write marker-delimited response to .refine-prompts/batch-response.txt

# Apply: parses markers, invokes refineEntity's atomic apply path per item
hirono refine-batch --response .refine-prompts/batch-response.txt           # dry-run
hirono refine-batch --response .refine-prompts/batch-response.txt --apply   # commit
```

**Why batched-single beats parallel-N**: the preamble bills exactly once within one Sonnet conversation (vs N times across N independent calls). Sonnet also sees all N entities together — can align framing where the same Source is cited across multiple. Plus 1 Agent call instead of N — less LLM-side orchestration risk.

**Marker format** (parser-strict; the prompt body instructs Sonnet identically):

```
=== entity: <Name1> ===
<4–6 sentence Synthesis paragraph; plain prose; no preamble; no wikilinks inside>

=== entity: <Name2> ===
<4–6 sentence Synthesis paragraph>
```

The CLI cross-checks parsed names against the saved `batch.md` and reports `missingFromResponse` (Sonnet skipped one) + `unmatchedInResponse` (Sonnet hallucinated a name). Apply is per-entity atomic — one bad block fails just that item, the rest still commit.

**When to use which**:
- 1–2 entities: `refine-entity` is fine (no orchestration saving).
- ≥3 entities or any "refine all stale" task: **`refine-batch --from-stale --limit N`** — single CLI invocation, single Sonnet, single apply.

### `refine-all-stale` — batch refine with cost discipline

The storm-containment command. After bulk ingest, dozens of Entities/Topics flip stale at once.

```bash
# Always preview before authorizing
hirono refine-all-stale --preview          # NO Sonnet spend — prints count + est tokens + est $
hirono refine-all-stale --list             # lists stale items sorted by lag-days desc
hirono refine-all-stale --limit N          # write prompts for top-N most-stale items only
hirono refine-all-stale                    # full batch (NO cap — only run after --preview)
```

**Discipline (from `feedback_*` memory + operator-workflows §11.3)**:

- **Ingest frequently, refine rarely**. Let the 7-day lag accumulate so one refine batches multiple Sources' worth of drift.
- **--preview before any refine batch**. Always. Burning Sonnet calls without knowing the count is a known waste mode.
- **--limit N is resumable**. Per-item `synthesis_updated_at` counters are independent — refining top-20 stalest items today leaves the rest for tomorrow's session. Chain `--limit N` across days without breaking anything.
- **Default cadence**: when `hirono ingest-preview --since HEAD~7` shows >10 stale items, run `--preview`, decide a cap (typical: 10–20), run `--limit N`.

### `ingest-preview` — headline cost preview after ingest

```bash
hirono ingest-preview --since HEAD~1       # what fan-out did the last commit produce?
hirono ingest-preview --since-date 2026-05-08
```

Outputs: new-Sources count, touched-Entities/Topics count, currently-stale count, est refine cost ($) at current Sonnet pricing. Run this after every ingest commit to see whether the storm is forming.

### Curation primitives (atomic, log-tracked)

**Use these instead of manual sed/mv/rm.** Each is atomic, writes to `Meta/refactor-log.md`, and updates the relevant indexes.

```bash
hirono rename-entity "<Old>" "<New>" --reason "<one-line>"          # rewrites all wikilinks repo-wide
hirono merge-entities "<Src>" --into "<Tgt>"                        # transfers Observations + links, deletes Src
hirono merge-topics   "<Src>" --into "<Tgt>"                        # same for Topics
hirono delete-source <slug> [--keep-raw] [--force] --reason "..."   # removes Source + raw archive (unless --keep-raw)
hirono bulk-delete-orphans [--confirm | --all-zero]                 # _seen/ entities with refs=0
```

When the user asks "rename Foo to Bar", `rename-entity` does (a) the file rename, (b) every wikilink rewrite across Sources/Entities/Topics, (c) the refactor log entry. Hand-rolled `mv` + `sed` skips (b) and (c) → produces dead wikilinks + missing audit trail.

### `auto-fix` and `auto-curate` (one-tap)

**`auto-fix`** (Tier-1, NO Sonnet spend, NO deletions): safe alias-merges + refine-prompt prep + index refresh. Pre-commit-hook-safe.

```bash
hirono auto-fix [--dry-run]
```

**`auto-curate`** (Tier-1 + Tier-2 unified loop): runs `auto-fix`, then `propose-curation` (Sonnet proposes merges/refines/orphan-deletes based on `health-check` + lint), then `apply-queue`. Default is full-auto on Phase 2; pass `--review` for operator-checkbox.

```bash
hirono auto-curate                          # full-auto Phase 2
hirono auto-curate --review                 # operator approves each proposal
hirono auto-curate --continue               # resume after interruption
```

When user says "tidy up" / "fix what's broken" / "one-tap cleanup" — reach for `auto-curate`.

### `propose-curation` / `apply-queue` — Tier-2 separately

If you want the propose step without auto-applying:

```bash
hirono propose-curation                     # Sonnet writes Meta/curation-queue.md
# operator reads, marks [x] APPROVED on each item
hirono apply-queue [--auto-apply <level>]   # dispatcher executes approved items via atomic CLIs
```

### `health-check` — read-only LLM-judgment audit

```bash
hirono health-check                          # all scopes
hirono health-check --scope drift            # cross-source contradictions
hirono health-check --scope sources          # source-quality patterns
```

Outputs proposed actions WITHOUT executing. Operator-workflows.md §12 deep-dive. Run weekly or when things feel drifty.

### Validation gate (after any refine / curation)

Same as §10:

```bash
npx tsx tools/bin/reindex.ts
npx tsx tools/bin/build-sources-index.ts
npx tsx tools/bin/lint.ts                   # 0 error(s) required
```

`refine-*` and `auto-curate` already update indexes for their changes, but re-running these three is cheap and catches anything that drifted across operations.

## Auto-capturing learnings (no reminder needed)

When a unit of work finishes — a bug fix, a pattern recognized, a tool quirk discovered, a design choice made after benchmarking — pause and ask: **"would a future session reading this avoid the trap or shorten the path?"** If yes, capture immediately. Don't wait for the user to remind you. The user's prompt to "remember this" is the failure mode this section exists to prevent.

The general-purpose docs already exist; the work is **routing the lesson to the right one** without asking, and writing it in the shape that file expects.

### Trigger conditions (run the capture-or-skip check after)

- Shipping a fix that addresses a CLASS of bugs, not just one slug.
- Discovering a tool / library / site quirk that would have saved you 30+ min if documented earlier.
- The user pointing out a mistake — capture so future sessions don't repeat it.
- Picking one approach over another after benchmarking — record the comparison + reasoning so the next session doesn't re-run the same benchmark.
- Hitting a constraint that limits a design (rate limit, auth flow, encryption, license).
- Finishing an iteration of a pattern-discovery loop (Phase 2 / playbook iterations) — the iteration's report IS the capture trigger; don't end the iteration without an entry.

Skip when:
- The fix is genuinely one-off and doesn't generalize (single-slug content correction, typo).
- The lesson is already documented somewhere — search first, don't duplicate.
- The "lesson" is a hunch — wait for a second instance to confirm the pattern.

### Destination — lesson type → file

| Lesson type | File |
|---|---|
| New site-handling pattern | `Meta/site-handling-patterns.md` §2 (P-NN entry) + §1 quick-lookup row + §3 technique index if novel |
| Recurring anti-pattern (a mistake to avoid) | `Meta/site-handling-patterns.md` §6 (AP-NN) |
| Operator workflow change / new pipeline command | `Meta/operator-workflows.md` (the relevant flow's section) |
| Actionable TODO needing human input or future code | `Meta/post-fetch-todo.md` |
| Wiki page conventions (frontmatter, tiers, page types) | `Meta/schema.md` |
| Cross-document drift / contradictions / cleanup TODOs | `Meta/linting-notes.md` |
| Code-quality rule that should fire on every commit | this file (`CLAUDE.md`) §3 — rules-of-conduct only |
| Architectural shift in the fetcher | `docs/fetcher-architecture.md` |
| New per-host module recipe variant not covered above | `tools/sites/MIGRATION.md` |

If the lesson straddles two files (a pattern + a TODO for its automation), write it in BOTH and cross-link. P-37 + post-fetch-todo §2 is the worked example.

### Quality bar (both gates must pass)

1. **Durable** — the constraint or pattern won't disappear in a month. Library version-specific quirks usually fail this gate; design constraints usually pass.
2. **Generalizable** — applies to more than the one slug / file / URL where you hit it. Single-slug content fixes fail this gate; class-of-bugs fixes pass.

### Capture shape (match the destination's existing entries)

- **Pattern entries** (`P-NN`, `AP-NN`): five-bullet shape — Symptom · Root cause · Remediation · Generalization · Reference. Mirror surrounding entries' tone (terse, file-path references, runtime code examples).
- **TODOs**: `- [ ] **<short title>** (<scope>). <one-paragraph description with the recipe / file paths / commands>.`
- **Workflow updates**: flow diagram + command sequence + "what to expect on success" + "what to do when X happens." Match `operator-workflows.md`'s flow shape.
- **Code-quality rule in CLAUDE.md**: imperative voice + short rationale + match §3 Formatting rules style.

### Recent self-trigger examples (proof the loop fires)

- P-37 (body-selector cascade missing content) captured after one manual slug fix, with paired automation TODO in `post-fetch-todo.md` §2.
- P-36 mupdf-vs-poppler benchmark captured so future sessions skip the re-run.
- `**[label]**` markdown mistake captured INSIDE P-37's recipe (reading-context placement) rather than a separate AP-NN — mistake was scoped to one script.
- Phase-2 pattern-discovery iterations: each pattern got cross-links + sibling-pattern callouts, so the playbook is symptom-navigable.

## Keeping this file fresh

Update AFTER landing a fix, not during investigation. Durable learnings only — don't log every incident, just the pattern that would generalize to new URLs. Remove struck-through / resolved entries once a session passes without triggering the old bug.
