---
created: 2026-05-08
updated: 2026-05-12
type: meta
---

# Operator workflows

End-to-end command sequences for running the wiki's fetch + ingest +
maintenance tooling. Each section: a flow diagram, the exact commands
in order, what to expect on success, and what to do when things go
sideways.

> **See also:** [`00_Meta/corpus-pipeline.md`](corpus-pipeline.md) for the
> high-level state machine view (NOT-YET-GOOD / INGEST-READY / INGESTED,
> the two transitions, the frozen-slug guard, the downgrade-protection
> backward edge, and the per-scenario runbooks). This file is the
> per-command reference; that one is the architectural overview.

All commands assume the working directory is the repo root. Where
brevity matters the docs use `hirono raindrop ...` — the equivalent
direct invocation is `npx tsx tools/bin/hirono.ts raindrop ...`.

The single `hirono` binary is the canonical entry point for the
Raindrop fetch pipeline. Wiki ingest (`ingest_batch.ts`) and wiki
maintenance (`reindex.ts`, `build-sources-index.ts`, `lint.ts`,
etc.) live in separate top-level binaries by design — they operate
on `03_Sources/` / `02_Entities/` / `01_Topics/`, not on `raw/` or Raindrop
state.

Jump to:

1. [Fresh ingest from scratch](#1-fresh-ingest-from-scratch)
2. [Daily / weekly incremental update](#2-daily--weekly-incremental-update)
3. [Triaging failures](#3-triaging-failures)
4. [Reviewing changes over time](#4-reviewing-changes-over-time)
5. [Adapter promotion / per-host work](#5-adapter-promotion--per-host-work)
6. [Override workflow](#6-override-workflow)
7. [Health-check schedule](#7-health-check-schedule)
8. [Command reference](#8-command-reference)

---

## 1. Fresh ingest from scratch

Use when starting a brand-new wiki, after a major migration that
reset state, or to verify the pipeline end-to-end on a clean tree.

```
                  ┌──────────────────┐
                  │ doctor (env OK?) │
                  └────────┬─────────┘
                           ▼
                ┌──────────────────────┐
                │ refresh-cache (pull) │
                └──────────┬───────────┘
                           ▼
                ┌──────────────────────┐
                │ raindrop check       │  ← are all hosts covered?
                └──────────┬───────────┘
                           ▼
                ┌──────────────────────┐
                │ raindrop new         │  ← what's un-ingested?
                └──────────┬───────────┘
                           ▼
                ┌──────────────────────┐
                │ ingest_batch plan    │  ← register candidates
                └──────────┬───────────┘
                           ▼
            ┌─────────────────────────────┐
            │ LLM ingest loop (out-of-   │
            │ band): fetch → write       │
            │ Sources/ → mark done       │
            └──────────┬──────────────────┘
                       ▼
                ┌──────────────────────┐
                │ build-sources-index  │
                └──────────┬───────────┘
                           ▼
                ┌──────────────────────┐
                │ reindex              │  ← refs / tier promotions
                └──────────┬───────────┘
                           ▼
                ┌──────────────────────┐
                │ raindrop status      │  ← final health report
                └──────────────────────┘
```

### Commands

```bash
# 0. Sanity check the environment.
hirono doctor

# 1. Pull the latest bookmarks from Raindrop into the local cache
#    (.wiki-raindrop-cache.json). One-time per session.
hirono raindrop refresh-cache

# 2. Verify hostname coverage — every host with > 1 bookmark should
#    have a dedicated site module or route to _default with a known
#    snapshot. Exits non-zero on uncovered hosts.
hirono raindrop check

# 3. List bookmarks that aren't yet in the local sources index
#    (every URL on a fresh ingest). Pipe into ingest_batch.
hirono raindrop new --json --out batch-1.json

# 4. Register candidates with ingest_batch. Skips URLs already in
#    .wiki-sources-index.json (none, on a fresh ingest).
npx tsx tools/bin/ingest_batch.ts plan batch-1.json

# 5. Hand off to the LLM (or yourself) to actually fetch + write the
#    03_Sources/2026/<slug>.md files. The LLM uses MCP tools (Raindrop,
#    lark-hirono, WebFetch) and `hirono raindrop fetch ...` for the
#    raw-archive layer. ingest_batch tracks status across sessions:
npx tsx tools/bin/ingest_batch.ts next        # peek next pending
npx tsx tools/bin/ingest_batch.ts start <id>  # mark in-progress
# ... LLM does the work, writes 03_Sources/2026/<slug>.md and raw/...
npx tsx tools/bin/ingest_batch.ts mark-done <id> --slug <slug>

# 6. After the batch is processed, rebuild the URL→slug index from
#    Sources/. Idempotent; safe to re-run anytime.
npx tsx tools/bin/build-sources-index.ts

# 7. Recompute reference counts + tier promotions in entity/topic
#    frontmatter; regenerate 00_Meta/index*.md.
npx tsx tools/bin/reindex.ts

# 8. Final health report. Tells you what didn't make it through.
hirono raindrop status
```

### What to expect

After step 8 on a fresh ingest of ~560 bookmarks:

```
# Raindrop sources health (~560 bookmarks)
Generated: 2026-MM-DDTHH:MM:SSZ
Clean: ~360 · Stub: ~190 · Fetch error: ~10
```

The bulk classifies as `clean`. The not-yet-good remainder break down into:

- ~9 `upstream-auth-gated` (foreign feishu tenants, x.com if not signed in)
- ~9 `upstream-spa-no-content` (pure SPAs with no static body)
- ~7 `upstream-not-html` (PDFs, app-store listings)
- ~5 `host-lan-only` (LAN IPs unreachable from public internet)
- ~2-4 `upstream-paywall`, `upstream-deleted`, `host-malformed`

These are the categories worth investigating in §3.

### What if X happens

| Symptom | What to do |
|---|---|
| `hirono doctor` reports opencli extension not connected | Open Chrome, install/enable the opencli extension, retry. |
| `raindrop check` exits non-zero with uncovered hosts | A hostname has > 1 bookmark and no dedicated site module. Either accept `_default` coverage (cheap path) or build a site module per §5. |
| `ingest_batch next` returns `none` immediately | The plan was empty — likely all URLs already in `.wiki-sources-index.json`. Inspect with `hirono raindrop new --md`. |
| `reindex` reports tier promotions | Expected on first ingest. Frontmatter `refs:` and `tier:` updated; entities may move from `_seen/` to top-level. |
| Final `status` shows hundreds of `not-yet-fetched` | Steps 5–6 didn't complete — restart the ingest loop or check `ingest_batch list` for stuck `in-progress` entries. |

---

## 2. Daily / weekly incremental update

Use when new bookmarks have been added to Raindrop or you suspect
existing sources may have updated upstream. The whole loop is
idempotent — safe to re-run any time.

```
              ┌──────────────────────┐
              │ refresh-cache        │  ← pull new bookmarks
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │ raindrop new         │  ← anything new to ingest?
              └──────────┬───────────┘
                         ▼
        (if new bookmarks)│  (if none)
                ┌────────┴────────┐
                ▼                 │
         ┌────────────┐           │
         │ ingest_    │           │
         │ batch loop │           │
         └─────┬──────┘           │
               ▼                  ▼
        ┌──────────────────────────────┐
        │ hirono raindrop sync               │  ← retry flagged + fetch new
        │   --retry-flagged            │
        │   [--check-stale --max-age N]│  ← optional: re-check upstream
        └──────────┬───────────────────┘
                   ▼
        ┌──────────────────────┐
        │ raindrop status      │
        └──────────────────────┘
```

### Commands (typical day)

```bash
# 1. Pull any new Raindrop bookmarks.
hirono raindrop refresh-cache

# 2. Anything new to ingest?
hirono raindrop new --md       # human-readable preview
# (if non-empty, run the same plan/loop as flow #1, steps 3-6)

# 3. Idempotent re-fetch over raw/ + ingest_batch pending queue.
#    Skips good slugs. By default ignores flagged slugs too — pass
#    --retry-flagged to retry every flagged slug, or use --retry-kind
#    for surgical retries (see flow #3).
hirono raindrop sync --retry-flagged

# 4. Final health report.
hirono raindrop status
```

### Commands (weekly: include staleness check)

```bash
# As above, plus a HEAD check on every good slug older than 30 days.
# If etag / Last-Modified differs from the saved upstream block,
# escalates to a full re-fetch (writing content-rev2.md, etc.).
hirono raindrop sync --retry-flagged --check-stale --max-age 30
hirono raindrop status
```

### What to expect

```
[sync] plan: 4 fetch, 12 head-check, 562 skip
## will fetch / head-check
  [fetch] 2026-05-08-new-blog  ←  https://example.com/post  (new from ingest_batch pending queue)
  [head]  2026-04-19-aws-trainium3  ←  https://newsletter.semianalysis.com/...  (good, 49d old (>= 30d threshold))
  ...
[sync] fetching 2026-05-08-new-blog …
[sync] ✓ 2026-05-08-new-blog (status=good, flags=none)
[sync] fetching 2026-04-19-aws-trainium3 …  (head-check)
[sync] skipped — fresh (etag matches)
```

### What if X happens

| Symptom | What to do |
|---|---|
| `raindrop new` shows URLs but `ingest_batch plan` skips them all | URLs may have utm/share params that normalize differently. Inspect `.wiki-sources-index.json` for the normalized key. |
| `--check-stale` triggers HEAD storms against a host | Rate-limited or noisy upstream. Lower `--max-age` next run, or add the slug to `00_Meta/fetch-decisions.md` to skip. |
| `sync --retry-flagged` keeps retrying the same flagged slugs | The flag is genuinely unfixable. Diagnose with `status` (flow #3); if confirmed unrecoverable, accept-as-is via `00_Meta/fetch-decisions.md`. |
| New bookmarks didn't appear after `refresh-cache` | Raindrop API token expired or rate limited. Re-auth and retry. |

---

## 3. Triaging failures

After every sync, `raindrop status` prints a count of clean / stub /
fetch-error rows grouped by `failure_kind`. Each kind has a specific
remediation path.

### `error_detail` — the actual upstream error

Every stub now carries an `error_detail` field in its `source.json`,
populated by the site module from the underlying upstream error
(curl stderr, lark-cli error JSON, browser-eval `signedIn=false`,
HTTP status, etc.). Capped at 2KB.

Three places to find it:

- `raw/raindrop/<host>/<slug>/source.json`'s `error_detail` field — full text.
- `raw/raindrop/<host>/<slug>/content.md`'s `## Error detail` section —
  fenced block with the raw upstream trace, formatted for reading.
- `hirono raindrop status`:
  - **markdown** output: first line of `error_detail` appears inline
    in the per-row table (under "error_detail (first line)").
  - **CSV** output: a trailing `error_detail_first_line` column.
  - **JSON** output: full `error_detail` field on each row.

Example — a foreign feishu tenant the bot has no access to. Status row
becomes:

```
| host | bookmark | slug | last_fetched | error_detail (first line) |
|---|---|---|---|---|
| upiwgvvcb4.feishu.cn | https://...wiki/... | feishu-... | 2026-05-07 | _user: forBidden; bot: forBidden_ |
```

Click into `raw/raindrop/<host>/<slug>/content.md` and you see the actual
lark-cli stderr JSON pinpointing `Caused by: forBidden` —
authoritative upstream trace, not a generic "needs attention".

When `error_detail` is absent (clean rows, or pre-this-feature
stubs), the status table falls back to listing `quality_flags`.

```
              ┌──────────────────────────┐
              │ raindrop status          │
              └──────────┬───────────────┘
                         ▼
              ┌──────────────────────────┐
              │ identify the failing     │
              │ kind from the counts     │
              └──────────┬───────────────┘
                         ▼
              ┌──────────────────────────┐
              │ raindrop status          │  ← drill into one kind
              │   --filter <kind>        │
              └──────────┬───────────────┘
                         ▼
                  ╔══════╧══════╗
              tool-fixable    source-side / unfixable
                    │            │
                    ▼            ▼
           ┌──────────────┐  ┌──────────────────┐
           │ fix code +   │  │ accept-as-is via │
           │ retry-kind   │  │ fetch-decisions  │
           └──────────────┘  └──────────────────┘
```

### Per-kind playbooks

#### `upstream-auth-gated` (typical: foreign feishu tenants, x.com)

```bash
# See which slugs are auth-gated.
hirono raindrop status --filter upstream-auth-gated

# Feishu: ask the tenant owner to share the wiki with your account.
# x.com: open chrome, sign in to twitter/x. Confirm by visiting the URL.
# Then retry just these slugs:
hirono raindrop sync --retry-kind upstream-auth-gated
hirono raindrop status --filter upstream-auth-gated  # should be empty (or smaller)
```

#### `upstream-deleted`

```bash
hirono raindrop status --filter upstream-deleted
# Verify in a browser. If the page truly is gone:
#   Option A: keep the local stub (it serves as a tombstone)
#   Option B: delete the bookmark from Raindrop, refresh-cache,
#             then prune the orphan slug from raw/raindrop/<host>/<slug>/ manually.
```

#### `upstream-spa-no-content`

These already triggered `_default`'s browser-eval fallback and still
got nothing. Three follow-ups:

```bash
# 1. Confirm by hand: open the URL in a browser. If you see meaningful
#    content, the host needs a dedicated module (see flow #5).
# 2. If the page is genuinely interactive (calculator, demo, web app):
#    pin it as intentional-stub-app-only via the override file
#    (see flow #6).
# 3. Otherwise accept the stub via 00_Meta/fetch-decisions.md.
```

#### `upstream-not-html` (PDFs, app-store listings, API endpoints)

```bash
# Not recoverable as markdown. Two options:
#   a. Use a separate PDF-to-text tool, paste into a Sources/ file by
#      hand, mark via fetch-decisions.
#   b. Accept the stub.
hirono raindrop status --filter upstream-not-html
```

#### `host-lan-only`

```bash
# LAN IPs unreachable from public internet. The bookmark was saved
# on a different network. Either:
#   a. Wait until you're back on that LAN, then refetch.
#   b. Delete the bookmark from Raindrop if the content is gone.
```

#### `host-malformed`

```bash
# Broken share-link or URL parse error. Fix in Raindrop:
#   1. Open the bookmark in Raindrop UI.
#   2. Edit the URL to the canonical form.
#   3. refresh-cache, retry.
```

#### `content-incomplete-images` (partial image downloads)

```bash
hirono raindrop status --filter content-incomplete-images
hirono raindrop sync --retry-kind content-incomplete-images
# If it persists across retries, the host is rate-limiting image fetches.
# Wait a few minutes and retry, or add to 00_Meta/fetch-decisions.md.
```

#### `content-too-short`

```bash
# Body is below the host's expected size floor. Eyeball the URL in a
# browser. If short by design (a tweet, a brief note), pin to clean
# via the override file. If genuinely truncated, file as a converter
# bug.
```

### Quick decision tree

```
Is the kind tool-fixable?
├── yes (auth granted, code bug, transient network)
│       → fix → hirono raindrop sync --retry-kind <kind>
└── no (genuinely unrecoverable / source-side)
        ├── stable failure (deleted, paywalled, app-only)
        │       → 00_Meta/fetch-decisions.md (skip future retries)
        └── classifier mistake
                → 00_Meta/sources-health-overrides.md (flow #6)
```

---

## 4. Reviewing changes over time

Use when you suspect a previously-ingested bookmark has changed
upstream, or when reviewing a slug's history.

```
              ┌──────────────────────┐
              │ sync --check-stale   │  ← detect changes
              │   --max-age 30       │
              └──────────┬───────────┘
                         ▼
                head-check escalates to fetch
                if etag/last-modified changed,
                writing content-rev2.md (etc.)
                         │
                         ▼
              ┌──────────────────────┐
              │ raindrop history     │  ← list all revs
              │   <slug>             │
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │ raindrop diff <slug> │  ← see what changed
              │   --from rev1        │
              │   --to rev<latest>   │
              └──────────────────────┘
```

### Commands

```bash
# 1. Check for stale slugs and re-fetch any whose upstream changed.
hirono raindrop sync --check-stale --max-age 30

# 2. List the revision history for a slug. Output: markdown table with
#    rev | fetched_at | content_file | content_sha | quality |
#    failure_kind | size | image count.
hirono raindrop history 2026-04-19-aws-trainium3-deep-dive

# 3. Diff between two revisions. Default: rev1 → latest.
hirono raindrop diff 2026-04-19-aws-trainium3-deep-dive

# 4. Diff between specific revs or dates.
hirono raindrop diff <slug> --from rev1 --to rev3
hirono raindrop diff <slug> --from 2026-04-01 --to 2026-05-01

# 5. Just the structural-change summary (skip the unified diff).
hirono raindrop diff <slug> --summary
```

### What to expect

```
# 2026-04-19-aws-trainium3-deep-dive — diff rev1 → rev2

2026-04-19 → 2026-05-08 (19d apart)

| field | rev1 | rev2 | Δ |
|---|---:|---:|---:|
| chars | 91349 | 92104 | +755 |
| headings | 24 | 25 | +1 |
| fences | 8 | 8 | 0 |
| ...
| content_sha | `84dcd9f4e5a0` | `c3a1f2b0` | changed |

@@ -201,3 +201,4 @@ The reward is...
+## Update (May 2026)
+...
```

### Regression detection

When `quality_status` was `good` in rev N and a later rev `M`
becomes `flagged` or `failed`, the diff summary surfaces it:

```
⚠️  REGRESSION: rev1 was `good`, rev2 is `flagged`
   (failure_kind=upstream-deleted)
```

Likely meaning the page moved behind a paywall, was deleted, or
the host changed substantially. Investigate the upstream URL.

### What if X happens

| Symptom | What to do |
|---|---|
| `raindrop history <slug>` says "no revisions" | Slug pre-dates Feature 3. Backfill is automatic — re-run; rev 1 will be synthesized from `source.json`. |
| `raindrop diff` says files are identical | Upstream content_sha matches; nothing actually changed despite a refetch. |
| `revisions.jsonl` warning about partial last line | An interrupted write left a truncated row. Fix with `repairRevisions` (programmatic; CLI surface is a 10-line follow-up — open an issue). |
| Many `--check-stale` hits but nothing escalates to fetch | Upstream etags are stable; pages haven't actually changed. Working as designed. |

---

## 5. Adapter promotion / per-host work

When `_default` produces sub-good output for a host repeatedly, that
host is a candidate for graduation to a dedicated site module. The
graduation path is the proven recipe documented in CLAUDE.md §5.

```
              ┌──────────────────────────┐
              │ raindrop status          │
              │   --json | jq '.flags[]' │  ← which hosts fall back?
              └──────────┬───────────────┘
                         ▼
              ┌──────────────────────────┐
              │ identify host appearing  │
              │ frequently in flagged    │
              │ rows or with             │
              │ _default-used-browser-   │
              │ fallback flag            │
              └──────────┬───────────────┘
                         ▼
              ┌──────────────────────────┐
              │ raindrop check           │  ← did it cross the
              │                          │    > 1 threshold?
              └──────────┬───────────────┘
                         ▼
              ┌──────────────────────────┐
              │ build site module per   │
              │ tools/sites/MIGRATION.md │
              └──────────┬───────────────┘
                         ▼
              ┌──────────────────────────┐
              │ approve.ts to capture    │
              │ fixture + snapshot       │
              └──────────┬───────────────┘
                         ▼
              ┌──────────────────────────┐
              │ hirono raindrop sync           │
              │   --retry-kind <kind>    │  ← refetch hosts that
              │                          │    moved off _default
              └──────────────────────────┘
```

### Identifying candidates

Two complementary surfaces flag hosts that need attention:

**(a) `hirono raindrop check` — "New hosts since last check".** Lists
every host that has at least one bookmark but was missing from the
graduation snapshot at `tools/opencli/host-counts.json`. Singletons
(count == 1) surface in `## New hosts since last check`; hosts that
have already crossed count >= 2 surface in `## Brand-new hosts`. Use
this when first triaging a fresh sync — anything new is a candidate
for either a dedicated module or a documented `intentional-stub`
decision.

**(b) `hirono raindrop status` host-coverage footer.** Every status
report ends with a `## Host coverage overview` block:

```
Total hosts: ~125 (~560 bookmarks)
- Dedicated-module covered: 36 hosts (488 bookmarks)
- _default-routed: 90 hosts (90 bookmarks)
  - producing clean MD: 78 hosts
  - producing stub/error: 12 hosts (graduation candidates)
    > openreview.net (1 bookmark, 1 stub/error) — kind: upstream-not-html
    > cursor.com (1 bookmark, 1 stub/error) — kind: upstream-not-html
    ...
```

A host in the "graduation candidates" list either needs a dedicated
module (CLAUDE.md §5a recipe) or a deliberate decision to accept the
stub. Sort by `kind` to spot patterns: many `upstream-not-html` rows
mean a PDF/binary-handling improvement, many `upstream-spa-no-content`
rows mean a browser-eval module is needed.

Older queries that still work for ad-hoc filtering:

```bash
# Find hosts where _default fell back to browser-eval.
hirono raindrop status --json | jq -r '
  select(.flags | any(. == "_default-used-browser-fallback"))
  | .host' | sort | uniq -c | sort -rn

# Or hosts with consistently flagged status under _default:
hirono raindrop status --json | jq -r '
  select(.kind | startswith("content-") or startswith("upstream-spa"))
  | .host' | sort | uniq -c | sort -rn
```

A host appearing 3+ times warrants a dedicated module.

### Build the module

Reference: `tools/sites/MIGRATION.md`. Recipe:

1. Pick the cleanest source (REST API > raw mirror > server HTML > browser-eval).
2. Create `tools/sites/<host>/index.ts` (use `makeArticleSite({...})` for typical blog shape; reference `tools/sites/aleksagordic/` for the simplest 15-line config).
3. Register in `tools/sites/index.ts` BEFORE `_default`.
4. Generate fresh markdown for ≥3 representative URLs:
   ```bash
   npx tsx tools/bin/hirono.ts raindrop fetch <url> --slug zz-test-<host> --force
   ```
   Eye-read each. Show the markdown to the user for approval.
5. After approval, capture fixture + snapshot:
   ```bash
   npx tsx tools/__tests__/approve.ts \
     --site <host> --name <slug> --url <url> --slug zz-snap-<slug> --yes
   ```
   Capture ≥3 fixtures covering distinct content shapes.
6. Run `npm test` (must be green) + commit.

### After landing

```bash
# Re-run sync to pull the host through the new module.
hirono raindrop sync --retry-kind upstream-spa-no-content
# (or whatever kind the old _default output was producing)
hirono raindrop status --filter clean   # those hosts should now be here
```

---

## 6. Override workflow

When the auto-classifier mis-categorizes a slug, pin the kind in
`00_Meta/sources-health-overrides.md`. The status report will use your
kind (with a 📌 marker) instead of the auto-classifier's.

### When to use overrides vs `00_Meta/fetch-decisions.md`

| File | Effect |
|---|---|
| `00_Meta/sources-health-overrides.md` | Changes the **kind** displayed in `status` reports. Doesn't suppress retries. |
| `00_Meta/fetch-decisions.md` | **Suppresses** future fetch attempts (`sync` skips listed slugs). Doesn't change the kind. |

You'll often use both — pin the kind to reflect reality, then accept
in fetch-decisions to stop retrying.

### Commands / file edits

```bash
# 1. See what the classifier said.
hirono raindrop status --filter content-too-short

# Suppose 2026-04-21-some-tweet shows up but you've eyeballed it and
# the body is 80 chars by design (a tweet) — not a defect.

# 2. Edit 00_Meta/sources-health-overrides.md. Add under today's date:
$EDITOR 00_Meta/sources-health-overrides.md
```

Add a row like:

```markdown
## 2026-05-08

- 2026-04-21-some-tweet: pin-kind=clean   # micro-post; 80 chars is normal here
```

```bash
# 3. Re-run status — the slug now appears under `clean` with 📌.
hirono raindrop status --filter clean | grep some-tweet
```

### Format reference

The parser matches:
```
- <slug>: pin-kind=<kind>          # optional rationale comment
```

`<slug>` is the directory name under `raw/raindrop/<host>/`. `<kind>` must be
one of the canonical kinds:

```
clean | upstream-deleted | upstream-paywall | upstream-auth-gated |
upstream-spa-no-content | upstream-not-html | upstream-fetch-failed |
host-lan-only | host-malformed | host-throttled |
content-incomplete-images | content-incomplete-images-zero |
content-too-short | intentional-stub-app-only | not-yet-fetched
```

Lines that don't match are silently ignored. Unknown kinds log a
warning + skip.

---

## 7. Health-check schedule

Suggested cadence — adjust to your appetite.

| Cadence | Commands | Why |
|---|---|---|
| **After every fetch session** | `hirono raindrop status` | Confirms what landed cleanly + surfaces new failures. |
| **Daily** (light) | `hirono raindrop refresh-cache` then `raindrop new --md` | See what new bookmarks arrived; ingest if motivated. |
| **Weekly** | `hirono raindrop sync --retry-flagged` then `raindrop status` | Catch transient image-download failures, network blips. |
| **Monthly** | `hirono raindrop sync --check-stale --max-age 30` | Detect upstream content changes (content-revN.md gets written when changed). |
| **Quarterly** | `hirono raindrop sync --check-stale --max-age 90 --retry-prefix upstream-` | Re-attempt feishu auth-gated, x.com auth-required, etc. — host access may have changed. |
| **As needed** | `raindrop history <slug>` / `raindrop diff <slug>` | Investigating a specific source's evolution. |
| **Before commits** | `hirono raindrop check` | Coverage gate — fail fast if a new host crossed the > 1 threshold without a dedicated module. |

### Batch-close ritual (run after every ingest batch)

When the LLM finishes writing N new `03_Sources/YYYY/<slug>.md` pages (whether
one slug or a 20-slug batch), close the batch with this sequence:

```bash
# 1. Maintenance — refs / tier / counts / state field
npx tsx tools/bin/reindex.ts                      # entity refs + tier promotions + 00_Meta/index*.md
npx tsx tools/bin/build-sources-index.ts          # URL → slug map (used by state derivation)
npx tsx tools/bin/hirono.ts raindrop reindex-raw  # raw/raindrop/_index.json state field

# 2. Lint — schema compliance + dead wikilinks
npx tsx tools/bin/lint.ts

# 3. Read the reindex output for Observation gaps. Every line like
#    "NVIDIA refs=8  missing 8 observations" is one piece of LLM work
#    waiting in the queue — open the entity, view each missing Source,
#    append a cited Observation bullet per schema.md §entity-page.

# 4. Schema-audit habit (~5 min, biweekly or after schema-touching commits):
#    Read 00_Meta/schema.md end-to-end. Any section that no longer matches the
#    new Source pages you just wrote? Update schema first, regenerate
#    pages second. Schema drift compounds — catch it while context is fresh.

# 5. Commit per batch (not per slug) so git log shows batch boundaries.
git add -A
git commit -m "ingest: <batch description> (N sources)"
```

The Observation-gap report in step 3 is the **post-batch checklist**.
Skipping it leaves Entity pages with refs but no cited observations — the
schema's "every bullet cites its source" rule decays. The gap report
keeps the debt visible.

### Continuous integration

The test suite (`cd tools && npm test`) is the green-gate for the
pipeline itself. It runs:

- Per-host snapshot regressions (any dedicated site module's output
  drifting from its locked snapshot fails the build).
- Per-converter byte-equal fixture tests.
- Coverage gate (every registered site module must have ≥1 fixture
  + ≥1 snapshot).
- Sync-plan logic, classifier, revisions log primitives.

Run before every commit that touches `tools/sites/` or
`tools/fetch-raw.ts`.

---

## 8. Command reference

### `hirono raindrop ...`

| Command | Purpose | Most-used flags |
|---|---|---|
| `check` | Enumerate corpus; report duplicate URLs + hostname coverage gaps. Exits non-zero on findings. | `--input <path>` `--json` `--quiet` |
| `refresh-cache` | Pull all bookmarks from Raindrop API into `.wiki-raindrop-cache.json`. | (none) |
| `new` | List bookmarks not yet in the sources index. Output is `ingest_batch plan`-compatible JSON. | `--json` `--md` `--out <path>` |
| `fetch <id\|url\|slug>` | Fetch one source into `raw/<slug>/` (with post-cleanup pipeline). Alias: `export`. | `--slug <slug>` `--force` `--no-images` |
| `refetch <slug>` | Re-fetch using the origin recorded in `source.json`. Append-only by default (writes `content-rev2.md`). | `--no-images` |
| `sync` | Idempotent (re)fetch over `raw/` + `ingest_batch` pending queue. | `--limit N` `--retry-flagged` `--retry-kind <kind>` `--retry-prefix <prefix>` `--check-stale` `--max-age <days>` `--only <slug,...>` `--dry-run` |
| `verify <slug>` | Re-classify quality of an existing slug without re-fetching. | (none) |
| `fetch-all` | Bulk fetch one copy of every unique URL from cache. | (none — uses sync internally) |
| `status` | Per-bookmark health report joined from cache + index + raw/. Classified onto the 15-kind taxonomy. | `--json` `--csv` `--md` `--filter <kind>` `--filter-prefix <prefix>` `--out <path>` |
| `history <slug>` | List all revisions for a slug. | `--json` |
| `diff <slug>` | Unified diff between two revisions. | `--from <rev\|date>` `--to <rev\|date>` `--summary` `--no-color` |
| `store <slug>` | Write pre-fetched markdown into `raw/<slug>/` (low-level; piped from MCP). | `--origin <id>` `--origin-url <url>` `--input <path>` |
| `fetch-lark <token>` | Fetch via lark-hirono node token (low-level). | `--slug <slug>` `--no-images` |

### Removed: legacy `fetch-raw` CLI

The previous `tools/bin/fetch-raw.ts <subcommand>` binary has been
removed. Every subcommand now lives under `hirono raindrop`:

| Removed | Use instead |
|---|---|
| `fetch-raw fetch-url <url> --slug <slug>` | `hirono raindrop fetch <url> --slug <slug>` |
| `fetch-raw refetch <slug>` | `hirono raindrop refetch <slug>` |
| `fetch-raw sync ...` | `hirono raindrop sync ...` |
| `fetch-raw verify <slug>` | `hirono raindrop verify <slug>` |
| `fetch-raw status` | `hirono raindrop status` (richer report) |
| `fetch-raw store ...` | `hirono raindrop store ...` |
| `fetch-raw fetch-lark ...` | `hirono raindrop fetch-lark ...` |

### Other tools

| Command | Purpose |
|---|---|
| `hirono doctor` | Environment + adapter health check. `--fix` repairs symlinks. |
| `npx tsx tools/bin/build-sources-index.ts` | Rebuild `.wiki-sources-index.json` from `03_Sources/**.md`. |
| `npx tsx tools/bin/build-mention-map.ts` | Build the wiki-link cross-reference map. |
| `npx tsx tools/bin/reindex.ts` | Recompute frontmatter `refs:` / `tier:` / `source_count:`; promote `_seen/` entities; regenerate `00_Meta/index*.md`. |
| `npx tsx tools/bin/ingest_batch.ts <subcommand>` | Batch-state manager — `plan` / `next` / `start` / `mark-done` / `list`. |
| `npx tsx tools/bin/lint.ts` | Wiki-content linter. |
| `npx tsx tools/bin/find-dupes.ts` | Find duplicate slugs / wiki-link conflicts. |
| `cd tools && npm test` | Run the full regression suite (per-host snapshots, fixtures, classifier, revisions). |

### Override files

| File | Purpose |
|---|---|
| `00_Meta/fetch-decisions.md` | Slug-level "accept-as-is" — `sync` skips listed slugs on subsequent runs. |
| `00_Meta/sources-health-overrides.md` | Slug-level `pin-kind=<kind>` — overrides the auto-classifier in `status`. |

### Output files (operator-facing)

| Path | Purpose |
|---|---|
| `03_Sources/2026/<slug>.md` | Hand-authored ingest report for a bookmark. The canonical citation target. |
| `raw/raindrop/<host>/<slug>/content.md` | Latest fetched markdown for a slug. |
| `raw/raindrop/<host>/<slug>/content-rev<N>.md` | Earlier revisions when refetched without `--force`. |
| `raw/raindrop/<host>/<slug>/source.json` | Latest fetch metadata (status, flags, etag, etc.). |
| `raw/raindrop/<host>/<slug>/revisions.jsonl` | Append-only audit log of every fetch (rev, sha, status, kind). |

### State files (gitignored, regenerated)

| File | Purpose |
|---|---|
| `.wiki-raindrop-cache.json` | Bookmark mirror, pulled by `refresh-cache`. |
| `.wiki-sources-index.json` | URL → slug map, rebuilt by `build-sources-index.ts`. |
| `.wiki-batch-state.json` | `ingest_batch` state across sessions. |
| `.wiki-mention-map.json` | Wiki-link map, rebuilt by `build-mention-map.ts`. |
| `.wiki-fetch-issues.md` | Append-only issue log written by L2 errors. |

---

## 9. Curation workflow

The wiki accumulates curation debt as Sources are ingested — duplicate
Entities created at different times under slightly different names, Topics
whose names diverge, `_seen/` stubs that never accumulate refs, Synthesis
paragraphs whose claims are contradicted by newer Sources. Mechanical lint
(`reindex.ts` + `lint.ts`) catches structural issues; the curation layer
addresses semantic / LLM-judgment ones.

### 9.1 Cadence

| When | What | How long |
|---|---|---|
| Every ingest batch | `hirono health-check` — quick read-only audit | < 5 sec |
| Every ~25 sources / monthly | `hirono health-check --scope all` + apply structural fixes (rename / merge / delete) | 15-30 min |
| Quarterly | Ask Claude in-session to walk the Stale Synthesis + Observation-Synthesis contradiction lists and rewrite affected `## Synthesis` blocks | 1-2 hr |

### 9.2 The four mutator commands

```
hirono rename-entity <Old> <New> [--reason "..."]
  Atomic rename: moves Entities/[_seen/]<Old>.md → <New>.md, rewrites
  every [[Old]] (and [[Old|alias]]) corpus-wide, appends a refactor log entry.

hirono merge-entities <Src> --into <Tgt> [--reason "..."]
  Atomic entity merge: concatenates Observations with merge-marker comment,
  marks Synthesis stale (TODO comment for LLM regeneration), rewrites
  wikilinks, deletes source.

hirono merge-topics <Src> --into <Tgt> [--reason "..."]
  Same shape for Topics; per-section concatenation.

hirono bulk-delete-orphans [--confirm <slugs>] [--all-zero] [--dry-run]
  Lists (default) or deletes _seen/ entities at refs=0. Only deletes from
  _seen/ — never active entities, never Topics, never Sources.
```

All mutators are **atomic** (two-phase commit via `.curation-staging/`)
and **emit a refactor log entry** so the operator never has to remember
to update `00_Meta/log-YYYY.md` manually.

### 9.3 The four-step pattern

1. **Audit**: `hirono health-check` — read-only report.
2. **Review**: read the report. Decide which orphans to delete, which
   duplicate-pair candidates are real merges (vs intentional SKU
   distinctions), which Synthesis blocks need regeneration.
3. **Mutate**: run the matching CLI for each structural item.
4. **Regenerate**: ask Claude in-session to rewrite stale-Synthesis blocks
   identified by the report. Bump `synthesis_updated_at:` on each touched
   entity.
5. (Always) Run `npx tsx tools/bin/reindex.ts` to refresh indexes after
   any mutation; verify lint clean.

### 9.4 What NOT to use these for

- **Don't auto-delete active-tier entities.** Even if refs drop to 0,
  active entities stay sticky (per the Karpathy invariant). Demotion is
  manual + logged.
- **Don't merge SKU distinctions.** The B200 / B300 / H100 / H200 separation
  is a feature, not duplication. The health-check's duplicate-pair
  heuristic flags some false positives there; operator ignores them.
- **Don't use rename/merge to fix a typo in a single Source's wikilink.**
  Edit the Source body directly; reserve the mutators for corpus-wide
  changes.

## 10. Source curation (Phase B)

The Karpathy-aligned default is to **ingest every URL** in raw/ and let
auto-detect-entities grow the graph. Source-level cleanup is for the rare
accident where a bookmark shouldn't have been added.

### 10.1 Delete a single Source (operator decided it was a mistake)

```bash
hirono delete-source <slug> [--keep-raw] [--reason "..."]
```

Atomic: deletes `03_Sources/<year>/<slug>.md` + `raw/raindrop/<host>/<slug>/`
(unless `--keep-raw`), appends a `refactor | Delete Source` log entry.
Refuses if any Entity/Topic wikilinks the Source (dangling-ref guard);
`--force` overrides.

After: `npx tsx tools/bin/build-sources-index.ts` to refresh the URL→slug index.

### 10.2 The skip-list (`00_Meta/sources-ingest-skips.md`)

Last-resort permanent-exclusion registry. **NOT for off-topic Sources**
(those get ingested; the wiki absorbs broadly per Karpathy). Use only for:
- recurring spam URLs
- known duplicate URLs (one canonical, others to be permanently skipped)
- explicitly deprecated content the operator doesn't want re-ingested
- one-off bookmark accidents

Hand-edit, or use `hirono raindrop forget` (next).

### 10.3 `hirono raindrop forget` (composed accident cleanup)

```bash
hirono raindrop forget <slug-or-url> \
    --reason "Bookmarked by mistake" \
    [--skip-reason <spam|duplicate|deprecated|bookmarked-by-mistake|other>]
```

Composes `delete-source` + skip-list registration in a single command.
Handles three local-state branches automatically:
- **source-and-raw** present → delete both, add URL to skip-list
- **raw-only** (HSBC case: errored at ingest, no Source written) → delete raw + add URL
- **neither** (URL only in `.wiki-raindrop-cache.json`) → add URL only

Raindrop bookmark stays upstream (we don't have write API); skip-list permanently shields.

To un-skip later: delete the line from `00_Meta/sources-ingest-skips.md`.

## 11. Auto-gen and refine entities (Phase B)

Karpathy's gist describes ingest as "the LLM reads the source [and]
updates relevant entity and concept pages across the wiki." Two Phase B
CLIs codify this as repeatable batch operations.

### 11.1 `hirono auto-detect-entities <slug>`

LLM-NER entity extractor. Three modes:

```bash
# 1. Generate prompt package for operator to feed Sonnet
hirono auto-detect-entities 2026-04-03-foo-slug
# → writes raw/raindrop/<host>/<slug>/<slug>-entities-prompt.md

# 2. Spawn Sonnet subagent in your Claude session with that prompt.
#    Save the JSON response to:
#        raw/raindrop/<host>/<slug>/<slug>-entities-response.json

# 3. Dry-run: classify the response against existing entity index + aliases
hirono auto-detect-entities 2026-04-03-foo-slug --response <path>

# 4. Apply: atomically create _seen/<canonical>.md stubs + log entry
hirono auto-detect-entities 2026-04-03-foo-slug --response <path> --apply
```

Wikilink insertion is operator's call (reported, not auto-applied — picking the right insertion point requires judgment).

Aliases live in `00_Meta/entity-aliases.md` (normalization hints only, NOT a scope gate).

### 11.2 `hirono refine-entity <name>`

LLM-driven Synthesis regenerator. Same three-mode shape:

```bash
hirono refine-entity MLA                       # → prompt package
# spawn Sonnet → save response.txt
hirono refine-entity MLA --response <path>     # → dry-run diff
hirono refine-entity MLA --response <path> --apply
```

Apply phase replaces `## Synthesis`, bumps `synthesis_updated_at: <today>`, appends `refactor | Refine [[<name>]] Synthesis` log entry.

**Token-cost notes** (apply to every `refine-*` and `auto-detect-entities`):

- **Cache-friendly preamble**: every prompt file starts with a stable preamble from `tools/hirono/_shared/prompt-preamble.ts` (`REFINE_ENTITY_PREAMBLE`, `REFINE_TOPIC_PREAMBLE`, etc.). When you spawn a Sonnet Agent on the prompt, the Claude API caches this preamble for ~5 minutes — subsequent spawns within the TTL hit cache, billing only the variable suffix (subject name, cited bodies) at full rate. Practical implication: **run multi-entity refines back-to-back** (e.g. `auto-fix` stale loop) within a single 5-minute window to maximize cache reuse. Editing the preamble file invalidates the cache for ~5 minutes.
- **Curated source mode** (default): cited Source bodies are excerpted to `## TL;DR` + `## Key claims` + `## What this changes` + `## Entities touched` + `## Topics touched` via `tools/hirono/_shared/source-excerpt.ts`. ~60–80% smaller than full raw bodies. Use `--full-source` as an escape hatch when the Source's own curation is suspect; ~3× more tokens.
- **Measure sidecars**: every prepare-mode write also produces `<prompt>-measure.json` next to the prompt — tracks `prompt_chars`, `prompt_lines`, `source_count`, `stub_count`, `mode`. Compare across runs to spot prompt-size regressions.

### 11.3 `hirono refine-all-stale` (batch)

```bash
hirono refine-all-stale            # prepare prompts for all stale entities
hirono refine-all-stale --list     # list-only mode (don't write prompt files)
hirono refine-all-stale --preview  # cost-only: prompts/tokens/$ — no writes
hirono refine-all-stale --limit 10 # cap to top 10 most-stale; rest deferred
```

Runs `lint --check stale-synthesis --json`, calls `refine-entity` in prepare mode for each flagged entity. Operator then orchestrates the per-entity Sonnet calls.

**Refine-storm containment.** Each stale Entity carries its own `synthesis_updated_at` counter (per-item, not global). Refining the top-N stalest items leaves the rest untouched — next run picks them up in lag-desc order. There's no "must refine all at once" coupling. Use `--preview` to see the bill before authorizing; use `--limit N` to cap a batch.

### 11.3a Post-bulk-ingest discipline: `hirono ingest-preview`

After a bulk `fetch-all` + per-Source `auto-detect-entities --apply`, the natural failure mode is the **refine storm**: 30 new Sources can fan out into 80+ stale Entities + 15+ stale Topics. The 7-day staleness lag (see `lint.ts:862` `STALE_LAG_DAYS`) is the natural batching mechanism — but only if the operator stops to see the fan-out shape before reflexively running `refine-all-stale`.

```bash
hirono ingest-preview              # default: since HEAD~1
hirono ingest-preview --since v0.7 # against a tag/branch/SHA
hirono ingest-preview --json       # machine-readable for further tooling
```

Output:

- **Ingest signal**: new Sources + touched Entities/Topics counts since `<ref>` (from git diff + each Source's `## Entities touched` / `## Topics touched`).
- **Lint-flagged staleness**: counts of stale-synthesis / stale-topic-synthesis / stale-top-synthesis right now.
- **Cost preview**: Sonnet calls × est input tokens × est cost (Sonnet 4.6 at list price). Entity costs use real `refineEntity({ preview: true })` builds; topic/top-synthesis costs use stable per-call averages.
- **Recommended next steps**: cap suggestions, or "wait — staleness will batch further drift".

**Discipline**: ingest frequently, refine rarely. Let staleness accumulate so each refine batches multiple Sources' worth of drift. The 7-day lag is a feature, not a deadline. Manual refines reset the per-item counter cleanly — no drift, no race conditions.

### 11.4 Top-level [[00_Synthesis]] regeneration

[[00_Synthesis]] (repo root) is the corpus-wide thesis page — what the wiki *collectively* argues across all Topics. It is regenerated **per-batch, not per-ingest**: most ingests refine claims, they don't shift them, so per-ingest regeneration is noise.

**Trigger detection — fully automated.** The lint check `stale-top-synthesis` (in `tools/bin/lint.ts`) flags `00_Synthesis.md` when its `updated:` is > 7 days older than the newest Topic `synthesis_updated_at`. Symmetric with the per-entity `stale-synthesis` check; same threshold.

**Regeneration flow — three commands, mirrors `refine-entity`/`refine-topic`**:

```bash
# 1. Prepare prompt (gathers 00_Synthesis.md + every Topic's What+Current understanding):
hirono refine-synthesis
#   → writes .refine-prompts/synthesis-prompt.md

# 2. Spawn a Sonnet subagent on the prompt; save the response to:
#    .refine-prompts/synthesis-response.txt

# 3. Apply atomically (replaces body, bumps updated:, appends log entry):
hirono refine-synthesis \
    --response .refine-prompts/synthesis-response.txt --apply
```

Dry-run with `--response <path>` (without `--apply`) prints the diff before commit.

**Auto-fix integration.** `hirono auto-fix` (Tier-1, zero-touch) automatically detects `stale-top-synthesis` and runs Step 1 alongside per-entity refine prep. The prompt package is ready under `.refine-prompts/synthesis-prompt.md` without operator intervention; Steps 2+3 still need the Sonnet subagent spawn.

**Auto-curate integration.** `hirono propose-curation` exposes `refine-synthesis` as a Sonnet-dispatchable proposal kind. When the Sonnet judge sees the `stale-top-synthesis` lint finding, it can emit a proposal that `apply-queue` executes as `hirono refine-synthesis` (which prepares the prompt). The Sonnet+apply loop for the regeneration itself is the operator's next iteration — same shape as how `refine-entity` regenerations close.

**Quality bar**: every claim in [[00_Synthesis]] must be backed by ≥1 `[[01_Topics/X]]` or `[[03_Sources/YYYY/X]]` or `[[<Entity>]]` wikilink. Orphan assertions (claims with no link) are a regression — the lint doesn't catch them, so eye-read every regeneration before approving.

## 12. Drift detection (Phase B)

```bash
hirono health-check --scope drift     # raw-archive drift audit
hirono health-check --scope sources   # source-level health audit
hirono raindrop gc [--keep-last N]    # content-rev*.md cleanup
```

**`--scope drift`** surfaces:
1. Raw archives where content_sha changed but Source not re-summarized
2. Dead URLs (`quality_flags=dead-link`) not yet pinned
3. Raindrop-deleted URLs (still in raw/, no longer in cache)
4. HEAD-check stale (last upstream check > 90d)
5. Sources older than their cited raw archive's latest revision

**`--scope sources`** surfaces:
1. Sources with 0 outgoing wikilinks
2. Tag outliers (every tag unique to one Source)
3. Age-stale Sources (created > 180d ago)
4. Sources cited only by Topics (no Entity Observations)

**Cadence**: drift audit before each bulk-fetch cycle; sources audit before bulk-refine.

**Pinning dead URLs**: add `pin-kind=dead-link-accepted` to `00_Meta/sources-health-overrides.md` to mark a dead URL as operator-accepted (sync skips it from retry loops).

**Revision GC**: `hirono raindrop gc --keep-last 3` keeps the most recent 3 revisions; older `content-rev*.md` files are deleted and `revisions.jsonl` is updated with `body_pruned=true` markers.

## 13. Three modes of automation (operator-touch ladder)

The curation pipeline is fully LLM-driven end-to-end. The three "modes" differ only in how much operator review sits between the LLM's proposals and the actual file mutations:

| Mode | LLM does | Operator does | Command |
|---|---|---|---|
| **Zero-touch** | nothing (mechanical operations only) | nothing | `hirono auto-fix` |
| **One-tap** (default for Tier 2) | judges health-check findings, proposes specific atomic-CLI commands with rationale, dispatcher executes | reviews `00_Meta/curation-queue.md`, ticks `[x]` approved boxes | `propose-curation` → spawn Sonnet → `apply-queue` |
| **Full auto** | same as one-tap PLUS auto-dispatch of high-confidence items | nothing (just kicks off the loop) | `propose-curation` → spawn Sonnet → `apply-queue --auto-apply high` |

All three modes are *automated* — the LLM does the judgment work. They differ in operator-approval scope. Full-auto is appropriate when the operator trusts Sonnet's high-confidence calls (case-only alias merges, obvious orphan deletions, name collisions); one-tap is appropriate when reviewing each proposed mutation is worth the ~5 minutes; zero-touch is the safe-by-construction subset.

## 13a. Zero-touch: `hirono auto-fix`

The narrowest autonomous loop. Runs three safe-by-construction operations and **never deletes anything**:

```bash
hirono auto-fix [--dry-run]
```

**Step 1 — alias merges**: for each `variant → canonical` in `00_Meta/entity-aliases.md` where BOTH `02_Entities/_seen/{variant,canonical}.md` exist, run `hirono merge-entities` automatically. Safe because the alias is operator-declared: if `bfloat16 → BF16` is in the file, the operator already stated they're the same thing. The merge concatenates Observations (no information loss), rewrites wikilinks, appends a refactor log entry.

**Step 2 — refine-prompt prep**: for each entity flagged stale by `lint --check stale-synthesis`, write a refine prompt package to `.refine-prompts/`. Also, when `lint --check stale-top-synthesis` fires (top-level `00_Synthesis.md` >7d behind newest Topic `synthesis_updated_at`), prep `.refine-prompts/synthesis-prompt.md` via `hirono refine-synthesis`. No mutations. Operator then spawns Sonnet → apply per the normal refine workflow (per-entity or top-level).

**Step 3 — index refresh**: run `reindex.ts` + `build-sources-index.ts` to keep catalogs current. Mechanical, no content rewrites.

**What auto-fix does NOT do** (deliberate, in answer to "when does delete trigger?"):

- **No auto-delete of `_seen/` orphans.** Auto-detect-entities creates stubs at refs=0 by design; deletion would constantly fight the operator. Deletion stays in Tier 2.
- **No auto-apply of refines.** Synthesis regeneration is judgment-heavy; operator approves each.
- **No auto-merge of entities not in `entity-aliases.md`.** Sonnet-judged merges go through Tier 2.

Safe enough for a pre-commit hook or scheduled cron. All mutations are atomic + logged + `git revert`-able.

**Cadence**: weekly, or on-demand when new aliases land in `entity-aliases.md`.

## 13b. Unified loop: `hirono auto-curate`

Both one-tap and full-auto modes are wrapped in a single command that runs the whole cycle:

```bash
# Phase 1: auto-fix + propose-curation prompt
hirono auto-curate
# → spawn Sonnet subagent on the printed prompt
# → save response to .curation-prompts/curation-proposal-response.json

# Phase 2 (full-auto — high-confidence items dispatch without review):
hirono auto-curate --continue

# OR Phase 2 (one-tap — operator reviews queue + runs apply-queue manually):
hirono auto-curate --continue --review
```

Two commands + one Sonnet spawn for the entire monthly curation cycle. Flags:
- `--auto-apply <level>` — passed through to apply-queue (default `high`)
- `--dry-run` — show what would run, don't dispatch
- `--skip-step <auto-fix|propose|apply>` — skip a phase step
- `--review` — stop after queue render, defer apply-queue to operator

This is a thin orchestrator over the underlying CLIs; behavior is identical to running them by hand. Use whichever level of granularity fits the operator's risk tolerance.

## 13c. Trigger strategy — when does anything fire automatically?

Mostly the answer is "nothing fires; operator invokes" — but two narrow exceptions handle the easy cases:

**Post-commit hook** (`.githooks/post-commit`) runs `hirono auto-fix --skip-reindex` after every commit. Scope:
- Auto-applies alias merges where both sides exist in `00_Meta/entity-aliases.md`.
- Skips reindex (the just-committed snapshot already has fresh indexes via pre-commit lint).
- Loop-safe: skips itself if the previous commit was an auto-fix commit.
- Escape hatch: `HIRONO_SKIP_POST_COMMIT=1 git commit ...` bypasses.

**Lint advisory** — the `curation-needed` check (info-level, never blocks) aggregates `stale-synthesis + orphans + tier-mismatch` counts. When the total crosses `5`, lint prints:

```
INFO  (wiki): N curation candidates accumulated: X stale-synthesis, Y orphans, Z tier-mismatch
      → Run `hirono auto-curate` ...
```

Operator sees the advisory in routine `lint` output and decides when to run the full curation loop.

**Refine trigger policy** (the "too-often vs too-rarely" balance): `stale-synthesis` fires when either:
- Newest citing Source is > 7 days newer than `synthesis_updated_at` (lag rule — gives ingest activity a grace window), OR
- `synthesis_updated_at` is > 30 days old AND ≥ 3 Observations have accumulated (slow-drift rule — catches entities that don't get new cites but accumulate context anyway).

Constants live at the top of `checkStaleSynthesis` in `tools/bin/lint.ts`: `STALE_LAG_DAYS = 7`, `STALE_AGE_DAYS = 30`, `STALE_OBS_THRESHOLD = 3`. Tune if the cadence feels wrong.

**What's NOT triggered**:
- Curation (merge/rename/refine/delete) — always operator-invoked via `auto-curate` or `propose-curation` + `apply-queue`.
- Source ingestion — operator drops URLs into Raindrop; LLM-in-chat ingests.
- Sonnet subagent calls — CLI cannot spawn subagents; the Claude session orchestrates.

## 13d. One-tap / full-auto: propose-curation → apply-queue

At scale (hundreds of entities, growing fast), running `health-check` and then deciding-and-invoking the matching atomic CLI for each finding gets expensive. Tier 2 compresses the loop: one LLM-judgment pass produces a queue of proposed mutations, the operator reviews them as a batch, then dispatches the approved subset in one shot.

```bash
# 1. Generate prompt package (runs health-check + lint internally, samples
#    bodies of flagged entities so Sonnet has context to judge):
hirono propose-curation
# → writes .curation-prompts/curation-proposal-prompt.md

# 2. Spawn Sonnet subagent in Claude session. Save JSON response to:
#    .curation-prompts/curation-proposal-response.json

# 3. Finalize: render operator-reviewable queue with checkboxes
hirono propose-curation --finalize .curation-prompts/curation-proposal-response.json
# → writes 00_Meta/curation-queue.md (operator opens + ticks [x] approved items)

# 4. Apply approved items — each dispatches to the matching atomic CLI
hirono apply-queue
# Or skip the manual checkbox step for high-confidence items:
hirono apply-queue --auto-apply high

# Dry-run first to verify what would happen:
hirono apply-queue --auto-apply high --dry-run
```

**Proposal kinds Sonnet may emit** — each backed by an existing atomic CLI, so the dispatcher is a thin wrapper:

| Kind | Atomic CLI invoked | When |
|---|---|---|
| `merge-entities` | `hirono merge-entities <Src> --into <Tgt>` | duplicate-pair candidates that aren't SKU distinctions |
| `merge-topics` | `hirono merge-topics <Src> --into <Tgt>` | topic-name collisions, semantic-duplicate topics |
| `rename-entity` | `hirono rename-entity <Old> <New>` | canonical-name normalization |
| `delete-orphan` | `hirono bulk-delete-orphans --confirm <slug>` | refs=0 stubs with no semantic value |
| `refine-entity` | `hirono refine-entity <name>` | active entity Synthesis stale or contradicted |
| `refine-topic` | `hirono refine-topic <name>` | Topic Current understanding drifted |
| `refine-synthesis` | `hirono refine-synthesis` | top-level `00_Synthesis.md` flagged by `stale-top-synthesis` |
| `add-comparison-heading` | `hirono add-comparison-heading <name>` | `comparison-opportunity` lint surfaces a Topic with ≥3 active-tier entity wikilinks + contrast markers in prose; Sonnet judges whether the contrast is load-bearing |
| `skip` | (no-op) | finding is a false positive (SKU distinction, intentional naming) |

**Choosing one-tap vs full-auto**: the LLM-judgment work (NER, duplicate detection, refine-vs-keep calls) is automated either way. The difference is whether the operator wants to see each proposed mutation before it runs. Recommendation:

- **One-tap** (`apply-queue` plain) — when ramping up or when proposal count is small (~10-30); review takes 2-5 minutes.
- **Full-auto** (`apply-queue --auto-apply high`) — for routine cron-style runs where high-confidence calls (alias merges, obvious orphan deletions, case-only variants) don't need per-item review. Medium/low-confidence items can be deferred for next-run review.

Both modes are reversible via `git revert` on the resulting commit — atomic-CLI machinery + per-mutation log entries make rollback safe.

**Cadence**: run monthly or when health-check warning counts get unwieldy.

---

*See also: `CLAUDE.md` for fix recipes when site modules misbehave; `tools/sites/MIGRATION.md` for adding a new site module; `docs/fetcher-architecture.md` for how routing works.*
