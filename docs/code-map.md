---
created: 2026-05-12
updated: 2026-05-12
type: meta
---

# Code map

Extracted from `CLAUDE.md` §8 during the 2026-05-12 file-size trim.
Full per-file pointers for the fetch / lint / ingest toolchain. CLAUDE.md
retains a top-level summary; click through here for the per-export
breakdown of each file.


- **`tools/fetch-raw.ts`** — library: single dispatch point + raw-archive layout:
  - `AUTO_SKIP_RULES` — URL refuse-list (currently HF Spaces, L2 skip)
  - `HOST_MIN_BODY_SIZES` — per-host+URL-path size bands
  - `classifyQuality` — flag assembly; consumes `intentional-stub`
  - `fetchUrlAndStore` — calls `routeSite(url).fetch()`, runs image processing + post-cleanup, writes raw archive. Exactly one site-module call.
  - status helpers: `parseFetchDecisions`, `listRawSlugs`, `buildStatusReport`, `buildSyncPlan`, `remediationFor`, `executeFetchPlanItem`, `printStatusReport`
- **`tools/fetch-raw-handlers.ts`** — CLI handler library for the
  raindrop fetch pipeline (`fetch`, `refetch`, `sync`, `verify`,
  `status`, `store`, `fetch-lark`). Dispatched from
  `tools/bin/hirono.ts`; imports from `tools/fetch-raw.ts`.
- **`tools/bin/`** — CLI entry-point scripts (each starts with shebang):
  - `hirono.ts` — single entry point. Subcommands:
    - `raindrop {check, refresh-cache, new, fetch, refetch, sync, verify,`
      `status, history, diff, fetch-all, store, fetch-lark, export}`
    - `doctor`
  - `lint.ts`, `reindex.ts`, `preprocess.ts`, `sync.ts`, `reconcile_light.ts`, `reconcile_heavy.ts`, `ingest_batch.ts`, `build-sources-index.ts`, `build-mention-map.ts`, `find-dupes.ts`, `sweep-issues.ts`
- **`tools/sites/`** — every host module:
  - `<host>/index.ts` — `Site` contract export with `match(url)` + `fetch(url, opts)`
  - `<host>/test-hooks.ts` — re-export from index.ts (factory does it for you)
  - `<host>/converter.ts` — only for hosts with custom DOM logic (weixin, xhs, deepwiki, etc.); factory hosts inline this
  - `xhs/browser-extract.ts` — xhs-specific opencli browser extractors (kept under `xhs/` so all xhs code lives in one dir)
  - `index.ts` — `routeSite(url) → Site` (TOTAL — never null thanks to `_default`)
  - `test-hooks-registry.ts` — central registry of every module's test hooks
  - `_default/` — catch-all module, registered LAST
  - `_shared/article-site-factory.ts` — `makeArticleSite({...})` for blog-shape hosts
  - `_shared/article-converter.ts` — selector-driven JSDOM extractor
  - `_shared/post-cleanup.ts` — `applyPostCleanups()` + 8 host-agnostic cosmetic cleanups
  - `_shared/markdown-cleanups.ts` — bold-spacing walker + quad-asterisk collapse
  - `_shared/generic-converter.ts` — JSDOM + turndown plumbing
  - `_shared/types.ts` + `_shared/test-hooks-types.ts` — contracts
  - `_shared/browser-eval-json.ts` — opencli eval-stdout JSON parser
  - `_shared/browser-helpers.ts` — `sleepMs`, `closeBrowser`, `runOpencli`, `browserTimeoutMs`, `opencliDoctorOk` (used by every D-bucket module)
- **`tools/shared/`** — infrastructure utilities (not site- or hirono-specific):
  - `atomic-write.ts` — atomic file writes
  - `browser-lock.ts` — machine-wide opencli concurrency lock
  - `revisions.ts` — `revisions.jsonl` append-only audit-trail helpers
  - `url-helpers.ts` — URL normalization + share-aggregator unwrap (`share.google?link=`, etc.)
- **`tools/hirono/`** — `hirono` CLI for raindrop-driven bulk fetching + wiki authoring helpers:
  - `doctor.ts` — environment health check
  - `adapter-paths.ts` — opencli `~/.opencli/clis/` symlink helpers (used only by doctor)
  - `new-entity.ts` / `new-topic.ts` — schema-conformant stub creators (`hirono new-entity`, `hirono new-topic`)
  - `raindrop/` — subcommand modules: `check`, `diff`, `export`, `failure-kind`, `fetch-all`, `history`, `ingest-candidates`, `new-bookmarks`, `refresh-cache`, `status`. See `tools/bin/hirono.ts` for the dispatch table.
- **`tools/opencli/`** — in-repo home of project-local opencli adapters:
  - `clis/<site>/<name>.js` — adapter source (git-tracked); empty until a site needs one
  - `sites/<site>/` — accumulated recon notes per site
  - `install-symlinks.sh` — idempotent bootstrap that links into `~/.opencli/clis/`
  - `host-counts.json` — graduation watchdog snapshot
- **`tools/__tests__/`**:
  - `coverage-gate.test.ts` — every registered site module must have ≥1 fixture + ≥1 snapshot
  - `per-host-snapshot.test.ts` — per-host snapshot regression suite (sidecar match + hard-rule defects + image-ref existence)
  - `converter-fixtures.test.ts` — byte-equal regression test for converters (frozen input → frozen `expected.md`)
  - `post-process-fixtures.test.ts` — fixture pairs for each cross-cutting cleanup
  - `structural-rules.ts` — defect-shape validators (no-quad-asterisk-runs, no-multi-line-link-wrappers, etc.)
  - `approve.ts` — unified capture command (fetch → eye-read → diff → fixture + snapshot)
  - `capture-fixtures.ts`, `snapshot-create.ts`, `snapshot-helpers.ts` — capture primitives
  - `snapshots/<host>/<slug>.{md,invariants.json}` + `<slug>-images/` — per-host snapshots
  - `fixtures/converters/<host>/<name>.{input.json,expected.md,expected.json}` — frozen converter fixtures
