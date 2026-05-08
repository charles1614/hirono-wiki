---
created: 2026-05-08
updated: 2026-05-08
type: meta
---

# Post-bulk-fetch TODO

Concrete actionable list for closing out the May 2026 bulk-fetch
session. Current state (584 bookmarks → 579 after LAN-IP cleanup):

```
clean                          350
upstream-auth-gated            171   ← deliberate stubs (xhs/feishu/x.com)
upstream-not-html               13   ← deliberate stubs (PDFs / app-store)
upstream-fetch-failed           12   ← real, fixable
upstream-spa-no-content          8   ← mixed: dead URLs, real SPAs, apps
content-too-short                6   ← eyeball + pin
content-incomplete-images        4   ← partial image-host fail
content-incomplete-images-zero   3   ← image servers persistently 403
upstream-paywall                 3   ← deliberate
intentional-stub-app-only        3   ← deliberate
not-yet-fetched                  3   ← L2 errors don't write source.json
upstream-deleted                 2   ← deliberate
host-malformed                   1   ← edit URL in Raindrop
```

**Realistic ceiling: ~365–370 clean** with the actions below
(currently 350 → +15–20 reachable).

---

## 1. Bulk fetch state — already complete, no resume needed

The two L3 halts during the original session were both resolved:

- [x] Halt at item 163 (weixin migration banner) — resolved by commit `20e2761` (added `weixin-account-migrated` soft-stub detection); resume rounds 2 + 3 completed cleanly.
- [x] Halt at item 343 (`browser-open-failed`, 1Password interference) — resolved by clearing the lock + re-running.

The 3 remaining `not-yet-fetched` slugs are NOT a "resume" issue —
they're L2 errors that bypass `writeRawArchive` and never produce
a source.json. See item 5.5 below for the code fix.

---

## 2. Tool-side issues (code work needed)

- [x] **Add v2ex.com site module** (`tools/sites/v2ex/`) — done in commit `c684a3c`.
- [x] **Add `qwen.ai` content extractor for `/research`** — done in commit `09fb4a1`.
- [x] **Add `deepwiki.com` landing-page handler** — done in commit `fd118be`.
- [x] **L2 errors should write a stub source.json** — done in commit `79d727c` (P-35).
- [ ] **Investigate `images-declared-but-none-downloaded` on stackoverflow.com + open-vsx.org + 1 github** (3 slugs in `content-incomplete-images-zero`). `_default` adapter emits image refs (Next.js `<Image>` srcsets?) but the download loop yields zero. Likely a relative-URL resolution bug or a CDN that 403s our user-agent; reproduce with `HIRONO_FETCH_DEBUG=1 npx tsx tools/bin/hirono.ts raindrop refetch <slug>`.
- [ ] **Body-direct content fallback in `_default` (P-37 automation).** Some single-purpose JS tools, IPFS-hosted SPAs, and hand-rolled HTML pages put content directly under `<body>` with no `<article>`/`<main>`/`.prose` wrapper. `_default`'s body-selector cascade misses them and the slug stubs at < 200 chars. Manual conversion proven on `1cb887bb.pinit.eth.limo` (sample at `sweep-results/1cb887bb.pinit.eth.limo/sample-converted.md`). Automation: extend `tools/sites/_default/index.ts` BODY_SELECTORS cascade with `<body>` as a final fallback, fire only when no narrower selector matched AND text-after-(`<style>`/`<script>`/`<noscript>`)-strip exceeds ~300 chars. See P-37 in `Meta/site-handling-patterns.md` for the full pattern + per-element turndown rules used in the manual conversion.

---

## 3. User-side actions (require credentials / network access)

- [ ] **Set `GITHUB_TOKEN` and re-fetch GitHub failures** (5 of the 12 `upstream-fetch-failed` are github.com — anonymous rate-limit at 60/hr).
  ```bash
  export GITHUB_TOKEN=ghp_...        # personal access token, repo:read scope
  npx tsx tools/bin/hirono.ts raindrop sync --retry-kind upstream-fetch-failed
  ```
  Expected: +5 to clean. Also retries the 3 `content-incomplete-images` on github.com (image-host 403s without auth).
- [ ] **Re-auth linux.do in opencli-connected Chrome** (4 of the 12 `upstream-fetch-failed` are linux.do). Open `https://linux.do` in the Chrome instance opencli is bound to, sign in, then:
  ```bash
  npx tsx tools/bin/hirono.ts raindrop sync --retry-kind upstream-fetch-failed
  ```
  Expected: +3–4 to clean.
- [ ] **Eyeball and pin `content-too-short` slugs** (6 items). For each, open the URL; if the body really is short by design (paywall, tweet-shape, single-link share), pin as `clean` via `Meta/sources-health-overrides.md`. URLs to review:
  - `https://github.com/atopx/linux-wps` — small repo readme (almost certainly genuinely short → pin clean)
  - `https://apxml.com/zh/tools/vram-calculator` — calculator UI (pin as `intentional-stub-app-only`)
  - `https://hjfy.top/` — homepage; eyeball
  - `https://mapp.api.weibo.cn/fx/b75d28719f602f64aac7d7a818a3e7dc.html` — Weibo deep-link (likely deleted; pin as `upstream-deleted`)
  - `http://xhslink.com/o/5vB4REfU35P`, `http://xhslink.com/o/64v2878MWih` — xhs notes that didn't get the auth-gated stub (eyeball; pin as `clean` if body looks reasonable)
