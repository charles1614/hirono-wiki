---
created: 2026-05-08
updated: 2026-05-12
type: meta
---

# Post-bulk-fetch TODO

## Audit answers (2026-05-09)

**1. Was this doc up-to-date before today's audit?** — **No.** It was
written at iteration-1 against a 584-bookmark corpus and a 350/200/30
clean/stub/error split. Since then 11 of its action items have shipped
(P-32 through P-39 + several site modules + the PDF-render path), the
corpus has shrunk to 576 bookmarks (orphans pruned), the clean count
moved from 350 → 355, and the failure-kind histogram has shifted
substantially because of the new classifier rules (P-18 URL-shape
override + P-33/34 detection paths). This rewrite reflects the current
`hirono raindrop status` reading.

**2. Tool-side issues that still need fixing (ranked by leverage):**

1. **GitHub blob-path raw-fetch failure for `*.md` files in deep
   sub-paths** (2 slugs: `NVIDIA/TensorRT-LLM/.../blog9_Deploying_GPT_OSS_on_TRTLLM.md`,
   `ForceInjection/AI-fundermentals/.../DeepSeek-V3-MoE-vLLM-H20-Deployment.md`).
   The github module's blob resolver fails the raw-URL substitution
   for these specific paths even though the files exist and are
   valid markdown. Fixing would directly recover 2 clean slugs and
   probably the 3 `github-image-download-partial` slugs share the
   same root cause class.
2. **GitHub `/commit/` and `/compare/` URL shapes are not handled**
   (2 slugs: `HarborYuan/mmcv_16/commit/ad1a72f…`,
   `chen08209/FlClash/compare/main…`). Both produce `github URL parse
   failed`. Adding two URL-pattern branches to the github module
   would cover them — commit views can pull from the REST commits
   API; compare views are diff URLs that may not warrant fetch (just
   stub deliberately).
3. **Status classifier mis-pins `upstream-paywall` for a
   `pdf-rendered` openreview slug.** `openreview.net/pdf?id=sIOgOQttFQ`
   has clean content (43-page render via P-36) but the kind classifier
   maps it to `upstream-paywall`. The slug is actually clean. Likely
   a host-pattern in `failure-kind.ts` that matches all of openreview
   without considering whether content was rendered. One-rule fix.
4. **`share.google` not-yet-fetched ghost.** The cache still carries
   the share-wrapped URL for one bookmark; P-32 unwrapped it at fetch
   time so the slug exists under the linux.do URL — but the status
   join keys on `origin_url` exact match against the cache's `link`,
   so it thinks the bookmark is unfetched. Two ways to fix: (a)
   change the join to also try `unwrapShareUrl(cache.link) ===
   slug.origin_url`; (b) ask the user to edit the bookmark in
   Raindrop once and forget. (a) is the right fix because P-32 is
   meant to be transparent.
5. **`images-declared-but-none-downloaded` on `github.com/hesreallyhim/awesome-claude-code`
   and `www.v2ex.com/t/979201`.** Two distinct hosts, same surface
   symptom — markdown declares image refs, download loop yields
   zero. github case is probably the auth/rate-limit issue
   (covered by user-side GITHUB_TOKEN action below). v2ex case is
   a v2ex module image-download bug (`v2ex-image-download-partial`
   set, then no images saved → both flags fire).
6. **(Lower-leverage)** **Article-site factory browser-assist for
   lazy-loaded images (P-39 generalization).** Already covered in
   `_default`; the article-site factory is curl-only by design, so
   factory-routed hosts (blog.google, intuitionlabs, qwen, etc.)
   still save lazy-loaded thumbnails when the page uses
   intersection-observer image upgrade. No active-corpus regression
   today; this is preventive.
7. **(Lower-leverage)** **Spread `harvestServiceCard()` to other
   landing-stub modules (P-41 generalization).** Wired into
   `deepwiki-com` only. qwen-ai bare-domain, x-twitter root, future
   tool-homepage stubs would benefit. 2-line add per call site.
8. **(Lower-leverage)** **Body-direct content fallback in `_default`
   (P-37 automation).** Manual conversion proven; selector cascade
   not yet extended. Surfaces only on rare hand-rolled HTML pages
   (1cb887bb.pinit.eth.limo class).

Items 1–5 affect the live corpus today. Items 6–8 are preventive.

---

## Current corpus state (2026-05-09 status snapshot)

