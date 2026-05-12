---
created: 2026-05-10
updated: 2026-05-10
type: meta
---

# Corpus pipeline — Raindrop bookmark to ingested wiki page

How a URL flows from a Raindrop bookmark, through the fetch pipeline,
into a `Sources/<year>/<slug>.md` wiki summary. Three states, two
forward transitions, one protected backward edge.

This is the high-level design view. For per-command operator
runbooks see [`Meta/operator-workflows.md`](operator-workflows.md).
For per-host extraction patterns see
[`Meta/site-handling-patterns.md`](site-handling-patterns.md).

---

## §1 The state machine

Every URL in the corpus is in exactly one of three states:

```
   ┌──────────────────┐                  ┌──────────────────┐                ┌──────────────────┐
   │  NOT-YET-GOOD    │                  │  INGEST-READY    │                │    INGESTED      │
   │                  │   Transition A   │                  │  Transition B  │                  │
   │  raw extraction  │ ───────────────► │  clean raw,      │ ─────────────► │  clean raw +     │
   │  has problems    │   debug + retry  │  no Sources/<s>  │   LLM ingest   │  Sources/<s>.md  │
   │                  │                  │  yet             │                │                  │
   └──────────────────┘                  └──────────────────┘                └──────────────────┘
            ▲                                      ▲
            │                                      │
            └────────────── refetch regression ────┘   ◄── frozen-slug guard
              (downgrade-protected; --force         protects INGESTED from
               to bypass; logs in revisions.jsonl)  accidental refetch (--force to bypass)
```

The state of a slug is **derived**, not stored. As of commit
`8914d1c`, it's materialized into `raw/raindrop/_index.json` for
single-query lookup:

```bash
jq '.slugs[] | select(.slug == "<slug>") | .state' raw/raindrop/_index.json
# → "not-yet-good" | "ingest-ready" | "ingested"
```

Or for bulk inventory:

```bash
jq '[.slugs[].state] | group_by(.) | map({state: .[0], count: length})' raw/raindrop/_index.json
```

### The states in detail

| State | Definition | Rough corpus volume |
|---|---|---|
| `not-yet-good` | `quality_status !== "good"` in `source.json`. Extraction has problems — auth-walled, paywalled, SPA empty after browser-eval, content too short, etc. Cannot be ingested as-is. | ~204 |
| `ingest-ready` | `quality_status === "good"` AND URL is NOT in `.wiki-sources-index.json`. Clean raw archive, no wiki summary yet — this is the LLM-ingest queue. | ~369 |
| `ingested` | `quality_status === "good"` AND URL IS in `.wiki-sources-index.json` (i.e. a `Sources/<year>/<slug>.md` page references it). | ~6 (early days) |

### §1.1 At a glance — the full pipeline

```
   ┌──────────────────────────┐
   │  Raindrop bookmark API   │  the source of truth for "what URLs do I care about"
   └────────────┬─────────────┘
                │ hirono raindrop refresh-cache
                ▼
   ┌──────────────────────────┐
   │ .wiki-raindrop-cache.json│  local snapshot (~560 bookmarks)
   └────────────┬─────────────┘
                │ hirono raindrop fetch-all     (new bookmarks → fetch)
                │ hirono raindrop sync          (existing slugs → maybe refetch)
                ▼
   ┌──────────────────────────────────────────────────────┐
   │ raw/raindrop/<host>/<slug>/                          │
   │   ├── content.md           (the extracted markdown)  │
   │   ├── source.json          (quality_status, flags)   │
   │   ├── revisions.jsonl      (audit trail)             │
   │   └── <slug>-img-*.{png,jpg,…}                       │
   └────────────┬─────────────────────────────────────────┘
                │ rebuildRawIndex (auto on every write)
                ▼
   ┌──────────────────────────────────────────────────────┐
   │ raw/raindrop/_index.json                             │
   │   .slugs[<slug>].state =                             │
   │      "not-yet-good"  │  "ingest-ready"  │ "ingested" │
   └────────────┬─────────────────────────────────────────┘
                │
        ┌───────┴────────────────────┬──────────────────────┐
        │                            │                      │
        ▼                            ▼                      ▼
   not-yet-good                 ingest-ready             ingested
   (Transition A,               (Transition B,           (frozen — refetch
    debug loop)                  LLM ingest loop)          requires --force)
        │                            │
        └─── refetch regression ─────┘  (downgrade-protected;
              auto-refused unless        revisions.jsonl logs
              --force passed)            the protection event)


   ────────────────── Transition B (INGEST-READY → INGESTED) ──────────────────

                ingest-ready
                       │
                       │ hirono raindrop ingest-candidates > /tmp/c.json
                       │ npx tsx tools/bin/ingest_batch.ts plan /tmp/c.json
                       ▼
   ┌──────────────────────────────────┐
   │  .wiki-batch-state.json (queue)  │  pending / in-progress / done / errored
   └────────────┬─────────────────────┘
                │ ingest_batch next → start → (LLM writes Sources/) → mark-done
                ▼
   ┌──────────────────────────────────┐
   │  Sources/<year>/<slug>.md        │  the wiki page
   │    source_url: <url>             │
   │    …LLM-written summary…         │
   └────────────┬─────────────────────┘
                │ npx tsx tools/bin/build-sources-index.ts
                ▼
   ┌──────────────────────────────────┐
   │ .wiki-sources-index.json         │  URL → slug map
   └────────────┬─────────────────────┘
                │ rebuildRawIndex
                ▼
       _index.json[slug].state = "ingested"  (frozen)
```

