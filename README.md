# HIRONO WIKI

Personal LLM-maintained wiki inspired by [Karpathy's LLM-Wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), adapted to a Raindrop + Lark + TypeScript stack. The repo is the **canonical source of truth**; everything else (Raindrop bookmarks, fetched raw archives, Lark Space 2 projection) is read or projected from it.

## What this repo holds

```
.
├── README.md                    ← you are here
├── CLAUDE.md                    ← rules + recipes for the LLM agent
│
├── Sources/                     ← THE WIKI: one summary per ingested source
│   └── YYYY/
│       └── YYYY-MM-DD-<slug>.md
│
├── Entities/                    ← people / projects / products / models
│   ├── <Name>.md                  active tier (≥3 incoming refs)
│   └── _seen/<Name>.md            seen tier (1–2 refs; auto-promoted at 3)
│
├── Topics/                      ← synthesis pages across multiple sources
│   └── <Topic Name>.md
│
├── Meta/                        ← governance + catalog (NOT content)
│   ├── schema.md                  page conventions (frontmatter, structure)
│   ├── corpus-pipeline.md         the 3-state state machine
│   ├── operator-workflows.md      command runbooks
│   ├── site-handling-patterns.md  per-host fetcher debugging
│   ├── post-fetch-todo.md         bulk-fetch punch list
│   ├── linting-notes.md           drift / contradictions / cleanup
│   ├── log-2026.md                append-only history of ingests / queries
│   ├── index.md  +  index-*.md    auto-regenerated catalogs
│   ├── fetch-decisions.md         human-authored "accept this stub as-is"
│   ├── sources-health-overrides.md
│   ├── sources-ingest-skips.md    last-resort skip-list (spam / duplicates)
│   ├── entity-aliases.md          spelling-variant normalization hints
│   ├── references/                external inspiration docs (Karpathy gist)
│   └── _archive/                  retired meta-docs
│
├── raw/raindrop/<host>/<slug>/  ← RAW ARCHIVE (gitignored, immutable)
│   ├── content.md                 fetched markdown (the source of truth body)
│   ├── source.json                fetch metadata + quality_flags
│   ├── revisions.jsonl            append-only audit trail of refetches
│   ├── <slug>-images/             per-page PNG renderings (for PDFs)
│   ├── <slug>.pdf                 preserved binary (for PDF sources)
│   └── <slug>-img-*.{png,jpg,…}   localized images (web sources)
│
├── tools/                       ← TypeScript pipeline + helpers
│   ├── bin/                       reindex / lint / build-sources-index /
│   │                              ingest_batch / preprocess / sync (+ hirono.ts CLI)
│   ├── sites/<host>/              per-host fetcher modules (factory + _default)
│   ├── hirono/                    subcommand impls; full list via `hirono --help`
│   ├── fetch-raw.ts, curation.ts  fetch pipeline + atomic-mutator library
│   ├── shared/                    infra utils (atomic-write, browser-lock)
│   └── __tests__/                 1190+ tests
│
├── docs/                        ← architecture deep-dives
│   └── fetcher-architecture.md
│
├── .wiki-raindrop-cache.json    ← gitignored: Raindrop API snapshot
└── .wiki-sources-index.json     ← gitignored: URL → ingested-slug map
```

## How to use the wiki

Three distinct usage modes, each reads (and writes) different folders.

### Mode 1 — Browse / learn ("what do I know about X?")

```
Open Meta/index.md  ─►  catalog overview, total counts
       │
       ├──►  Meta/index-topics.md     ─►  Topics/<X>.md
       │                                    ├── "Current understanding" synthesis
       │                                    └── follows [[Sources/...]] links
       │
       ├──►  Meta/index-entities.md   ─►  Entities/<Name>.md (active, ≥3 refs)
       │                                    ├── one-line kind
       │                                    ├── Synthesis
       │                                    └── Observations (cited bullets)
       │
       └──►  Meta/index-sources.md    ─►  Sources/YYYY/<slug>.md
                                            ├── TL;DR
                                            ├── Key claims
                                            ├── Visual observations + inlined figures
                                            ├── What this changes (optional)
                                            ├── Entities / Topics touched
                                            └── Raw source
```

Concrete entry points right now:

| Curiosity | Read first |
|---|---|
| Landscape of LLM inference systems | [`Topics/LLM Inference Systems.md`](Topics/LLM%20Inference%20Systems.md) — 7 sources |
| Is inference disaggregation worth it? | [`Topics/Inference Disaggregation.md`](Topics/Inference%20Disaggregation.md) — 5 sources |
| Kernel-authoring-language landscape | [`Topics/Kernel Authoring Languages.md`](Topics/Kernel%20Authoring%20Languages.md) — 4 sources |
| What NVIDIA published that I read | [`Entities/NVIDIA.md`](Entities/NVIDIA.md) — 8 refs |
| FlashMLA in 60 seconds | [`Entities/FlashMLA.md`](Entities/FlashMLA.md) — 4 refs |
| One specific paper I read | `Sources/YYYY/<slug>.md` |
| What changed recently | [`Meta/log-2026.md`](Meta/log-2026.md) — newest at top |

**Don't read `raw/raindrop/`** for browsing. That's evidence storage. Only consult it to verify a specific claim or to refetch.

### Mode 2 — Add a source ("here's a URL I want to remember")

Three substeps; the wiki layer is the *last* step, not the first.

```
  1. SAVE THE URL              2. FETCH RAW                       3. INGEST
  ───────────────              ────────────                       ─────────────
  Save in Raindrop  ─►  hirono raindrop refresh-cache             chat with Claude:
   (mobile / browser)  ─►  hirono raindrop fetch-all              "ingest <slug>"
                            (pulls new bookmarks into raw/)             │
                                                                          ▼
                                                                Claude writes:
                                                                  Sources/YYYY/<slug>.md
                                                                Touches:
                                                                  Entities/<...>.md
                                                                  Topics/<...>.md
                                                                Appends to:
                                                                  Meta/log-2026.md
                                                                Then run:
                                                                  npx tsx tools/bin/reindex.ts
                                                                  npx tsx tools/bin/lint.ts
                                                                  npx tsx tools/bin/build-sources-index.ts
```

Only Step 1 is fully manual. Step 2 is one command. Step 3 is a conversation with the agent.

**What "touches" means** — entity and topic updates split across two layers, and confusing them is the most common newcomer error:

| Layer | Who writes it | What it produces |
|---|---|---|
| **Editorial** (content) | The LLM, during ingest — or via a Sonnet subagent invoked by `auto-detect-entities` / `refine-entity` / `refine-topic` | `## Observations` bullets on each touched Entity (one atomic claim per citing Source, with `[[Sources/<slug>]]` citation); `## Synthesis` paragraph regenerated when evidence reshapes the picture; `## Current understanding` revised on touched Topics. |
| **Mechanical** (metadata) | `reindex.ts`, after editorial | `refs:` counts; `source_count`; tier promotion (`_seen/` → active at ≥3 refs; **no auto-demotion**); `Meta/index*.md` regeneration; `updated:` timestamps. |

**Observations are not auto-populated.** `reindex.ts` counts incoming wikilinks but doesn't write content. If an Entity has a non-zero `refs:` but an empty `## Observations`, the LLM hasn't yet folded that citing Source's lens into the entity — `reindex.ts` prints a `missing N observations` worklist per entity, naming which Sources still need a cited bullet. That report is the queue for the next ingest pass.

**Wiki mutations are the LLM's job** per Karpathy — "you never (or rarely) write the wiki yourself." Every mutator below is invoked by the agent (during ingest or curation); the operator runs only `raindrop *` + `reindex` + `lint`. All mutators are idempotent (refuse overwrites, validate names, atomic apply) so the LLM doesn't have to remember the safety dance.

| When | Command (LLM-invoked) | Effect |
|---|---|---|
| New entity / topic noticed during ingest | `hirono new-entity <Name>` / `new-topic <Name>` | scaffolds `Entities/_seen/<Name>.md` or `Topics/<Name>.md` |
| Whole-Source NER pass | `hirono auto-detect-entities <slug>` | Sonnet subagent extracts entities → creates `_seen/` stubs atomically; uses `Meta/entity-aliases.md` to dedupe spelling variants |
| Synthesis drifted vs new Observations | `hirono refine-entity <name>` | Sonnet regenerates `## Synthesis` from cited Sources; bumps `synthesis_updated_at` |
| Topic's Current understanding drifted | `hirono refine-topic <name>` | same shape, for `## Current understanding` |
| Batch refresh | `hirono refine-all-stale` | runs lint, prepares prompts for every flagged entity |
| Zero-touch autonomous repairs | `hirono auto-fix` | Auto-applies alias merges from `Meta/entity-aliases.md` + preps refine prompts for stale Syntheses + refreshes indexes. **Never deletes anything.** Safe for cron / pre-commit. |
| Unified curation loop (one command) | `hirono auto-curate` → Sonnet → `hirono auto-curate --continue` | Wraps the full pipeline: auto-fix + propose-curation in Phase 1, finalize + apply-queue in Phase 2. Default Phase 2 is full-auto (`--auto-apply high`); pass `--review` for the one-tap variant where you tick `[x]` boxes first. |
| Operator-judged ingest mistake (rare) | `hirono raindrop forget <url>` | deletes Source + raw archive + adds to `Meta/sources-ingest-skips.md` |

The skip-list is a last-resort registry for spam / permanent duplicates — **not** for off-topic content (Karpathy: the wiki absorbs broadly; operator curation is at the bookmark layer, not the wiki layer).

### Mode 3 — Ask a question ("how does X relate to Y?")

Two flavors:

**Quick lookup** — answer is already in existing pages. Claude reads relevant `Topics/` + `Entities/` + cited `Sources/`, synthesizes inline in chat. No new files written.

**Cross-source synthesis** — answer doesn't exist yet. Claude reads, synthesizes, then **files the answer back as a new `Topics/<question-shaped-name>.md`** and appends a `query | <question>` entry to `Meta/log-2026.md`. This is Karpathy's "compounding artifact" move — the answer becomes part of the wiki, not a disposable chat message. Future questions about the same area start from this synthesis.

**When the Source summary isn't deep enough**, the LLM consults the raw-archive snapshot directly (the locally-cached `content.md` — not the live URL; the snapshot is the curated extraction with Marker / browser-eval / site-adapter cleanup already applied). Sources are deliberately concise (TL;DR + Key claims + a few Visual obs); raw has the original article body, the full author list, every paragraph of prose, every code block. The path mapping between a Source slug and its raw archive is mechanical — Claude Code knows the convention from `CLAUDE.md` (the operator never has to derive paths by hand). Raw is read-only consultation — the wiki layer isn't edited in response — but the LLM's answer in chat can cite raw-derived detail with `[[Sources/<slug>]]`. The Source remains the canonical citation node in the graph; raw is the receipt store.

### "I just opened the repo; what do I click?"

```
1. Open Meta/index.md          ← see what's here at a glance
2. Open Meta/index-topics.md   ← scan for something interesting
3. Click a Topics/<Name>.md    ← read the synthesis
4. Follow [[2026-...]] links   ← drill into specific Sources
5. Open Meta/log-2026.md       ← see what's been changing
```

Or click [`Topics/LLM Inference Systems.md`](Topics/LLM%20Inference%20Systems.md) — densest page in the wiki today.

## How the data flows

```
   Raindrop bookmarks  ─►  .wiki-raindrop-cache.json  (local snapshot)
       (562 today)             │  hirono raindrop fetch-all / sync / refetch
                               ▼
                       raw/raindrop/<host>/<slug>/
                          content.md + source.json + revisions.jsonl + images
                               │  rebuildRawIndex (auto)
                               ▼
                       raw/raindrop/_index.json   (3-state classifier)
                               │
                ┌──────────────┼────────────────┐
                ▼              ▼                ▼
          not-yet-good     ingest-ready     ingested
          (debug per       (LLM ingest      (frozen-slug
           site-handling-   queue)           guard)
           patterns.md)        │
                               │  LLM reads content.md →
                               │  writes Sources/YYYY/<slug>.md
                               ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  Sources/YYYY/<slug>.md     (TL;DR + Key claims +            │
   │                              Entities/Topics touched + …)   │
   └─────────┬────────────────────────────────────────────────────┘
             │
             ├──► hirono auto-detect-entities <slug>  ─►  Sonnet NER pass
             │      creates Entities/_seen/<X>.md stubs (atomic);
             │      `Meta/entity-aliases.md` dedupes spelling variants.
             │
             ├──► LLM editorial pass (in chat or batch)
             │      writes ## Observations bullets on touched Entities;
             │      updates ## Current understanding on touched Topics.
             │
             ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  Entities/  Topics/                                          │
   │  ├─ Synthesis / Current understanding (LLM-judgment lens)    │
   │  ├─ Observations (append-only, one bullet per citing Source) │
   │  └─ frontmatter: refs, tier, synthesis_updated_at            │
   └─────────┬────────────────────────────────────────────────────┘
             │
             ├──► reindex.ts                            (mechanical)
             │      refs counted, _seen/ → active at ≥3,
             │      Meta/index*.md regenerated, updated: bumped.
             │
             ├──► hirono refine-entity <name>           (Sonnet)
             │    hirono refine-topic <name>
             │      regenerates ## Synthesis or ## Current understanding
             │      from accumulated Observations + cited Source bodies;
             │      bumps synthesis_updated_at. Triggered when
             │      stale-synthesis lint fires or after a merge.
             │
             ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  Lark Space 2 "HIRONO WIKI"    (read-only mobile projection) │
   │  via `tools/bin/sync.ts upload-changed` — never edit there   │
   └──────────────────────────────────────────────────────────────┘
```

Three loops run on this graph:
- **Forward (per ingest)**: raw → Source → auto-detect stubs + Observations → reindex bumps refs + tiers.
- **Refine (periodic)**: when `stale-synthesis` lint fires or a merge marks Synthesis stale, `refine-entity` / `refine-topic` regenerate the LLM-judgment section from accumulated Observations. The wiki re-compresses as evidence reshapes the picture.
- **Curate (batch, occasional)**: `hirono propose-curation` runs health-check + lint, hands the findings to a Sonnet judge, emits `Meta/curation-queue.md` of merge / rename / refine / delete proposals. Operator either reviews + ticks `[x]` to approve (one-tap mode) or skips the gate for high-confidence items via `apply-queue --auto-apply high` (full-auto mode). Cadence: monthly, or when health-check warning counts get unwieldy.

In all three loops, the LLM does the judgment. The operator's role is sourcing + occasional approval — never writing wiki content directly.

## The 3-state model in one paragraph

Every URL in the corpus is in **exactly one** of three states, derived from `raw/raindrop/_index.json`:

- **`not-yet-good`** — raw extraction has problems (auth-walled, paywalled, SPA empty, content too short). Cannot be ingested as-is. Resolved via the debug loop in `Meta/site-handling-patterns.md` or by accepting the stub as-is in `Meta/fetch-decisions.md`.
- **`ingest-ready`** — raw is clean (`quality_status = good`) but no `Sources/.../<slug>.md` exists yet. The LLM ingest queue.
- **`ingested`** — Source page exists in `Sources/YYYY/`. The slug is now part of the wiki's compounding graph. **Frozen-slug guard** prevents accidental refetch.

Bulk view:

```bash
jq '[.slugs | to_entries | .[] | .value.state] | group_by(.) | map({state: .[0], n: length})' raw/raindrop/_index.json
# → e.g. [{state: "ingested", n: 16}, {state: "ingest-ready", n: 348}, {state: "not-yet-good", n: 198}]
```

Full design + per-scenario runbooks: [`Meta/corpus-pipeline.md`](Meta/corpus-pipeline.md).

## Where to look — by intent

| What I want to do | Read this |
|---|---|
| Understand the corpus state machine end-to-end | [`Meta/corpus-pipeline.md`](Meta/corpus-pipeline.md) |
| Run / understand operator commands | [`Meta/operator-workflows.md`](Meta/operator-workflows.md) |
| Entity/Topic curation (rename, merge, delete-orphan, health-check) | [`Meta/operator-workflows.md`](Meta/operator-workflows.md) §9 |
| Source curation (delete-source, raindrop forget, skip-list) — accident cleanup, NOT defaults | [`Meta/operator-workflows.md`](Meta/operator-workflows.md) §10 |
| Auto-gen + refine entities/topics (LLM-NER, Synthesis regeneration via Sonnet) | [`Meta/operator-workflows.md`](Meta/operator-workflows.md) §11 |
| Drift detection cadence (`health-check --scope drift|sources`, `raindrop gc`) | [`Meta/operator-workflows.md`](Meta/operator-workflows.md) §12 |
| Debug a sub-good site, add a new host adapter, look up a defect pattern | [`Meta/site-handling-patterns.md`](Meta/site-handling-patterns.md) |
| Understand the fetcher architecture | [`docs/fetcher-architecture.md`](docs/fetcher-architecture.md) |
| Step-by-step recipe for a new per-host site module | [`tools/sites/MIGRATION.md`](tools/sites/MIGRATION.md) |
| Fix recipes — full regex bodies for every documented-symptom-to-commit fix | [`Meta/fix-recipes.md`](Meta/fix-recipes.md) |
| Per-file / per-export code pointers for the fetch / lint / ingest toolchain | [`docs/code-map.md`](docs/code-map.md) |
| Wiki page conventions (frontmatter, page types, tier rules, image rules) | [`Meta/schema.md`](Meta/schema.md) |
| Pending punch-list after the most recent bulk fetch | [`Meta/post-fetch-todo.md`](Meta/post-fetch-todo.md) |
| Known drift / contradictions / cleanup TODOs across the wiki | [`Meta/linting-notes.md`](Meta/linting-notes.md) |
| Quality rules + fix recipes (what fires on every commit) | [`CLAUDE.md`](CLAUDE.md) |
| Karpathy's original LLM-wiki gist (inspiration, not binding) | [`Meta/references/karpathy-llm-wiki-gist.md`](Meta/references/karpathy-llm-wiki-gist.md) |

## The four content buckets (which folder = which page type)

This is the question that confuses newcomers most. Every `.md` file in this repo belongs to exactly one of these buckets, and the bucket determines the rules:

| Bucket | Path | `type:` frontmatter | What lives here | Who writes it |
|---|---|---|---|---|
| **Sources** | `Sources/YYYY/` | `source` | One file per **ingested source** (a Raindrop URL, a Lark wiki node, a paper). Summary in the §schema template shape: TL;DR + Key claims + Visual observations + What this changes (optional) + Entities/Topics touched + Raw source. (Cross-source research questions live in `Topics/<X>.md ## Open threads`, not per-Source.) | LLM, reading raw `content.md` |
| **Entities** | `Entities/<Name>.md` (active) or `Entities/_seen/<Name>.md` (seen) | `entity` | One file per **distinct thing the corpus references** — a person, project, model, framework, paper, hardware. Has an Observations log (append-only, each bullet cited to a Source) and a Synthesis section (regenerated from Observations). Auto-tier-promoted from `_seen` → active at **≥3 incoming refs**. | LLM ingest pass + reindex (refs / tier auto-maintained) |
| **Topics** | `Topics/<Topic Name>.md` | `topic` | One file per **synthesis or cross-cutting theme** — "Inference Disaggregation", "Kernel Authoring Languages", "MoE Serving". Filed either from a query (`query \| <question>`) or noticed as a recurring cluster during ingest. Has `source_count` tracking how many Sources cite it. | LLM, on query OR during ingest when a Source touches a theme |
| **Meta** | `Meta/*.md` (+ `Meta/_archive/`, `Meta/references/`) | `meta` | **Governance + catalogs + logs** — schema, indexes (auto-regen), the year's log, linting notes, the pipeline docs. Not content; it's *how the rest is organized*. | Human + LLM, append-only for logs |

**Quick litmus test**:
- "This describes a source I read." → **Sources/**
- "This describes a single named thing the corpus talks about." → **Entities/**
- "This is a synthesis across multiple sources, or an answer to a question." → **Topics/**
- "This is rules, indexes, history, or tooling docs." → **Meta/**

## Current state (regenerated by `tools/bin/reindex.ts`)

```
Sources:          35
Entities active:  23      (≥3 refs)
Entities seen:   208      (1-2 refs)
Topics:           52
Total wiki pages: 318

raw/raindrop/_index.json:
  ingested:       35
  ingest-ready:  ~329
  not-yet-good:  ~198
  ────────────────────
  total slugs:    562   (one per Raindrop bookmark)
```

The page counts above are regenerated by `tools/bin/reindex.ts`; the bookmark counts are regenerated from `raw/raindrop/_index.json`. Refresh both with `npx tsx tools/bin/reindex.ts` after a batch of ingests. The numbers will drift between runs — that's expected; the canonical source is the on-disk corpus, not this block.

## Quickstart for an operator

```bash
# 0. One-time: install git hooks (pre-commit lint + post-commit auto-fix)
git config core.hooksPath .githooks

# 1. Refresh bookmark cache from Raindrop API
npx tsx tools/bin/hirono.ts raindrop refresh-cache

# 2. Fetch new bookmarks (skips already-good slugs)
npx tsx tools/bin/hirono.ts raindrop fetch-all

# 3. See what needs attention
npx tsx tools/bin/hirono.ts raindrop status

# 4. Retry the flagged ones after fixing a site adapter
HIRONO_BROWSER_OPEN_TIMEOUT_MS=90000 \
  npx tsx tools/bin/hirono.ts raindrop fetch-all --retry-flagged

# 5. After ingest (LLM writes new Sources/ pages):
npx tsx tools/bin/reindex.ts                     # refs + tier promotions + indexes
npx tsx tools/bin/lint.ts                        # schema + dead-link checks
npx tsx tools/bin/build-sources-index.ts         # URL → slug map
npx tsx tools/bin/hirono.ts raindrop reindex-raw # raw/_index.json (state field)

# 6. Periodic: grow the entity graph + refresh stale Syntheses
npx tsx tools/bin/hirono.ts auto-detect-entities <slug>   # per-Source NER pass
npx tsx tools/bin/hirono.ts refine-all-stale              # batch-prepare refine prompts
npx tsx tools/bin/hirono.ts health-check --scope drift    # raw-archive drift audit
npx tsx tools/bin/hirono.ts health-check --scope sources  # 0-wikilink Sources, age-stale, etc.

# 6b. LLM-driven curation (monthly, when health-check warnings stack up)
npx tsx tools/bin/hirono.ts auto-curate                               # Phase 1: auto-fix + propose-curation
# spawn Sonnet → save .curation-prompts/curation-proposal-response.json
npx tsx tools/bin/hirono.ts auto-curate --continue                    # Phase 2: finalize + apply --auto-apply high
# OR for one-tap (review before apply):
npx tsx tools/bin/hirono.ts auto-curate --continue --review           # stops at queue; operator reviews + ticks
npx tsx tools/bin/hirono.ts apply-queue                               # then dispatches approved items

# 7. Project to Lark Space 2 (read-only mobile view)
cd tools && npx tsx sync.ts upload-changed
```

## The "LLM writes, you curate" rule

You **chat with the LLM** and it edits files here. Direct local edits work too — it's plain markdown.

**Don't edit in Lark Space 2.** That's the read-only projection. Edit here, or chat with the agent, or run the ingest pipeline for new sources.

## Raw sources (read-only, never modified)

- **Raindrop**: 562 bookmarks as of 2026-05-10 via Raindrop MCP. Cache at `.wiki-raindrop-cache.json`.
- **Lark Space 1 "Hirono Raw"**: `space_id 7620053427331681234` — read via `lark-hirono` skill.

## Projection target

- **Lark Space 2 "HIRONO WIKI"**: `space_id 7630375570303372466` — one-way mirror; reset by full re-upload.

---

If anything in this README is wrong, the canonical answer lives in the file linked from "Where to look — by intent." This is the table of contents, not the authoritative spec.