```
clean                          355   (350 → +5)
upstream-auth-gated            170   (171 → -1, deliberate stubs)
upstream-not-html                1   ( 13 → -12, PDF render path P-36)
upstream-fetch-failed            9   ( 12 → -3, GH+linux.do unchanged class)
upstream-spa-no-content          5   (  8 → -3)
content-too-short                4   (  6 → -2, P-18 reclassified to app-only)
content-incomplete-images        3   (  4 → -1)
content-incomplete-images-zero   2   (  3 → -1)
upstream-paywall                 4   (  3 → +1, includes 1 misclassification)
intentional-stub-app-only       17   (  3 → +14, P-18 reclassification)
not-yet-fetched                  1   (  3 → -2; remaining: 1 share.google ghost)
upstream-deleted                 5   (  2 → +3, P-34 detection)
host-malformed                   0   (  1 → -1, P-32 share-aggregator unwrap)
```

Total: 576 bookmarks. Realistic ceiling **~370 clean** unchanged
(currently 355 → +15 reachable from the items below).

The `intentional-stub-app-only` jump from 3 → 17 is **not a
regression** — P-18 (commit `b2c5f69` + `c2c4e4e`) reclassifies bare-
domain SPA shells, search-results URLs, and known-app-shape paths
out of `content-too-short` / `_default-fetch-failed` into the
deliberate-stub bucket, where they belong.

---

## 1. Done since iteration 1

Items closed by shipped commits, kept here for the audit trail.