---

## §2 Transition A: NOT-YET-GOOD → INGEST-READY

Fixing a sub-good slug so it becomes eligible for ingestion. Drive
this loop **by failure_kind**, not slug-by-slug — one code-level
defect usually causes a cluster of slugs to share the same
`failure_kind`, and one fix unlocks the whole cluster.

```
1. SCOUT      hirono raindrop status --filter <kind> --md
2. EYE-READ   open content.md + source.json for 2-3 representative slugs
3. DIAGNOSE   identify the code-level defect (DOM shape, missing selector, etc.)
4. FIX        edit tools/sites/<host>/ or tools/sites/_default/
5. TEST       cd tools && npm test
6. BULK-RUN   hirono raindrop sync --retry-kind <kind>
7. VERIFY     hirono raindrop status | head -2  (Clean count grew)
```

### Failure_kind taxonomy at a glance

The classifier in `tools/hirono/raindrop/failure-kind.ts` maps raw
flags onto a 15-kind taxonomy. The most common kinds and their typical
fixes:

| Kind | Cause | Fix |
|---|---|---|
| `upstream-auth-gated` | xhs / feishu / x-twitter URLs require login | Manual paste from your auth session ([R5](#r5)) |
| `upstream-fetch-failed` | github rate-limit, linux.do auth, network | Set `GITHUB_TOKEN`; re-auth Chrome; retry |
| `upstream-spa-no-content` | SPA empty even after browser-eval | Per-host site module OR accept stub |
| `upstream-paywall` | Hard paywall (economictimes, scribd, elsevier) | Accept stub |
| `upstream-deleted` | Page returned 404 / deleted-page body | `rm -rf` slug OR find archive.org snapshot |
| `upstream-not-html` | PDF / app-store / binary | P-36 PDF render OR accept stub |
| `content-too-short` | Body below host-expected size | Eyeball + pin via `Meta/sources-health-overrides.md` |
| `content-incomplete-images` | Some images failed to download | Set `GITHUB_TOKEN`; v2ex Wayback fallback (P-43) |
| `content-incomplete-images-zero` | All images failed | Investigate the image-host; possibly a CDN throttle |
| `intentional-stub-app-only` | Calculator / dashboard / search-results URL | Stub by design — accept |
| `host-malformed` | URL parse failed | Fix the URL in Raindrop |
| `host-lan-only` | LAN IP / private network | Edit / remove the bookmark |

Inspect failure flags with:

```bash
jq '.quality_flags, .error_detail, .notes' raw/raindrop/<host>/<slug>/source.json
```

### Concrete example — `content-too-short`

Suppose `hirono raindrop status --filter content-too-short --md`
shows 4 slugs. Open them:

```bash
for slug in $(jq -r '.slugs[] | select(.quality_status == "flagged" and (.quality_flags // [] | contains(["short-body"]))) | .slug' raw/raindrop/_index.json); do
  echo "=== $slug ==="
  head -20 raw/raindrop/*/$slug/content.md
done
```

Look for the pattern. If they all genuinely ARE short by design (small
README, deleted note, a tweet), the right action is to pin them as
`clean` via `Meta/sources-health-overrides.md`:

```markdown
## 2026-05-09

- 2025-05-27-atopx-linux-wps-...: pin-kind=clean   # tiny WPS365-installer repo readme
```

If instead they share a code-level defect (e.g. a site module's
selector misses the body when the article has a leading image),
fix the site module and re-run:

```bash
hirono raindrop sync --retry-kind content-too-short
```

Slugs that pass classification flip to `ingest-ready` automatically.

---

## §3 Transition B: INGEST-READY → INGESTED

LLM-driven. The operator picks candidates, asks the LLM to summarize
each into a `Sources/<year>/<slug>.md` page, and tracks state via
`ingest_batch`.

### The pipeline

```
1. PLAN        hirono raindrop ingest-candidates --limit 10 > /tmp/c.json
               npx tsx tools/bin/ingest_batch.ts plan /tmp/c.json
                                  └─► quality gate refuses non-good unless --allow-flagged
2. PEEK NEXT   npx tsx tools/bin/ingest_batch.ts next
3. START       npx tsx tools/bin/ingest_batch.ts start <id>
4. SUMMARIZE   LLM reads raw/raindrop/<host>/<slug>/content.md,
               writes Sources/<year>/<slug>.md
5. MARK DONE   npx tsx tools/bin/ingest_batch.ts mark-done <id> --slug <slug>
6. REINDEX     npx tsx tools/bin/build-sources-index.ts
                                  └─► .wiki-sources-index.json refreshed
7. STATE FLIP  npx tsx -e "import('./tools/fetch-raw.ts').then(m => m.rebuildRawIndex())"
                                  └─► _index.json[slug].state = "ingested"
```

After step 7, the slug is INGESTED. The frozen-slug guard now
protects it (§4 below).

### Sources page conventions

A `Sources/<year>/<slug>.md` page has:

```yaml
---
created: 2026-05-10
updated: 2026-05-10
type: source
source_url: https://newsletter.semianalysis.com/p/aws-trainium3-...
tags: [trainium, aws, accelerator, tco]
highlights: true
---

# [2026-05-10] AWS Trainium3 Deep Dive

…body summary…
```

The `source_url` field is what `build-sources-index.ts` keys the
URL → slug map by. It MUST be the same URL the raw archive was
fetched against (or a share-aggregator wrapper that unwraps to the
same target — P-32 unwrap is symmetric).

See [`Meta/schema.md`](schema.md) for full page conventions.

---

## §4 The frozen-slug guard

Once a slug reaches INGESTED, accidental `refetch` would silently
overwrite the raw content while the wiki summary stays stale. The
frozen guard prevents that:

```
hirono raindrop refetch <ingested-slug>
# → exits 2 with:
#   [refetch] <slug> is already ingested into Sources/.
#            Refetch would overwrite raw content while the wiki summary stays stale.
#            Pass --force to override (then manually re-read the raw and update the Source summary).
```

`hirono raindrop sync` shows ingested slugs as `skip-frozen-slug` in
the plan output. Even `--retry-flagged` and `--retry-kind` honor the
guard unless `--force` is passed.

The guard reads `.wiki-sources-index.json` (URL → slug map). Make
sure it's fresh after editing Sources/:

```bash
npx tsx tools/bin/build-sources-index.ts
```

---

## §5 The backward edge — refetch regression

A `refetch` or `sync` of an INGEST-READY slug can produce a worse
result than the previous fetch. Browser-eval-dependent SPAs are the
worst offenders — wangzhiyu.notion.site, zenfeed.xyz, 51cto.com all
exhibited this. Without protection, the new stub silently overwrites
the previous good content.

The downgrade-protection guard refuses the write when ALL three hold:

1. New content_length < previous × 0.3 (substantial collapse).
2. New flags include `intentional-stub` / `*-fetch-failed` /
   `*-extraction-failed`.
3. Previous flags did NOT include any of the above.

On refusal:
- The previous content.md + source.json stay on disk.
- A `regression-protected` row appends to `revisions.jsonl`.
- Console: `[fetcher] regression-protected: <slug> new=Nc old=Mc...`

Bypass with `--force` when the regression is intentional (e.g. the
upstream page genuinely changed and you want the new state):

```bash
hirono raindrop refetch <slug> --force
hirono raindrop sync --retry-kind <kind> --force
```

---

## §6 Runbooks

### §6.0 Which runbook? — pick by situation

```
   "What's your situation right now?"
                       │
   ┌─────────┬─────────┴──────────┬──────────────┬───────────────┐
   │         │                    │              │               │
   ▼         ▼                    ▼              ▼               ▼
 Raindrop   a slug's            I have body   I want to       an ingested
 changed    content.md          to paste      summarize       slug needs
            isn't good          (auth-walled  good slugs      refresh
   │         │                   xhs/feishu)  into Sources/    │
   │         │                    │              │              │
   │         │                    │              │              ▼
   │         │                    │              │           R6 (--force
   │         │                    │              │            refetch)
   │         │                    │              │
   │         │                    │              ▼
   │         │                    │           Transition B
   │         │                    │           (LLM ingest)
   │         │                    │
   │         │                    ▼
   │         │                 R5 (manual paste)
   │         │
   │         ▼
   │       R4 (debug loop by failure_kind)
   │
   ▼
 ┌───┴───────┬───────────┐
 │           │           │
 ▼           ▼           ▼
added       deleted    URL edited
in Raindrop in Raindrop in Raindrop
 │           │           │
 ▼           ▼           ▼
R1          R2          R3


    Special: shipped a regression that broke a cluster?  ──► R7
```

If a single command screams an error you don't recognize, the
fastest debugging step is `hirono raindrop status` — it surfaces the
state of every slug grouped by failure_kind.

### R1 — Bookmark added in Raindrop

```
[bookmark added in Raindrop]
        │
        ▼
  refresh-cache  ──► .wiki-raindrop-cache.json grows
        │
        ▼
  fetch-all      ──► raw/raindrop/<host>/<new-slug>/ created
        │            (fetches ONLY URLs not already in raw/)
        ▼
  status         ──► confirm Clean count delta
```

```bash
hirono raindrop refresh-cache               # pull new bookmark list
hirono raindrop fetch-all                   # fetch any not-yet-fetched URLs
hirono raindrop status | head -2            # confirm Clean count grew
```

### R2 — Bookmark deleted in Raindrop

```
[bookmark deleted in Raindrop]
        │
        ▼
  refresh-cache    ──► cache shrinks; local slug now orphan
        │
        ▼
  status           ──► orphans tagged "[orphan: bookmark deleted ...]"
        │
        ▼
   decide: prune or keep
        │
   prune:
   rm -rf raw/raindrop/<host>/<slug>/
        │
        ▼
   rebuildRawIndex  ──► _index.json no longer has the orphan
```

```bash
hirono raindrop refresh-cache
hirono raindrop status                       # orphans tagged "[orphan: bookmark deleted from Raindrop]"

# Decide: prune or keep
rm -rf raw/raindrop/<host>/<orphan-slug>/
npx tsx -e "import('./tools/fetch-raw.ts').then(m => m.rebuildRawIndex())"
```

Pre-existing orphans are tolerated; status reports them clearly so
you can prune at your own pace.

### R3 — Bookmark URL edited in Raindrop

```
[bookmark URL edited]
        │
        ▼
  refresh-cache   ──► cache reflects the new URL
        │
        ▼
  fetch-all       ──► fetches new URL (creates a NEW slug dir)
        │            old slug is now orphan
        ▼
  R2 cleanup      ──► prune the orphan if you don't want it
```

```bash
hirono raindrop refresh-cache
hirono raindrop fetch-all                    # creates a slug at the NEW URL
# Old slug under the old URL is orphan — handle as R2
```

### R4 — A slug's content.md isn't good <a id="r4"></a>

The general debug loop. **Drive by failure_kind, not by individual slug** —
one code-level defect usually causes a cluster of slugs to share the same
kind, so one fix unlocks the whole cluster.

```
[content.md isn't good]
        │
        ▼
  status --filter <kind>          ──► see the cluster (e.g. 5 slugs)
        │
        ▼
  pick 2-3 reps, eye-read:
    cat raw/raindrop/<h>/<s>/content.md
    jq '.quality_flags, .error_detail, .notes' .../source.json
        │
        ▼
  what's the pattern?
        │
   ┌────┴───────────────┬──────────────────────┐
   │                    │                      │
   ▼                    ▼                      ▼
 code defect       genuinely        cluster is mixed
 (DOM shape,       short by         (do per-slug)
  selector miss,   design
  etc.)
   │                    │                      │
   ▼                    ▼                      ▼
 edit              pin via          fall back to
 tools/sites/...   sources-health-  slug-by-slug
 + npm test        overrides.md     work
   │                    │
   ▼                    ▼
  sync --retry-kind <k>  done (no refetch needed —
        │                pin is read at status time)
        ▼
  Watch for "regression-protected"
  messages — means the new fetch was
  WORSE than the previous. Either:
   - revert the offending code change, OR
   - if the regression is intentional,
     pass --force to override
        │
        ▼
  status | head -2            ──► Clean count grew, Stub shrank
```

```bash
hirono raindrop status --filter <kind> --md  # scout the cluster
# eye-read 2-3 representatives
cat raw/raindrop/<host>/<slug>/content.md
jq '.quality_flags, .error_detail' raw/raindrop/<host>/<slug>/source.json
# fix the site module under tools/sites/<host>/ or tools/sites/_default/
cd tools && npm test
cd .. && hirono raindrop sync --retry-kind <kind>
```

### R5 — Auth-walled slug (xhs / feishu / x.com) <a id="r5"></a>

Sites where the operator's auth session is required and `opencli`
can't reach. Manual paste.

```
[xhs / feishu / x.com slug stuck on auth]
        │
        ▼
  open URL in a browser where you ARE signed in
        │
        ▼
  copy the body content
        │
        ▼
  vim raw/raindrop/<h>/<s>/content.md  ──► paste
        │
        ▼
  jq mutate source.json:
    quality_flags  -= [intentional-stub, xhs-text-body-unavailable, ...]
    quality_status  = "good"
    content_length  = bytes(content.md)
        │
        ▼
  rebuildRawIndex                    ──► state flips to "ingest-ready"
        │
        ▼
  status                              ──► confirm the slug left the
                                          xhs-text-body-unavailable cluster
```

The 167 xhs slugs in this cluster: see
`sweep-results/xhs-text-body-unavailable.tsv` for the operator
checklist.

```bash
# 1. Open the URL in a browser where you're signed in
# 2. Copy the body content
vim raw/raindrop/<host>/<slug>/content.md   # paste

# 3. Clear stub flags + bump status in source.json
jq '
  .quality_flags = (.quality_flags - ["intentional-stub", "xhs-text-body-unavailable", "feishu-auth-gated"])
  | .quality_status = "good"
  | .content_length = ($body | length)
' --rawfile body raw/raindrop/<host>/<slug>/content.md \
  raw/raindrop/<host>/<slug>/source.json > /tmp/s.json \
  && mv /tmp/s.json raw/raindrop/<host>/<slug>/source.json

# 4. Rebuild the index so the slug's state field flips to ingest-ready
npx tsx -e "import('./tools/fetch-raw.ts').then(m => m.rebuildRawIndex())"
```

### R6 — Already-ingested slug needs a refresh <a id="r6"></a>

The upstream page genuinely changed and the wiki summary is now
out of date. The frozen-slug guard will refuse a plain refetch
because that would silently desync the wiki page; you have to opt in
with `--force` and then update the Sources/ summary manually.

```
[ingested slug needs refresh because upstream changed]
        │
        ▼
  refetch <slug>             ──► [refetch] already ingested... pass --force
        │                          (the frozen-slug guard fired — good)
        ▼
  refetch <slug> --force      ──► raw content.md is now updated
        │                         BUT Sources/<year>/<slug>.md is stale
        ▼
  vim Sources/<year>/<slug>.md  ──► manually re-read raw, update summary
        │
        ▼
  git commit                    ──► durable
        │
        ▼
  build-sources-index           ──► .wiki-sources-index.json refreshes
        │                           (in case the URL field changed)
        ▼
  rebuildRawIndex               ──► _index.json[slug].state stays "ingested"
```

```bash
hirono raindrop refetch <slug> --force       # bypass frozen-slug guard
# raw content.md is now updated; the Sources/<year>/<slug>.md is stale
vim Sources/<year>/<slug>.md                  # manually re-read raw, update summary
git add Sources/<year>/<slug>.md && git commit
npx tsx tools/bin/build-sources-index.ts      # refresh URL→slug index
```

### R7 — Site code regression broke a cluster

You shipped a code change that made N slugs go from good → flagged.

```
[noticed Clean count dropped after a recent commit]
        │
        ▼
  git log tools/sites/<host>/   ──► find the suspect commit(s)
        │
        ▼
   ┌──── decide ─────┐
   │                 │
   ▼                 ▼
revert         fix forward
        │                 │
        ▼                 ▼
  git revert        edit the site module
  <bad-commit>      to fix the regression
        │                 │
        └────────┬────────┘
                 │
                 ▼
  npm test                     ──► all tests green
                 │
                 ▼
  sync --retry-kind <k>        ──► bulk re-fetch the affected cluster
                 │
                 ▼
  status | head -2              ──► Clean recovers
                 │
                 ▼
  Long-term: add a regression test
  (fixture or snapshot per CLAUDE.md §6b)
  so the bug can't sneak back in.
```

```bash
git log --oneline tools/sites/<host>/        # find the regression
git revert <bad-commit>                       # OR fix forward
cd tools && npm test
cd .. && hirono raindrop sync --retry-kind <kind>   # re-fetch the affected cluster
```

Long-term: add a regression test (fixture or snapshot under
`tools/__tests__/fixtures/converters/` or `tools/__tests__/snapshots/`)
so future code changes catch this before commit. CLAUDE.md §6b walks
through the test-capture workflow.

---

## §7 Quick reference — where each piece of state lives

| Question | Source of truth | Lookup |
|---|---|---|
| What's this slug's quality status? | `raw/raindrop/<host>/<slug>/source.json` | `jq '.quality_status' …source.json` |
| Same, corpus-wide | `raw/raindrop/_index.json` (mirror) | `jq '.slugs[].quality_status' …` |
| What's this slug's pipeline state? | `_index.json[slug].state` (derived; commit `8914d1c`) | `jq '.slugs.<slug>.state' …` |
| Has this slug been ingested? | `Sources/<year>/<slug>.md` exists OR URL ∈ `.wiki-sources-index.json` | `ls Sources/*/<slug>.md` OR `jq 'has("<url>")' .wiki-sources-index.json` |
| What candidates are ready for ingest? | derived from `_index.json` ∩ `.wiki-sources-index.json` | `hirono raindrop ingest-candidates` |
| What slugs need work? | `quality_status !== "good"` rows | `hirono raindrop status` |
| What slugs are deliberately accepted as-is? | `Meta/fetch-decisions.md` (slug-level) | grep |
| What kinds are deliberately overridden? | `Meta/sources-health-overrides.md` (kind pins) | grep |

---

## §8 Verification checklist

Periodic health check to confirm the pipeline is in shape:

```bash
# 1. Cache + raw + index agree on totals
hirono raindrop check                        # surfaces duplicates + coverage gaps
hirono raindrop status                        # state-by-kind summary

# 2. _index.json is fresh
npx tsx -e "import('./tools/fetch-raw.ts').then(m => m.rebuildRawIndex())"

# 3. .wiki-sources-index.json is fresh
npx tsx tools/bin/build-sources-index.ts

# 4. lint is green (or only the pre-existing 6 errors related to slug-name mismatch)
npx tsx tools/bin/lint.ts

# 5. Tests pass
cd tools && npm test
```

If steps 1–3 produce surprises (counts drift, missing slugs, stale
joins), the rebuild commands re-derive everything from disk state.
The system is designed so that disk state is the canonical store and
indexes can always be regenerated.