- [ ] **Fix the 1 malformed URL in Raindrop**:
  - `https://share.google?link=https://linux.do/t/topic/537374&utm_campaign=...` — that's a Google share-redirect with the real linux.do URL embedded. Edit the bookmark in Raindrop to point directly at `https://linux.do/t/topic/537374`, then `hirono raindrop refresh-cache`.
- [ ] **Decide on the 2 `upstream-spa-no-content` dead-domain slugs** (substratus.ai, yecnay.org). Both domains return no HTTP response — content is gone. Either:
  - Accept the stub (no action), or
  - Look for an archive.org snapshot and write a Sources summary by hand against that.

---

## 4. Post-fetch downstream work

The fetch pipeline produces the **raw archive** (`raw/raindrop/<host>/<slug>/`). Building the **wiki itself** (`Sources/<year>/<slug>.md` summaries + `Entities/` + `Topics/`) is downstream work that wasn't part of this session.

- [ ] **Identify which raw slugs are worth summarizing**. The 350 clean slugs are the candidate pool. Prioritize by Raindrop `collection_id` / `tags` (queryable via `raw/raindrop/_index.json`).
- [ ] **Run the LLM ingest loop** for the chosen slugs:
  ```bash
  npx tsx tools/bin/ingest_batch.ts plan <input.json>
  npx tsx tools/bin/ingest_batch.ts next       # peek next pending
  npx tsx tools/bin/ingest_batch.ts start <id> # mark in-progress
  # ... write Sources/2026/<slug>.md
  npx tsx tools/bin/ingest_batch.ts mark-done <id> --slug <slug>
  ```
- [ ] **Rebuild the URL→slug index** after the batch:
  ```bash
  npx tsx tools/bin/build-sources-index.ts
  ```
- [ ] **Recompute reference counts and tier promotions**:
  ```bash
  npx tsx tools/bin/reindex.ts
  ```
- [ ] **Final lint pass** to catch raw-orphan / dead-wikilink / tier-mismatch issues:
  ```bash
  npx tsx tools/bin/lint.ts
  ```

---

## 5. Local commits (30 ahead of nothing — no remote configured)

`git remote -v` is empty. The 30 commits this session built up significant infrastructure:

- `9b2bec6` URL-pattern heuristic for `intentional-stub-app-only`
- `c6e4ba2` arxiv-pdf classifier rule
- `1cf3c89` preserve `intentional-stub` flag + xhs auth-gate classifier
- `20e2761` weixin migration banner soft-stub
- `a91d6bf` raw/raindrop/<host>/<slug>/ layout restructure + `_index.json`
- `03eb786` operator-workflows §5 wired to new check + status surfaces
- `aa5aaf1` host coverage overview footer in `status`
- `af28855` raindrop check — new singleton hosts surface
- `3f093d0` linux-do login-wall heuristic tightening
- `7547431` _default PDF / non-html short-circuit
- `2b52132` sohu .text fallback selector
- `5f4391d` nvidianews wider selector cascade
- `7c3530d` `error_detail` propagation across all stub modules
- `75a1937` removed deprecated `fetch-raw` CLI
- `ed001c1` consolidated raindrop pipeline under `hirono raindrop`
- `eec7265` per-slug revisions.jsonl + history/diff CLIs
- `ff1dd90` incremental sync — retry-by-kind, --check-stale
- `acd07b3` raindrop status — structured failure log
- `6bdffbc` x-twitter authenticated browser-eval extraction
- … (11 more session commits + earlier session)

- [ ] **Add a remote** (origin or otherwise) before pushing. Decide: GitHub, internal git server, or self-hosted. None of these commits have been reviewed by anyone else — push when ready.
  ```bash
  git remote add origin <url>
  git push -u origin master
  ```
- [ ] **Consider tagging this state**: `git tag -a v2026.05-bulk-fetch -m "584-bookmark bulk fetch + 350 clean baseline"` so the post-fetch state is easy to refer back to.

---

## 6. Health-check schedule

Per `Meta/operator-workflows.md` §7. None of these need to be set up
right now — schedule when you're ready for steady-state operations.

- [ ] **Daily** (manual or cron): `hirono raindrop refresh-cache` — pulls new bookmarks. New singletons surface in `hirono raindrop check`.
- [ ] **Weekly**: `hirono raindrop sync --check-stale --max-age 30d` — head-checks every good slug older than 30 days; auto-escalates to refetch on etag/last-modified change.
- [ ] **Weekly**: `hirono raindrop status --md --out sweep-results/_health/$(date -u +%Y%m%dT%H%M%SZ).md` — capture a snapshot. Diff against the previous to spot regressions.
- [ ] **Monthly**: `hirono raindrop check --update-graduation-snapshot` — bake new host counts into `tools/opencli/host-counts.json`. Hosts that crossed `count==1 → count>=2` become candidates for dedicated site modules (see CLAUDE.md §5a).
- [ ] **Ad-hoc** (when adding bookmarks for a new host):
  ```bash
  hirono raindrop refresh-cache
  hirono raindrop check                # any new singletons?
  hirono raindrop status               # graduation candidates surfaced in footer
  ```
  If a new host appears in `_default`-routed graduation candidates with `stub/error` count > 0 and you bookmark from it regularly, build a dedicated `tools/sites/<host>/` module.

---

## Final-state targets

- After items 2 + 3: **~370 clean** (+20 from current 350)
- After item 4 (Sources summaries): wiki is browsable, reference counts populate
- After item 5 (push): commits durable beyond this machine
- After item 6 (schedule): pipeline is steady-state
