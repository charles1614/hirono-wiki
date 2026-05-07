---
created: 2026-05-08
updated: 2026-05-08
type: meta
---

# Operator workflows

End-to-end command sequences for running the wiki's fetch + ingest +
maintenance tooling. Each section: a flow diagram, the exact commands
in order, what to expect on success, and what to do when things go
sideways.

All commands assume the working directory is the repo root. Where
brevity matters the docs use `hirono raindrop ...` — the equivalent
direct invocation is `npx tsx tools/bin/hirono.ts raindrop ...`.

The single `hirono` binary is the canonical entry point for the
Raindrop fetch pipeline. Wiki ingest (`ingest_batch.ts`) and wiki
maintenance (`reindex.ts`, `build-sources-index.ts`, `lint.ts`,
etc.) live in separate top-level binaries by design — they operate
on `Sources/` / `Entities/` / `Topics/`, not on `raw/` or Raindrop
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
#    Sources/2026/<slug>.md files. The LLM uses MCP tools (Raindrop,
#    lark-hirono, WebFetch) and `hirono raindrop fetch ...` for the
#    raw-archive layer. ingest_batch tracks status across sessions:
npx tsx tools/bin/ingest_batch.ts next        # peek next pending
npx tsx tools/bin/ingest_batch.ts start <id>  # mark in-progress
# ... LLM does the work, writes Sources/2026/<slug>.md and raw/...
npx tsx tools/bin/ingest_batch.ts mark-done <id> --slug <slug>

# 6. After the batch is processed, rebuild the URL→slug index from
#    Sources/. Idempotent; safe to re-run anytime.
npx tsx tools/bin/build-sources-index.ts

# 7. Recompute reference counts + tier promotions in entity/topic
#    frontmatter; regenerate Meta/index*.md.
npx tsx tools/bin/reindex.ts

# 8. Final health report. Tells you what didn't make it through.
hirono raindrop status
```

### What to expect

After step 8 on a fresh ingest of ~580 bookmarks:

```
# Raindrop sources health (578 bookmarks)
Generated: 2026-MM-DDTHH:MM:SSZ
Clean: ~540 · Stub: ~32 · Fetch error: ~6
```

The bulk classifies as `clean`. The remaining ~38 break down into:

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
| `--check-stale` triggers HEAD storms against a host | Rate-limited or noisy upstream. Lower `--max-age` next run, or add the slug to `Meta/fetch-decisions.md` to skip. |
| `sync --retry-flagged` keeps retrying the same flagged slugs | The flag is genuinely unfixable. Diagnose with `status` (flow #3); if confirmed unrecoverable, accept-as-is via `Meta/fetch-decisions.md`. |
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
# 3. Otherwise accept the stub via Meta/fetch-decisions.md.
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
# Wait a few minutes and retry, or add to Meta/fetch-decisions.md.
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
        │       → Meta/fetch-decisions.md (skip future retries)
        └── classifier mistake
                → Meta/sources-health-overrides.md (flow #6)
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
Total hosts: 126 (578 bookmarks)
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
`Meta/sources-health-overrides.md`. The status report will use your
kind (with a 📌 marker) instead of the auto-classifier's.

### When to use overrides vs `Meta/fetch-decisions.md`

| File | Effect |
|---|---|
| `Meta/sources-health-overrides.md` | Changes the **kind** displayed in `status` reports. Doesn't suppress retries. |
| `Meta/fetch-decisions.md` | **Suppresses** future fetch attempts (`sync` skips listed slugs). Doesn't change the kind. |

You'll often use both — pin the kind to reflect reality, then accept
in fetch-decisions to stop retrying.

### Commands / file edits

```bash
# 1. See what the classifier said.
hirono raindrop status --filter content-too-short

# Suppose 2026-04-21-some-tweet shows up but you've eyeballed it and
# the body is 80 chars by design (a tweet) — not a defect.

# 2. Edit Meta/sources-health-overrides.md. Add under today's date:
$EDITOR Meta/sources-health-overrides.md
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
| `npx tsx tools/bin/build-sources-index.ts` | Rebuild `.wiki-sources-index.json` from `Sources/**.md`. |
| `npx tsx tools/bin/build-mention-map.ts` | Build the wiki-link cross-reference map. |
| `npx tsx tools/bin/reindex.ts` | Recompute frontmatter `refs:` / `tier:` / `source_count:`; promote `_seen/` entities; regenerate `Meta/index*.md`. |
| `npx tsx tools/bin/ingest_batch.ts <subcommand>` | Batch-state manager — `plan` / `next` / `start` / `mark-done` / `list`. |
| `npx tsx tools/bin/lint.ts` | Wiki-content linter. |
| `npx tsx tools/bin/find-dupes.ts` | Find duplicate slugs / wiki-link conflicts. |
| `cd tools && npm test` | Run the full regression suite (per-host snapshots, fixtures, classifier, revisions). |

### Override files

| File | Purpose |
|---|---|
| `Meta/fetch-decisions.md` | Slug-level "accept-as-is" — `sync` skips listed slugs on subsequent runs. |
| `Meta/sources-health-overrides.md` | Slug-level `pin-kind=<kind>` — overrides the auto-classifier in `status`. |

### Output files (operator-facing)

| Path | Purpose |
|---|---|
| `Sources/2026/<slug>.md` | Hand-authored ingest report for a bookmark. The canonical citation target. |
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

*See also: `CLAUDE.md` for fix recipes when site modules misbehave; `tools/sites/MIGRATION.md` for adding a new site module; `docs/fetcher-architecture.md` for how routing works.*