- [x] **Add v2ex.com site module** (`tools/sites/v2ex/`) — commit `c684a3c`.
- [x] **Add `qwen.ai` content extractor for `/research`** — commit `09fb4a1`.
- [x] **Add `deepwiki.com` landing-page handler** — commit `fd118be` + service-card harvest in this session.
- [x] **L2 errors should write a stub source.json** — commit `79d727c` (P-35).
- [x] **Halt at item 163 (weixin migration banner)** — commit `20e2761`.
- [x] **Halt at item 343 (browser-open-failed, 1Password)** — operator-side, lock cleared.
- [x] **`not-yet-fetched` count cleared (3 → 1)** — P-35 wrote stubs for the 2 affected L2 slugs.
- [x] **share-aggregator URL unwrap (`share.google?link=`)** — commits `245b9ba` + `4c4a97e` (P-32).
- [x] **Anti-bot interstitial detection** (Cloudflare/Akamai/DataDome) — commits `82b2efd` + `62314cc` (P-33). Auto-resolve retry added in `f41e0c2` + `80a48a9`.
- [x] **404 / page-deleted detection** — commits `703e7b8` + `d0b4b5b` (P-34); reclassified 3 slugs from fetch-error to `upstream-deleted`.
- [x] **PDF page-rendering via mupdf** — commits `2498a87` + `1378674` (P-36); rescued 12 `upstream-not-html` slugs to `clean` with image-bearing renders.
- [x] **`gist.github.com` claimed by `site:github`** — covered by github match update.
- [x] **x-twitter authenticated browser-eval extraction** — commit `6bdffbc`.
- [x] **`feishu` stub clarity + Lark fence-hint cleanup** — covered in feishu module's misc cleanups.
- [x] **`nvidianews` widened selectors / `sohu` `.text` fallback / `linux-do` login-wall heuristic tightening** — commits `5f4391d` / `2b52132` / `3f093d0`.
- [x] **P-18 URL-pattern app-only classifier — bare-domain + search-results refinement** — commits `c2c4e4e` + `b2c5f69` (and bot-blocked sub-branch override `749dbc1`).
- [x] **Catalog/grid post-cleanups (multi-line wrappers, run-together inline links, avatar strip)** — commits `5319b91` / `85bb178` / `5834dfd` / `c730253` (P-38).
- [x] **Lazy-loaded images: scroll-trigger before extracting** — commit `941f090` (P-39).
- [x] **Multi-card blog-index aggregation** — `tools/sites/_shared/article-converter.ts` `nearestCommonAncestor` (P-40, this session).
- [x] **Service-landing stub: harvest `og:*` metadata into the body** — `tools/sites/_shared/service-card.ts` + `bodyExtra` field on `makeStub` (P-41, this session).
- [x] **`hirono raindrop check` host aggregation** — multi-tenant subdomains now collapse to one row per `site.name` (this session, `tools/hirono/raindrop/check.ts`).
- [x] **GitHub blob-path raw-fetch fuzzy-fallback** — commit `54d4c61` (P-42); recovered 2 corpus slugs (TensorRT-LLM blog09, AI-fundermentals DeepSeek MoE).
- [x] **GitHub `/commit/<sha>` and `/compare/<spec>` URL handling** — commit `edf7ede`; recovered 2 corpus slugs as `structured-summary`-flagged clean docs.
- [x] **GitHub plain-text files (`.txt`/`.csv`/`.tsv`/`.log`)** — commit `a45db43`; recovered 1 slug (waymo_val_list.txt: 0 → 13355 chars).
- [x] **openreview `pdf-rendered` mis-pinned as paywall** — commit `791db12`.
- [x] **share.google ghost (P-32 transparency test)** — commit `1438ca4` (regression test only; status code was already correct).
- [x] **v2ex imgur-via-Wayback rescue** — commit `a4c7248` (P-43); recovered 1 slug (v2ex/979201).
- [x] **`harvestServiceCard` spread to `_default` + `qwen-ai` stubs** — commit `b8d456c`; enriches stub bodies with og:* descriptions.
- [x] **Marker-flag classifier fix** — commit `d2ec8ed`; `_default-used-browser-fallback`-only slugs no longer mis-classify as app-only (16 slugs reclassified, +5 to clean net).
- [x] **`hirono raindrop sync --exclude-host` flag** — commit `575115e` (preventive infra for future bulk fetches when Charles's Chrome auth has expired for specific hosts).
- [x] **Downgrade protection in `fetchUrlAndStore`** — shipped as `isFetchRegression()` in `tools/fetch-raw.ts:823` + append-only revisioning (`content-rev<N>.md` instead of overwrite) in `writeRawArchive`. When the previous rev had real content (no stub flag, length > 0) and the new rev is a stub OR <30% of the previous length, the new write is rejected and the previous content is preserved. Covers the original wangzhiyu/zenfeed/51cto oscillation cases plus general browser-non-determinism.

---

## 2. Tool-side issues — pending (ranked by leverage)

Surface in CLAUDE.md §4 fix recipes when implemented.

- [ ] **(Low)** **Orphan-slug pruning needs an unwrap-aware CLI command.**
  The current orphan list (slugs in `raw/raindrop/<host>/<slug>/` but
  not in `.wiki-raindrop-cache.json`) is computable inline but
  one-off-script-only. Both prior orphan-deletion rounds in this
  session were done via inline Python that didn't always handle the
  share-aggregator unwrap correctly (caused us to delete the
  share.google → linux.do slug once, then re-fetch it). A
  `hirono raindrop orphans [--prune] [--dry-run]` subcommand using
  the same unwrap-aware logic from `status.ts` would close the gap.

  Currently 9 orphans surface in the status report (correctly tagged
  `[orphan: bookmark deleted from Raindrop]`); they don't hurt anything
  but clutter the report. Charles can `rm -rf` them by hand or wait
  for this CLI.

- [ ] **(Medium-low, preventive)** **Article-site factory
  browser-assist for lazy-loaded images (P-39 generalization).** The
  factory in `tools/sites/_shared/article-site-factory.ts` is
  curl-only; intersection-observer-driven lazy loading on
  factory-routed hosts saves placeholder URLs. Add an opt-in flag to
  the factory that uses opencli browser-eval (with the P-39 scroll
  routine) to harvest post-scroll `<img src>` URLs, then feeds those
  URLs to the existing curl-based image-download phase. No
  active-corpus regression today (we already cover blog.google in
  `_default`'s browser path), but blog-shape hosts that DO route
  through the factory would benefit. See P-39 in
  `00_Meta/site-handling-patterns.md`. **Survey 2026-05-09:** all
  candidates examined have either (a) curl-only resolution working
  fine or (b) intentionally-tiny images (CSDN math equations).
  Defer until a real factory-routed slug surfaces with low-res content.

- [ ] **(Medium-low, preventive)** **Spread `harvestServiceCard()` to
  remaining stub-emitters.** Wired into `deepwiki-com`, `_default`'s
  `stubResult`, and `qwen-ai`'s catch-all stub (commits `6e8ddef` +
  `b8d456c`). Could still apply to:
  - `feishu` tenant landings — currently emits "no read access" stubs
    without service-card; tenant homepage `<head>` may have useful
    description.
  - Future tool-homepage stubs as new modules are added.

  x-twitter intentionally skipped (status URL og:* metadata is generic
  "Login to X" boilerplate, not a service description).

- [ ] **(Low, preventive)** **Body-direct content fallback in
  `_default` (P-37 automation).** Some single-purpose JS tools,
  IPFS-hosted SPAs, and hand-rolled HTML pages put content directly
  under `<body>` with no `<article>`/`<main>`/`.prose` wrapper.
  `_default`'s body-selector cascade misses them and the slug stubs
  at < 200 chars. Manual conversion proven on
  `1cb887bb.pinit.eth.limo` (sample at
  `sweep-results/1cb887bb.pinit.eth.limo/sample-converted.md`).
  Automation: extend `tools/sites/_default/index.ts` `SELECTORS.bodySelectors`
  cascade with `<body>` as a final fallback, fire only when no
  narrower selector matched AND text-after-(`<style>`/`<script>`
  /`<noscript>`)-strip exceeds ~300 chars. See P-37 for the full
  pattern + per-element turndown rules.

---

## 3. User-side actions (require credentials / network access)

- [ ] **Set `GITHUB_TOKEN` and re-fetch GitHub failures** (5 of 9
  `upstream-fetch-failed` are github.com — anonymous rate-limit at
  60/hr. 2 of those 5 ARE the `*.md` blob path issue above and
  won't fix from a token alone; the other 3 should clear).
  ```bash
  export GITHUB_TOKEN=ghp_...        # personal access token, repo:read scope
  npx tsx tools/bin/hirono.ts raindrop sync --retry-kind upstream-fetch-failed
  ```
  Also retries the 3 `content-incomplete-images` slugs on github.com
  (image-host 403s without auth).
  Expected: +3 to clean from rate-limit class; +3 image
  partials → clean if image fetch also retries.

- [ ] **Re-auth linux.do in opencli-connected Chrome** (4 of 9
  `upstream-fetch-failed` are linux.do). Open `https://linux.do` in
  the Chrome instance opencli is bound to, sign in, then:
  ```bash
  npx tsx tools/bin/hirono.ts raindrop sync --retry-kind upstream-fetch-failed
  ```
  Expected: +3–4 to clean.

- [ ] **Eyeball and pin `content-too-short` slugs** (3 items, was 6
  — P-18 + P-34 absorbed 2; atopx pinned `clean` in commit `b1d187d`).
  For each, open the URL; if the body really is short by design, pin
  via `00_Meta/sources-health-overrides.md`. Remaining URLs to review:
  - `https://www.zhihu.com/question/1918276517865157261/answer/1918748704971678665`
    — short-body answer (eyeball; could be deleted answer or genuinely
    brief).
  - `http://xhslink.com/o/5vB4REfU35P`,
    `http://xhslink.com/o/64v2878MWih` — xhs notes that didn't get
    the auth-gated stub (eyeball; pin as `clean` or
    `upstream-auth-gated`).

- [ ] **xhs `text-body-unavailable` manual fixes** — 167 slugs you
  flagged for manual archiving from your xhs auth session. List at
  `sweep-results/xhs-text-body-unavailable.{md,tsv}`. For each, paste
  the body into `content.md`, update `source.json` (clear
  `intentional-stub`/`xhs-text-body-unavailable` flags, set
  `quality_status: good`, bump `content_length`).

- [ ] **Decide on the 3 `upstream-spa-no-content` real-content slugs**
  with curl-failure (HTTP 000) from this network:
  `https://www.substratus.ai/blog/kind-with-gpus`,
  `https://yecnay.org/posts/tech/iterm2快捷键小记/`,
  `https://yuyang.info/Course-Notes/`. The latter two resolve via DNS
  but the response is `198.18.x.x` (carrier-grade NAT range) —
  network-level interception. The first responds 000 entirely.
  All three would need to be fetched from a different network. Other
  slugs in this kind are orphans (bookmarks already deleted). Either
  accept the stub or look for an archive.org snapshot.

- [ ] **(One-time backfill)** **Sources health overrides for
  remaining deliberate-but-not-flagged stubs.** A few slugs (e.g.
  `apxml.com/zh/tools/vram-calculator`, hjfy.top) are now correctly
  classified by P-18 and don't need a manual override. Anything still
  showing up under `content-too-short` or `intentional-stub-app-only`
  that's actually a deliberate skip can go into
  `00_Meta/sources-health-overrides.md` with a one-line `pin-kind=` entry.

---

## 4. Post-fetch downstream work

The fetch pipeline produces the **raw archive** (`raw/raindrop/<host>/<slug>/`).
Building the **wiki itself** (`03_Sources/<year>/<slug>.md` summaries +
`02_Entities/` + `01_Topics/`) is downstream work that wasn't part of this
session. Unchanged from iteration 1.

- [ ] **Identify which raw slugs are worth summarizing.** The 355
  clean slugs are the candidate pool. Prioritize by Raindrop
  `collection_id` / `tags` (queryable via `raw/raindrop/_index.json`).
- [ ] **Run the LLM ingest loop** for the chosen slugs:
  ```bash
  npx tsx tools/bin/ingest_batch.ts plan <input.json>
  npx tsx tools/bin/ingest_batch.ts next       # peek next pending
  npx tsx tools/bin/ingest_batch.ts start <id> # mark in-progress
  # ... write 03_Sources/2026/<slug>.md
  npx tsx tools/bin/ingest_batch.ts mark-done <id> --slug <slug>
  ```
- [ ] **Rebuild the URL→slug index** after the batch:
  ```bash
  npx tsx tools/bin/build-sources-index.ts
  ```
- [ ] **Recompute reference counts and tier promotions:**
  ```bash
  npx tsx tools/bin/reindex.ts
  ```
- [ ] **Final lint pass** to catch raw-orphan / dead-wikilink / tier-mismatch:
  ```bash
  npx tsx tools/bin/lint.ts
  ```

---

## 5. Local commits — remote setup

`git remote -v` is empty. Many session commits (P-32 through P-41 +
the older session) — all unreviewed except by you.

- [ ] **Add a remote** before pushing.
  ```bash
  git remote add origin <url>
  git push -u origin master
  ```
- [ ] **Consider tagging** a stable point: `git tag -a v2026.05-bulk-fetch
  -m "576-bookmark bulk fetch + 355 clean baseline"`.

---

## 6. Health-check schedule

Per `00_Meta/operator-workflows.md` §7. Schedule when ready for
steady-state operations.

- [ ] **Daily** (manual or cron): `hirono raindrop refresh-cache`.
  New singletons surface in `hirono raindrop check`.
- [ ] **Weekly**: `hirono raindrop sync --check-stale --max-age 30d`
  — head-checks every good slug older than 30 days; auto-escalates
  to refetch on etag/last-modified change.
- [ ] **Weekly**: `hirono raindrop status --md --out
  sweep-results/_health/$(date -u +%Y%m%dT%H%M%SZ).md` — capture a
  snapshot. Diff against the previous to spot regressions.
- [ ] **Monthly**: `hirono raindrop check --update-graduation-snapshot`
  — bake new host counts into `tools/opencli/host-counts.json`.
  Hosts that crossed `count==1 → count>=2` become candidates for
  dedicated site modules (CLAUDE.md §5a). **Note (2026-05-09):** the
  check command now collapses multi-tenant subdomains to a single row
  per `site.name`, so `*.feishu.cn`, `*.zhihu.com`, etc. no longer
  spam the singleton list.
- [ ] **Ad-hoc** (when adding bookmarks for a new host):
  ```bash
  hirono raindrop refresh-cache
  hirono raindrop check                # any new singletons?
  hirono raindrop status               # graduation candidates surfaced in footer
  ```
  If a new host appears in `_default`-routed graduation candidates
  with `stub/error` count > 0 and you bookmark from it regularly,
  build a dedicated `tools/sites/<host>/` module.

---

## Final-state targets

Updated against current **369 clean** baseline (was 355 → +14 from
all §1 fixes shipped in this audit cycle: github blob-fuzzy,
github commit/compare, openreview reclassify, share.google
transparency test, v2ex Wayback, plain-text github, marker-flag fix,
zenfeed/wangzhiyu manual recovery):

- After §2 (remaining tool-side fixes): **~370 clean** (+1; the
  remaining items are preventive — body-direct fallback has zero
  active candidates, factory browser-assist has no current
  regression, downgrade-protection prevents future loss but
  doesn't recover the 51cto slug now stuck at the smaller body).
- After §3 (user-side: `GITHUB_TOKEN`, linux.do re-auth, xhs manual
  paste, content-too-short pinning): **~380+ clean** (+10–15 from
  current 369; biggest single lever is the 167 xhs manual fixes if
  you commit the time).
- After §4 (Sources summaries): wiki is browsable, reference counts
  populate.
- After §5 (push): commits durable beyond this machine.
- After §6 (schedule): pipeline is steady-state.
