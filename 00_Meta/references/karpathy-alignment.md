---
created: 2026-05-13
updated: 2026-05-13
type: meta
---

# Karpathy LLM-Wiki alignment

How this wiki maps to the pattern described in [[karpathy-llm-wiki-gist]]. Not a binding spec — Karpathy's gist is a loose pattern this project rhymes with. This page records where we are faithful, where we diverge deliberately, and where the gap is acknowledged-but-not-yet-closed.

## Three layers

| Karpathy | This wiki | Status |
|---|---|---|
| Raw sources (immutable; LLM reads, never modifies) | `raw/raindrop/<host>/<slug>/content.md` + `source.json` + figures. Trusted as snapshot; refetch is a deliberate state change ([[../../CLAUDE\|CLAUDE]] §9). | ✅ Faithful |
| LLM-owned wiki (summaries, entity pages, concept pages) | `03_Sources/YYYY/`, `02_Entities/`, `01_Topics/` — schema-governed, LLM-written | ✅ Faithful |
| Schema doc | [[../schema\|00_Meta/schema.md]] + [[../operator-workflows\|00_Meta/operator-workflows.md]] + [[../../CLAUDE\|CLAUDE.md]] — co-evolved governance | ✅ Faithful (stronger than gist — three docs split by concern) |

## Operations

| Karpathy | This wiki | Status |
|---|---|---|
| Ingest (drop source → LLM processes → touches 10–15 wiki pages) | `hirono raindrop refresh-cache` → `fetch-all` → `sync` → `auto-detect-entities` → Synthesis regen. See [[../operator-workflows\|operator-workflows]] §11. | ✅ Faithful |
| Query (LLM answers from wiki; good answers filed back as pages) | Source-as-canonical-citation + raw archive as receipt store (CLAUDE.md §9). | ⚠️ Partial — no documented workflow for promoting Q&A → Topic. This page is itself an example of doing it manually. |
| Lint (health-check for contradictions, stale claims, orphans, missing concepts) | `hirono health-check`, `hirono auto-fix`, `hirono auto-curate` (Tier-1/Tier-2). Drift cadence documented. | ✅ Stronger than gist |
| Indexing + logging | `00_Meta/index.md` + `00_Meta/log-2026.md` — chronological log with parseable prefixes per gist recommendation | ✅ Faithful |

## Karpathy's enumerated artifacts

The gist names six artifact kinds the wiki should produce: "Summaries, entity pages, concept pages, comparisons, an overview, a synthesis."

| Artifact | This wiki | Status |
|---|---|---|
| Summaries | `03_Sources/YYYY/*.md` (one per ingested source) | ✅ |
| Entity pages | `02_Entities/*.md` (active) + `02_Entities/_seen/*.md` (staging) | ✅ |
| Concept pages | `01_Topics/*.md` — 50+ pages on systems concepts (Attention Kernels, Context Parallelism, FP8 Computation, …) | ✅ |
| Comparisons | Lives inside Topic prose (`AI Accelerators`, `FP Emulation`, …). Schema now formalizes a Comparison sub-shape (filename `<X> vs <Y>.md` + `## Comparison` table) — see [[../schema\|schema]] §"Topic sub-shapes". | ⚠️ Optional convention; no Comparison-shape Topic has been created yet. |
| Overview | [[../index\|00_Meta/index.md]] — catalog overview, total counts, navigation | ✅ |
| Synthesis | [[../../Synthesis\|Synthesis.md]] at repo root — corpus-wide thesis page | ✅ (added 2026-05-13; previously absent) |

## Deliberate deviations

| Deviation | Where documented | Why |
|---|---|---|
| No `domain:` frontmatter or per-domain partitioning | Karpathy gist says "coherence emerges via wikilinks, not imposed via classification" | The wiki absorbs whatever the operator bookmarks; coherence emerges from the graph. |
| Every URL in `raw/` gets ingested ("forget" is not the default) | [[../operator-workflows\|operator-workflows]] §10 | Curation gate is at the *bookmark* layer (Raindrop), not the corpus layer. Once raw, the LLM ingests. |
| Heavier fetcher toolchain than gist suggests | [[../../docs/fetcher-architecture\|docs/fetcher-architecture.md]], per-host site modules under `tools/sites/`, fixture/snapshot tests | Raw quality is load-bearing for downstream synthesis; investment is in fidelity. |

## Acknowledged gaps

1. **Query → Topic promotion workflow.** Karpathy emphasizes that comparisons / analyses asked at query time should be filed back as new pages so explorations compound. No documented operator workflow yet — closing this means adding a "save this Q&A as a Topic" path. Tracked as an open thread, not a TODO until a real Q&A surfaces the need.

2. **Comparison sub-shape adoption.** The schema convention exists; no Topic has been migrated to it yet. Will happen organically when the operator wants a head-to-head matrix (likely first: `vLLM vs SGLang vs TensorRT-LLM` based on existing inference Topics).

3. **`hirono refine synthesis` automation gap.** Lint detects staleness; `auto-fix` preps the prompt; `apply-queue` dispatches the regenerate step — but the Sonnet subagent spawn between prep and apply still lives at the Claude Code session level, not inside the CLI. This matches how every other `refine-*` works in the repo, but is worth naming as a structural limit.

## Why this page exists

The gist is a loose pattern, not a checklist. But re-asking "does this wiki actually do what Karpathy described?" is a useful periodic exercise. Update this page whenever a deviation closes, a new artifact kind appears, or the Karpathy gist itself is revised (see [[karpathy-llm-wiki-gist]] `## Revisions`).
