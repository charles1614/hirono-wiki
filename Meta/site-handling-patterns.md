---
created: 2026-05-08
updated: 2026-05-08
type: meta
---

# Site-handling patterns

A persistent, LLM-friendly reference for fixing sub-good fetches.
Bootstrapped from the dedicated site modules under
`tools/sites/<host>/`, the `_default` catchall, and the cross-cutting
cleanups in `tools/sites/_shared/post-cleanup.ts`.

**How to use this file**: when `hirono raindrop status` flags a host
or a single bookmark looks wrong:

1. **§1 Quick-lookup** — match the symptom you observe to a likely
   cause + the pattern entries that apply.
2. **§2 Patterns by failure mode** — read the matching pattern's
   *Symptom / Root cause / Remediation / Generalization / Reference*.
3. **§3 Patterns by remediation technique** — when you've decided
   the answer is "use browser-eval" or "find an API", browse the
   reference implementations grouped by approach.
4. **§4 Decision tree** — apply to a brand-new URL with no prior
   knowledge.
5. **§5 Cross-cutting cleanups** — what already runs everywhere; do
   NOT reinvent.

After each fix, append a new pattern (or refine an existing one) to
this file. Each iteration grows the institutional memory.

---

## §1 Quick-lookup table — symptom → cause → patterns

| Symptom (what you see in status / sample MD) | Likely cause | See patterns |
|---|---|---|
| `intentional-stub` + `_default-fetch-failed`; `<title>` has site name only; body is `<noscript>` boilerplate | JS-rendered SPA (React/Next/Vue) hydrates client-side | P-01 SPA-hydration, P-02 browser-eval-fallback |
| Body contains "Sign in" / "Log in" / "Subscribe to read" copy | Auth-walled content; UA reaches public shell only | P-03 auth-walled-content, P-04 browser-session-via-opencli |
| `intentional-stub` + `feishu-auth-gated` / `feishu-deleted` | Lark API returned 403/404 from bot identity | P-05 feishu-multi-tenant |
| Title is right but body is empty/`Loading…` even though SPA fallback fired | Hydration race (browser eval too eager) | P-06 hydration-delay |
| Tables present in HTML but body shows pipe-delimited noise / single column | Adapter flattened `<table>` cells to text via `.textContent` | P-07 dom-walker-table-extraction |
| Code blocks present but rendered without language tags / collapsed to one line | Adapter used `.textContent` on `<pre>`, dropped `<br>`/`<code>` siblings | P-08 textWithLineBreaks |
| `**bold**` runs of 5+ asterisks (`*****`) in body | Adjacent `<strong>` siblings collapsed by turndown | P-09 strong-merge |
| Headings duplicated as `## **Title**` | `<h2><strong>` self-nesting in upstream HTML | P-10 strip-bold-in-headings |
| Tail of body is "Subscribe to..." / "Read more" / tag chain | Footer chrome bleed-through | P-11 footer-chrome-strip, P-12 dropSelectors |
| Inline SVG icons appearing as character-per-line text | Turndown flattened `<svg><text>` children | P-13 dropSelectors-svg |
| `[](#header)` empty anchor links scattered in body | Sphinx/RTD `<a class="headerlink">` permalinks | P-14 headerlink-strip |
| Body is fine but every image is a `https://` ref (broken locally) | adapter didn't run image-localizer | P-15 image-localization |
| Images declared in MD but `images-declared-but-none-downloaded` flag | CDN 403'd our user-agent OR images are lazy-loaded with `data-original=` | P-16 image-fetcher-headers, P-17 lazy-image-attrs |
| Body is mostly inline `<style>`/`<script>` with no semantic text | Genuine interactive web app (calculator, dashboard) | P-18 url-pattern-app-only-classifier |
| URL is `*.eth.limo`, `*.ipns.dweb.link`, hash-subdomain | Decentralized hosting; URL hash IS the content key | P-19 ipfs-gateway-stub |
| URL ends in `.pdf` / Content-Type is `application/pdf` | PDF, not HTML | P-20 pdf-detect-short-circuit |
| Body is < 200 chars after both curl + browser-eval | Genuinely empty (deleted, redirected to home, real stub) | P-21 stub-threshold |
| URL claims to be one host but redirects to another (xhslink → xiaohongshu, share.google → linux.do) | Shortlink / share-redirect | P-22 shortlink-resolution |
| GitHub `/blob/`, `/tree/`, `/issues/`, `/pull/`, `/discussions/`, `/releases/tag/` | Structured data lives in REST API + raw.githubusercontent.com | P-23 use-the-api |
| Discourse forum (linux.do, etc.) | `<topic-url>.json` returns the full topic + post stream | P-24 discourse-json-api |
| HuggingFace `/blog/<slug>` | Raw markdown mirrored at `github.com/huggingface/blog` | P-25 raw-mirror-source |
| Page is a data viz with a "Download CSV" link | Real data is in the CSV; UI is just controls | P-26 csv-source-substitution |
| Cloudflare 403 / "Just a moment..." / mod_security blocks | UA gating; default `curl` UA looks bot-like | P-27 chrome-ua-headers |
| Body is right but quad-asterisk runs and emoji `:shortcodes:` got escaped | Markdown serializer over-escaped | P-28 cross-cutting-cleanups |
| Body is right but two `# H1`s present | Page title block + body title; turndown emitted both | P-29 enforceSingleH1 |
| `wiki.litenext.digital` mermaid diagrams render as orphan node-label paragraphs outside ` ```mermaid ` fences | Adapter flattened SVG-rendered diagram; source lives in DOM `data-original-text` attr or hydration script | P-30 deepwiki-mermaid-splice |
| Hexo / WordPress / Sphinx site looks like one of the article-shape sites | Article-site factory pattern; <30 LOC config | P-31 article-site-factory |
| Bookmark URL is on a `share.*` / `out.*` / `redirect.*` host with `?link=…` / `?url=…` query param holding the real target | Share-aggregator wrapper that doesn't redirect (interstitial only) | P-32 share-aggregator-unwrap |
| Body title is `Just a moment...` / `Attention Required! Cloudflare` / `52N: <error>`; body says "Performing security verification" / "Checking your browser" | Cloudflare / Akamai / DataDome / PerimeterX challenge or CF origin-error interstitial extracted as if it were content | P-33 anti-bot-challenge-detect |

---

## §2 Patterns by failure mode

Each pattern: **Symptom · Root cause · Remediation · Generalization · Reference**.

### P-01 — SPA hydration: page is a JS shell on plain curl

**Symptom.** Plain `curl` returns `<title>SiteName</title>` + `<noscript>You need JavaScript to view this site.</noscript>` + 80-200KB of `<script>` tags, no semantic body content.

**Root cause.** Next.js / React / Vue / SvelteKit page renders client-side. The static HTML has no article body; it lives in JS state hydrated after page load.

**Remediation.** Two-stage hybrid in `_default`:

1. Try plain curl + body-selector cascade.
2. If body length < 500 chars after extraction, fall back to opencli browser-eval (open URL, wait for hydration, extract `outerHTML`).
3. If browser path also yields < 200 chars, emit `intentional-stub` + `_default-fetch-failed` flags.

**Generalization.** This is the standard answer for any SPA whose static HTML is empty. Don't write a per-host module unless the site needs more than vanilla browser-eval can give. The hybrid in `_default/index.ts` already handles ~80% of long-tail SPAs.

**Reference.** `tools/sites/_default/index.ts` — the curl-then-browser-eval cascade. `tools/sites/_default/fetcher.ts` for the hydration-wait choreography.

---

### P-02 — Browser-eval fallback (the catchall's escape hatch)

**Symptom.** `_default-fetch-failed` + body length < 500 chars after curl path.

**Root cause.** Either an SPA (P-01) or a non-trivial client-side render (auth-driven, location-driven, A/B-tested).

**Remediation.** `_default` opens the URL in opencli's browser, waits 3-4s for hydration, then evals `document.querySelector('article, main, [role=main], .prose, .post-content').outerHTML` (cascade) and feeds the result through the same `convertArticle` pipeline so output style matches curl-path output.

**Generalization.** Any time the static HTML doesn't have what the rendered page would. Pay attention to the wait time — too short = empty body race, too long = wasted budget per fetch. 3-4s is the proven default; bump to 6-8s only for known-slow hydrators.

**Reference.** `tools/sites/_default/fetcher.ts` (`hybridFetch` function). `tools/sites/qwen-ai/index.ts` follows the same pattern with a 3s explicit delay.

---

### P-03 — Auth-walled content (login required to render)

**Symptom.** Body contains "Sign in to X" / "请登录" / "Sign up to read"; sometimes a CAPTCHA mention; or the body is the public-facing landing-page content of a deeper article URL.

**Root cause.** Site enforces authenticated rendering for the article body (X.com, xhs notes, some feishu wikis, paid Substacks). The bot/UA-only request returns the public shell.

**Remediation.** Three options in priority order:

1. **Browser-session-via-opencli** (P-04): the operator's logged-in Chrome cookies are reused. Works for x.com, xhs, feishu (with Lark cookies), private GitHub repos.
2. **Stub by design**: if the site is fundamentally login-walled (commercial product like a newsletter), emit a stub + the appropriate `intentional-stub` companion flag. The stub IS the deliberate output; the failure-kind classifier maps these to `upstream-auth-gated`.
3. **Find an API path** (P-23) that doesn't need auth (rare).

**Generalization.** "Auth-walled" is not a single failure mode — distinguish:
- Auth REQUIRED for body: stub or browser-session.
- Auth NICE-TO-HAVE: try browser-session, accept the public-shell content otherwise.
- Auth IS the content (xhs note pages): emit an image-only stub with `<host>-text-body-unavailable` flag. That stub IS the intentional output.

**Reference.** `tools/sites/x-twitter/` (full browser-session extraction). `tools/sites/xhs/index.ts` (image-only stub pattern). `tools/sites/feishu/` (lark-cli subprocess pattern).

---

### P-04 — Browser-session-via-opencli (logged-in cookies)

**Symptom.** Need to render content as a logged-in user.

**Remediation.** opencli's Chrome extension forwards the operator's logged-in browser session. The site module:

1. Calls `runOpencli(["browser", "open", url])` — page renders with logged-in cookies.
2. `sleepMs(3000-4000)` — hydration buffer.
3. `runOpencli(["browser", "eval", "<extraction script>"])` — pulls structured data via JS evaluation.
4. `closeBrowser()` in `finally` — releases the machine-wide opencli lock.

**Generalization.** Use this when (a) the site requires auth AND (b) the operator can plausibly maintain a logged-in session in the bound Chrome. Document the auth-setup requirement in the module's README/header (e.g. "operator must be signed into mp.weixin.qq.com via app-scan QR code").

**Reference.** `tools/sites/_shared/browser-helpers.ts` — `runOpencli`, `closeBrowser`, `browserTimeoutMs`. Reference modules: weixin, xhs, zhihu, x-twitter, reddit. All follow the open → sleep → eval → close pattern.

---

### P-05 — Feishu multi-tenant + lark-cli subprocess

**Symptom.** `intentional-stub` + `feishu-auth-gated` or `feishu-user-auth-required` or `feishu-deleted`.

**Root cause.** Feishu (Lark) is multi-tenant; the wiki at `<tenant>.feishu.cn/wiki/<wiki-id>` may not be accessible to your bot identity even with the Lark app's enterprise scopes. Three failure subtypes:
- bot has no access to foreign tenant → `feishu-auth-gated`
- doc requires user identity (not bot) → `feishu-user-auth-required`
- doc was deleted upstream → `feishu-deleted`

**Remediation.** `tools/sites/feishu/` runs `lark-hirono fetch --doc <wiki-id> --output <tmp>` as a subprocess. Tries user identity (--as user) first, falls back to bot identity (--as bot) automatically. On any failure, emits a stub with the right companion flag.

**Generalization.** The pattern is: shell out to a CLI that knows how to handle the auth flow + parse the structured response. Useful when the upstream provides an SDK/CLI that handles auth + rate-limit + retries better than your own code would.

**Reference.** `tools/sites/feishu/fetcher.ts`. The lark-cli is installed and authenticated separately by the operator.

---

### P-06 — Hydration race: browser-eval too eager

**Symptom.** Body is `Loading…` / `加载中` / `Please wait`. The browser-eval ran but caught the page mid-hydration.

**Root cause.** The 3-4s wait is calibrated for typical SPAs; some hydrate slower (large bundle, network-bound, deferred-import-heavy).

**Remediation.** Bump the wait inside the site module. `tools/sites/nvidianews/` learned this — initial 2.5s caught the loading state; 4s catches the hydrated body. The hirono module API exposes `HIRONO_BROWSER_OPEN_TIMEOUT_MS` and `HIRONO_BROWSER_EVAL_TIMEOUT_MS` env overrides for ad-hoc tuning.

**Generalization.** When you see a `Loading…` body, your first guess should be "wait time too short", not "selector wrong". Eyeball the rendered page in the bound Chrome to confirm.

**Reference.** `tools/sites/nvidianews/fetcher.ts` (sleep bumped 2500ms→4000ms). `tools/sites/_shared/browser-helpers.ts` for the env-var override mechanism.

---

### P-07 — DOM-walker for table extraction (don't trust .textContent)

**Symptom.** Tables in source HTML produce single-column or pipe-noisy markdown. Sometimes whole rows lost.

**Root cause.** `<table>` cells often contain `<div>` / `<br>` / nested block elements. `Element.textContent` collapses all of these to whitespace, dropping line breaks. Turndown's table plugin then sees a flat stream and produces bad output.

**Remediation.** Custom DOM walker that emits `\n` for `<br>` and between block siblings inside cells. See `textWithLineBreaks(el)` in `tools/sites/weixin/raw-html-converter.ts`.

**Generalization.** Whenever a fetcher needs to preserve line breaks inside HTML chunks (tables, code blocks, blockquotes with inline `<br>`), prefer a recursive walker over `.textContent`. Turndown's pre-plugins also need this.

**Reference.** `tools/sites/weixin/raw-html-converter.ts` — `textWithLineBreaks` function. CLAUDE.md §4 weixin recipe.

---

### P-08 — `textWithLineBreaks` for code blocks (multi-`<code>` shapes)

**Symptom.** Multi-line code block flattens to one line, losing every newline.

**Root cause.** Three different shapes upstream serializers emit:
- A: single `<pre><code>` with text (easy, default works)
- B: `<pre>` with multiple `<code>` siblings, one per line (mdnice, weixin)
- C: `<pre>` with `<br>`-separated text content (older serializers)

`Node.textContent` strips `<br>` and joins siblings without newlines.

**Remediation.** Branch on `<code>`-child count:
- ≥ 2 `<code>` children → join their `.textContent` with `\n`. **Ignore** `data-lang=` (mdnice mis-tags YAML/bash as `sql`).
- 1 `<code>` child → `.textContent` + lang from `<code class="language-X">`.
- 0 `<code>` children (bare `<pre>`) → walk-with-breaks.

**Generalization.** When you see code blocks rendering as one line, suspect multi-`<code>` shape. Always use a walker for `<pre>` content.

**Reference.** `tools/sites/weixin/raw-html-converter.ts`.

---

### P-09 — Adjacent `<strong>` siblings → quad-asterisk runs

**Symptom.** Body contains `**作者**丨何煦阳**` (5 unbalanced `*`) or `**A****B**` (4 `*`).

**Root cause.** Adjacent `<strong>A</strong><strong>B</strong>` siblings → turndown emits `**A****B**`. Style-only `<span>` wrappers between them block adjacency detection.

**Remediation.** HTML-level pre-pass:
1. `unwrapInertSpans(doc)` — strip pure-style `<span>` wrappers so siblings become adjacent.
2. `normalizeEmphasis` Pass 1 — LOOP unwrap nested `<strong><strong>X</strong></strong>` until stable.
3. `normalizeEmphasis` Pass 2 — merge adjacent same-type `<strong>` siblings into one.

**Generalization.** Any HTML-from-rich-text-editor pipeline (mdnice, Notion → HTML, etc.) emits this shape. Apply the 3-pass normalization at the HTML level, not via post-turndown regex.

**Reference.** `tools/sites/weixin/raw-html-converter.ts`. CLAUDE.md §4 weixin recipe.

---

### P-10 — `## **Title**` redundant heading bold

**Symptom.** Headings rendered as `## **Title**` instead of `## Title`.

**Root cause.** Upstream HTML is `<h2><strong>Title</strong></h2>` — the `<strong>` is editorial chrome inside an already-emphasized element.

**Remediation.** `stripBoldInHeadings` in `_shared/post-cleanup.ts`. Regex `^(#{1,6}\s+)\*+\s*([^*\n]+?)\s*\*+\s*$` → `$1$2`. Already runs universally as a cross-cutting cleanup; do not re-implement.

**Generalization.** This is a §3 contract violation ("no `**bold**` inside headings"). Fix is universal, not host-specific.

**Reference.** `tools/sites/_shared/post-cleanup.ts`, exported as `stripBoldInHeadings`.

---

### P-11 — Footer chrome bleed-through (subscribe / related / tag chains)

**Symptom.** Last 30 lines of body contain "Subscribe to ..." / "Read more" / `[tag1][tag2][tag3]` sequences / "N people reacted" / "Share on X" rows.

**Root cause.** Article-shape pages have a chrome footer below the body. The body-selector is too broad (e.g. `<main>` instead of `.article-content`).

**Remediation.** Two layers:
1. **Tighten body selector** in the per-site module's article config — narrow from `<main>` to `<article>` or specific `.article-body` / `.post-content`.
2. **Add `dropSelectors`** for chrome that lives inside the body container (e.g. `.related-articles`, `.tag-list`, `.share-buttons`). Drop at the DOM level *before* turndown.

**Generalization.** Always tighten body selector first, dropSelectors second. The `make-article-site` factory makes both trivial.

**Reference.** `tools/sites/blog-csdn/`, `tools/sites/sohu/`, `tools/sites/sebastianraschka-blog/` — all are 15-line factory configs.

---

### P-12 — `dropSelectors` (kill DOM at the source, not via post-turndown regex)

**Symptom.** Article footer chrome would survive any selector-tightening because it's nested inside the same `<article>` container as the body.

**Remediation.** Pass `dropSelectors: [".related", ".comments", ".share", ".prev-next"]` to the article-site factory. The converter `Element.remove()`s these BEFORE turndown sees them, leaving zero output.

**Generalization.** ANY chrome that's inside the body container should be dropped at the DOM level. NEVER strip chrome via post-turndown regex — too easy to over-strip on real content. The `applyPostCleanups` pipeline only does host-agnostic cosmetic fixes; host-specific drops belong in the per-site module.

**Reference.** `tools/sites/_shared/article-converter.ts` (`dropSelectors` handling). Every article-shape module uses this.

---

### P-13 — `<svg>` / inline-icon explosions

**Symptom.** Body contains character-per-line text like:

```
A
r
r
o
w
```

**Root cause.** Inline `<svg>` decorative icon has `<text>` children. Turndown flattens those into newline-separated characters.

**Remediation.** Add `dropSelectors: ["svg"]` for ANY `<svg>` not preserved as an image (real diagrams as PNG, e.g. mermaid SVGs in some hosts, are handled separately — see P-30).

**Generalization.** If the SVG is decorative (logo, chevron, caret), drop it. If it's structural (diagram), save as a standalone file (`<host>-svg-NNN.svg`) and emit `<img src="..." data-local-svg="1">`.

**Reference.** `tools/sites/anthropic/index.ts` (SVG drop). `tools/sites/weixin/raw-html-converter.ts` (`processSvgs` for structural mermaid SVGs).

---

### P-14 — Sphinx `headerlink` permalinks → `[](#anchor)` chrome

**Symptom.** Every heading produces a trailing `[#](#title "Link to this heading")` empty-link chrome.

**Root cause.** Sphinx + Read-the-Docs theme inject `<a class="headerlink">` next to every heading.

**Remediation.** Add `dropSelectors: ["a.headerlink"]` in any Sphinx-themed site. The cross-cutting `stripEmptyAnchorLinks` cleanup catches some of these post-turndown but the DOM-level drop is more reliable.

**Reference.** `tools/sites/readthedocs/index.ts`. `tools/sites/docs-nvidia/`.

---

### P-15 — Image localization (every image must be a local file ref)

**Symptom.** Body contains `![](https://cdn.example.com/image.png)` after fetch.

**Root cause.** Site module produced markdown but didn't pipe through `processImages` (which downloads + rewrites refs to `<host>-img-001.png`).

**Remediation.** Every adapter MUST funnel its markdown through the central image-localization step. The `_shared/article-converter.ts` does this for factory sites. Custom converters should call `processImages(md, slugDir, downloadImages, originUrl)` before returning.

**Generalization.** Surviving `https://` image refs in final output = adapter bug. Caught by §1 block-ship gate (`remote_imgs > 0`).

**Reference.** `tools/fetch-raw.ts` `processImages` function. CLAUDE.md §3 "Images: all local."

---

### P-16 — Image fetch: 403 from CDN on default UA

**Symptom.** `images-declared-but-none-downloaded` flag — adapter declared image refs but disk has zero.

**Root cause.** Image CDN refuses requests with default `curl` user-agent (often Cloudflare-fronted, sometimes Referer-checking).

**Remediation.** `processImages` already sends a Chrome UA + the originUrl as `Referer`. If still 403:
- Add per-image-host UA override (rare).
- If only some images fail, check Content-Type — it may be a video/`webp`/`avif` we don't support.

**Reference.** `tools/fetch-raw.ts` `processImages`. CLAUDE.md §6b regression set.

---

### P-17 — Lazy-loaded images (`data-original=` holds full-res)

**Symptom.** Images fetch successfully but they're tiny thumbnails (e.g. sspai posts return 200×130 transforms when the full image is 1600×900).

**Root cause.** Site uses `<img data-original="...full-res..." src="...thumbnail-transform...">` (lazy-load pattern).

**Remediation.** Per-site converter rewrites `src` from `data-original` (or `data-src`, `data-lazy-src`) before image-localization. See `tools/sites/sspai/converter.ts`.

**Generalization.** Probe the source HTML for `data-original=`, `data-src=`, `data-lazy-src=`, `data-srcset=`. If any sibling attribute holds the full-res URL, prefer it over `src`.

**Reference.** `tools/sites/sspai/converter.ts`. `tools/sites/blog-csdn/converter.ts`.

---

### P-18 — Interactive web app (no extractable text by design)

**Symptom.** URL classifies as `upstream-spa-no-content` but the page IS the product (calculator, dashboard, search UI). Body is mostly inline `<style>`/`<script>`.

**Root cause.** The site has no "article" — it's an application.

**Remediation.** Don't try to extract content. The classifier already maps URLs matching `/login`, `/dashboard`, `/console`, `/calculator`, `/search`, `/tools`, or hex-hash subdomains (`*.eth.limo`-style) to `intentional-stub-app-only`. Extend the URL-pattern set in `tools/hirono/raindrop/failure-kind.ts` if you find a new shape.

**Generalization.** Recognizing "this URL is fundamentally not an article" early saves a lot of extraction grief. The URL pattern is more reliable than DOM heuristics.

**Reference.** `tools/hirono/raindrop/failure-kind.ts` `APP_URL_PATTERNS`. Commit `9b2bec6`.

---

### P-19 — IPFS gateway URLs (hash-subdomain decentralized hosting)

**Symptom.** URL like `1cb887bb.pinit.eth.limo`, `bafybei*.ipfs.dweb.link` — long hex/base32 subdomain.

**Root cause.** Decentralized content addressing — the URL hash IS the content key. Most are interactive web apps deployed to IPFS.

**Remediation.** Same as P-18 — classify as `intentional-stub-app-only` via URL pattern. The `^https?://[a-f0-9]{8,}\.` prefix regex catches them.

**Reference.** `tools/hirono/raindrop/failure-kind.ts`.

---

### P-20 — PDF / non-HTML detection

**Symptom.** `_default-non-html` flag, `intentional-stub`, body is a small "PDF link, see archive" stub.

**Remediation.** `_default` does Content-Type capture (curl `-D` to header file) + magic-bytes probe (`%PDF-` first 4 bytes) before any extraction. Short-circuits with the right stub. Same logic in `arxiv` for `/pdf/` URLs.

**Reference.** `tools/sites/_default/fetcher.ts` (`detectNonHtml`). `tools/sites/arxiv/index.ts` (path-based).

---

### P-21 — Stub threshold (when to give up)

**Symptom.** Body is < 200 chars after both curl AND browser-eval.

**Remediation.** Emit `intentional-stub` + `_default-fetch-failed` (or the per-host fetch-failed flag). The threshold is calibrated: real articles reliably exceed 200 chars; stubs reliably don't.

**Generalization.** Don't try to coerce content out of a fundamentally-empty page. Flag it and move on. The classifier downstream maps it to the right kind.

**Reference.** `tools/sites/_default/fetcher.ts`. `tools/sites/_shared/stub.ts` (`makeStub` helper).

---

### P-22 — Shortlink / share-redirect resolution

**Symptom.** URL is `xhslink.com/o/<id>`, `share.google?link=...`, `t.co/<id>`. The bookmark URL needs a redirect to reach the real content.

**Remediation.** Two approaches:
1. **Browser handles it transparently** (xhs): open xhslink.com → browser follows redirect → eval reads `window.location.href` for the canonical URL. We then save under the resolved host.
2. **Operator-side fix** (share.google): add a Raindrop bookmark cleanup step. Currently 1 share.google URL is in `host-malformed` because the share-redirect URL itself is the bookmark. Fix in Raindrop, refresh-cache.

**Reference.** `tools/sites/xhs/fetcher.ts` (browser redirect). `tools/sites/reddit/fetcher.ts` (`/r/X/s/<id>` → `/r/X/comments/<id>/...`).

---

### P-23 — Use the API (don't render HTML)

**Symptom.** Site has a clean structured API (REST/GraphQL/JSON). HTML rendering is lossy/chrome-heavy/JS-rendered.

**Remediation.** Skip HTML entirely. github does REST API for issues/PRs/discussions/releases + raw.githubusercontent.com for file/repo content. linux.do does Discourse JSON. epoch.ai does CSV download.

**Generalization.** When evaluating a new host, FIRST check for an API. The hierarchy of cleanest sources, in order:
1. REST/GraphQL JSON API
2. Raw markdown mirror (huggingface blog → GitHub)
3. Inline hydration JSON in `<script>` tags (Next.js `__NEXT_DATA__`)
4. Server-rendered HTML
5. Browser-eval (last resort)

**Reference.** `tools/sites/github/fetcher.ts`. `tools/sites/linux-do/`. `tools/sites/epoch-ai/`. CLAUDE.md §5e.v "Where cleaner data may hide."

---

### P-24 — Discourse forum JSON API

**Symptom.** Discourse forum (linux.do, etc.) — generic curl gets a topic listing shell; full topic + post stream needs scrolling.

**Remediation.** Fetch `<topic-url>.json`. Returns the post stream paginated; iterate, extract each post's `cooked` HTML field (Discourse pre-rendered), convert to markdown.

**Reference.** `tools/sites/linux-do/fetcher.ts`. Forum hosts are documented as login-wall heuristic-exempt in the cross-cutting cleanups (lots of forum threads literally discuss login flows).

---

### P-25 — Raw markdown mirror

**Symptom.** Site has a publicly-mirrored source-of-truth (often on GitHub) that's cleaner than rendered HTML.

**Remediation.** Fetch the raw markdown directly. HuggingFace's `/blog/<slug>` lives at `raw.githubusercontent.com/huggingface/blog/main/<slug>.md`.

**Generalization.** Any time a site is "the rendered view of a markdown repo", chase the repo. Faster, cleaner, no chrome.

**Reference.** `tools/sites/huggingface/fetcher.ts`.

---

### P-26 — CSV source substitution (data viz pages)

**Symptom.** Page is a chart/dashboard. Generic web-fetch produces UI control labels because data lives in JS state.

**Remediation.** Find the "Download CSV" link. Fetch the CSV. Embed top N rows as a markdown table alongside the page's prose intro.

**Reference.** `tools/sites/epoch-ai/fetcher.ts`.

---

### P-27 — Cloudflare / mod_security / UA gates

**Symptom.** `curl` returns `403 Just a moment...` (Cloudflare) or `mod_security: Access Denied`.

**Remediation.** The article-site factory already sends a full Chrome UA + `Accept-Language` header by default. If still gated, fall back to browser-eval.

**Generalization.** If browser-eval works but curl doesn't, it's almost always UA gating. Don't try to evade — accept the small browser-eval cost for that host.

**Reference.** `tools/sites/sebastianraschka-blog/index.ts` (header notes Cloudflare gate).

---

### P-28 — Cross-cutting cleanups (don't reinvent)

The 8 universal cleanups in `tools/sites/_shared/post-cleanup.ts` already run after EVERY site module's output. If you find yourself writing a regex to fix one of these, stop and check the existing list:

| Cleanup | Fixes |
|---|---|
| `stripEmptyAnchorLinks` | `[](#anchor)` permalink chrome |
| `stripShareWidgetLines` | bare "Share" / "Copy link" lines |
| `stripTrailingTagList` | concatenated `[tag1][tag2][tag3]` footers |
| `stripDecorativeEmojiImages` | twemoji refs `![🦊](.../1f98a.png)` → `:fox_face:` |
| `unescapeBracketsInLinks` | `\[ref\]` → `[ref]` (over-escaped footnote refs) |
| `stripColorTags` | `<text color="red">x</text>` → `x` |
| `resolveRelativeImageUrls` | `/img.png` → absolute URL against origin |
| `enforceSingleH1` | demote any extra `# ` to `## ` |
| `stripBoldInHeadings` | `## **Title**` → `## Title` |

**Reference.** `tools/sites/_shared/post-cleanup.ts`. Adding a new cross-cutting cleanup: only if the fix is genuinely host-agnostic (e.g. emoji unescaping is). Anything host-specific belongs in the per-site converter.

---

### P-29 — Single-H1 enforcement

**Symptom.** Output has 2+ `# ` headings. The frontmatter title block is `# X`; then the body's own `<h1>` block produces another `# Y`.

**Remediation.** `enforceSingleH1` cross-cutting cleanup demotes all body `# ` to `## ` so only the frontmatter H1 survives. If the site module's selector emits the body title separately, drop the body's H1 at the DOM level (`dropSelectors: ["h1.entry-title"]`).

**Reference.** `tools/sites/_shared/post-cleanup.ts` `enforceSingleH1`.

---

### P-30 — DeepWiki mermaid splice (orphan node-label paragraphs)

**Symptom.** Body contains paragraphs like `Cluster GPU Resources` / `Total GPUs requested` floating outside any ` ```mermaid ` fence.

**Root cause.** DeepWiki renders mermaid diagrams as SVG; the source text gets flattened to label-per-paragraph by the converter. The diagram source lives in (a) a `data-original-text` DOM attribute (wiki.litenext.digital) or (b) inside hydration `<script>` tags `self.__next_f.push(...)` (deepwiki.com).

**Remediation.** Two-stage:
1. Extract mermaid sources (DOM attr OR script-scan, capped to `document.querySelectorAll('svg[id^=mermaid]').length` to match SVGs actually rendered on this page).
2. `spliceDeepwikiMermaid(md, sources)` replaces orphan-label runs with ` ```mermaid ... ``` ` fences.

**Generalization.** When a complex visual block (diagram, embedded chart) flattens to text noise, hunt for the structured source — it's almost always present in DOM data-attrs or hydration JSON.

**Reference.** `tools/sites/deepwiki-com/fetcher.ts`, `tools/sites/deepwiki-litenext/fetcher.ts`. CLAUDE.md §4 "DeepWiki mermaid" recipe.

---

### P-31 — Article-site factory (15-line config for blog-shape hosts)

**Symptom.** The site is a server-rendered blog with stable selectors (Hexo / Jekyll / Hugo / WordPress / Next.js .prose etc.). No SPA, no auth, no API.

**Remediation.** Use `makeArticleSite({ name, hosts, body: [...selectors], dropSelectors: [...], ... })` from `_shared/article-site-factory.ts`. The factory handles curl, JSDOM, body-selector cascade, dropSelector application, turndown conversion, image localization, and §2 frontmatter assembly.

**Generalization.** This is the answer for ~80% of hosts that have any content. If a sub-good site doesn't need browser-eval, doesn't need an API, and isn't a SPA → write a 15-line factory config.

**Reference.** Clean reference implementations: `tools/sites/aleksagordic/`, `tools/sites/01-me/`, `tools/sites/lmsys/`, `tools/sites/intuitionlabs/`, `tools/sites/qwenlm-github-io/`.

---

### P-32 — Share-aggregator URL unwrap (target embedded as query param)

**Symptom.** Bookmark URL is hosted on a wrapper domain (`share.google`, plausibly `share.weibo.cn`, `out.reddit.com`, etc.) and contains the real content URL embedded as a query parameter (typically `?link=…`, `?url=…`, `?u=…`). Plain curl + browser fetch lands on the wrapper's interstitial page rather than the target.

`hirono raindrop status` may surface the bookmark as `host-malformed` (URL-shape rule fired), `upstream-spa-no-content` (interstitial body too small), or — depending on which page Google's redirect chain serves — even `clean` with sub-good content because the interstitial happened to have enough text to pass the threshold.

**Root cause.** The wrapper host serves a redirect interstitial that NEVER 302's to the target — the target URL only exists as data in a query parameter. Curl-following-redirects (`-L`) is no help because the wrapper redirects to ANOTHER page on its own domain (e.g. `share.google` → `www.google.com/share.google?...`).

This is distinct from URL shorteners (`t.co`, `lnkd.in`, `bit.ly`) which DO 302 to the target and are already handled transparently by `curl -L` and the browser.

**Remediation.** Pre-fetch URL unwrap. `tools/sites/_shared/url-unwrap.ts` exports `unwrapShareUrl(url)` with an extensible `WRAPPER_RULES` registry — each rule is `{host: regex, paramName: string}`. Hooked into:

- `tools/fetch-raw.ts` `fetchUrlAndStore`: unwraps before AUTO_SKIP_RULES, slug-dir placement, and `routeSite()`. The slug lands under `raw/raindrop/<target-host>/`, and the target's dedicated module (if any) handles the fetch.
- `tools/fetch-raw.ts` `rebuildRawIndex`: builds the bookmark map keyed by both the wrapper URL AND its unwrapped form, so a slug whose `origin_url` is the unwrapped target still joins to its bookmark.
- `tools/hirono/raindrop/status.ts` `buildStatusRows`: checks both forms when joining bookmarks to slugs, so the status report doesn't show a wrapped bookmark as `not-yet-fetched` when its unwrapped slug is on disk.

To register a new wrapper, append a `{host, paramName}` rule to `WRAPPER_RULES` and add a fixture URL to `tools/__tests__/url-unwrap.test.ts`.

**Generalization.** Two distinct mechanisms hide content URLs behind a wrapper:

1. **HTTP redirect** — `t.co/abc` → `Location: https://target.com/...`. Curl/browser handle this; no code change needed.
2. **Query-param embed** — `share.google?link=<target>`. The wrapper either renders an interstitial or 302's to ANOTHER wrapper page; the target lives only in the query string. Needs unwrap.

When you see a sub-good fetch on a `share.*`, `out.*`, `s.*`, `redirect.*`, or `link.*` host, check the URL for an embedded `link=`/`url=`/`u=`/`target=` parameter before reaching for browser-eval. If you find one, P-32 is the fix; add the rule.

**Reference.** `tools/sites/_shared/url-unwrap.ts`. Hooks: `tools/fetch-raw.ts:fetchUrlAndStore` + `:rebuildRawIndex`, `tools/hirono/raindrop/status.ts:buildStatusRows`. Tests: `tools/__tests__/url-unwrap.test.ts`.

---

### P-33 — Anti-bot challenge interstitial extracted as content

**Symptom.** A slug looks like content (passes the 200-char stub threshold) but the body is literally an anti-bot challenge or origin-error page:

- Title: `Just a moment...` / `Attention Required! | Cloudflare` / `525: SSL handshake failed` / `521: Web server is down`
- Body: `Performing security verification` / `Checking your browser before accessing` / `cf-browser-verification` / `Cloudflare Ray ID` / `DataDome` / `Akamai Bot Manager`

`hirono raindrop status` typically classifies these as `content-too-short`, `content-incomplete-images-zero`, or `upstream-spa-no-content` — none of which name the actual failure mode. Operators reading the status report can't tell from the kind alone that we got bot-blocked.

**Root cause.** Cloudflare / Akamai / DataDome / PerimeterX served their challenge or origin-error page instead of the underlying content. Both `_default`'s curl path AND the browser-eval fallback can hit this — the right Chrome UA isn't enough when the host's bot rules require a JavaScript-solved challenge cookie that opencli's automation profile doesn't carry. Curl bytes can be > 0 (the challenge HTML has substance), so the > 200-char threshold doesn't fire; image-localization runs against the (fake) extracted body and finds zero images, producing the misleading `images-declared-but-none-downloaded` flag.

This is distinct from P-27 (chrome-ua-headers gets you THROUGH the gate when the host trusts your UA). P-33 is what to do when even the right UA doesn't work and the challenge page IS what you got.

**Remediation.** `tools/sites/_default/index.ts:looksLikeBotChallenge(title, body)` scans the extracted title + first ~1500 chars of body for known signatures (Cloudflare title, Cloudflare body markers, Cloudflare class names, CF Ray ID phrasing, DataDome / PerimeterX / Akamai references, CF origin-error codes 5xx). On match, the fetch flow returns `botBlockedStub(url, signature, errorDetail)` — a §2-contract stub flagged `["intentional-stub", "_default-bot-blocked"]`. The signature name (e.g. `cloudflare-just-a-moment`, `cloudflare-origin-error`) lands in the stub body for diagnostics.

The failure-kind classifier matches the host-agnostic suffix `-bot-blocked` (alongside `-fetch-failed` / `-extraction-failed`) and routes such slugs to `upstream-fetch-failed`. Future host modules that want their own bot-block detection just need to emit a `<host>-bot-blocked` flag — no classifier change required.

**Generalization.** Three rules of thumb:

1. **The body's title is the strongest single signal.** `Just a moment...` / `Attention Required` / `<digits>: <error name>` are reliable. Body-text signatures are useful but more prone to false positives — keep them broad enough to match variants but narrow enough that real content doesn't trip them.
2. **CF origin errors (5xx) belong here too**, not just challenges. `525: SSL handshake failed` means the origin is unreachable from the CF edge — same observable outcome (we can't get the content) and the same operator action (check the URL in a browser, accept the stub if the host is consistently broken).
3. **Don't try to evade.** If both curl and browser-eval get the challenge, the right answer is to flag and move on. Operator can manually warm a Chrome session against the host (visit once in the bound Chrome, complete the JS challenge, refetch) but automating that bypass is out of scope.

When extending: add new signatures to `looksLikeBotChallenge` as new gating systems appear. Test on a fixture where you've captured the challenge HTML in `tools/__tests__/fixtures/converters/_default/<challenge-name>.input.json`.

**Reference.** `tools/sites/_default/index.ts:looksLikeBotChallenge` + `:botBlockedStub`. Classifier rule: `tools/hirono/raindrop/failure-kind.ts` (`-bot-blocked` suffix in the stub branch). Sample outputs: `sweep-results/stackoverflow.com/sample.md`, `sweep-results/ai.joshuasun.asia/sample.md`, `sweep-results/apxml.com/sample.md`.

---

## §3 Patterns by remediation technique

When you've decided what kind of fix to apply, this index points at the working reference modules.

### Use an API instead of HTML
- REST API: github (`tools/sites/github/`), linux.do (Discourse JSON)
- Raw markdown mirror: huggingface (`tools/sites/huggingface/`)
- CSV download: epoch.ai (`tools/sites/epoch-ai/`)
- CLI subprocess: feishu (`tools/sites/feishu/`, lark-cli)

### Browser-session-via-opencli
- Auth-walled: x-twitter, weixin, xhs, zhihu, reddit
- SPA hydration: qwen-ai, _default fallback
- Reference helpers: `tools/sites/_shared/browser-helpers.ts`

### Selector-tightening + dropSelectors (article-site factory)
- 15-line factory configs: aleksagordic, 01-me, lmsys, intuitionlabs, qwenlm-github-io, blog-google, sohu, sspai, substack
- Tighter wildcard matching: readthedocs (any `*.readthedocs.io`), feishu (any `*.feishu.cn`)

### DOM-level walker / converter
- Tables: weixin (`textWithLineBreaks`)
- Code blocks: weixin, xhs, zhihu
- SVG diagrams: weixin (`processSvgs`)
- Sphinx headerlinks: readthedocs, docs-nvidia

### URL-pattern routing inside a single module
- Path branching: arxiv (`/abs/`, `/pdf/`, listings), github (issues/PR/discussions/releases/raw)
- Wildcard host: feishu, readthedocs

### Catch-all hybrid (`_default`)
- curl-then-browser-eval cascade
- PDF / non-HTML short-circuit via Content-Type + magic bytes
- Stub threshold (200 chars)
- Anti-bot challenge / origin-error detection — `looksLikeBotChallenge(title, body)` (P-33)

### URL-pattern classifier (no fetch needed)
- App-only detection: `intentional-stub-app-only` via URL regex
- Reference: `tools/hirono/raindrop/failure-kind.ts` `APP_URL_PATTERNS`

### Pre-fetch URL rewrite
- Share-aggregator unwrap: `unwrapShareUrl(url)` extracts the real target from a query parameter and re-routes through the host-specific module (P-32)
- Reference: `tools/sites/_shared/url-unwrap.ts`

---

## §4 Decision tree for a new sub-good site

When `hirono raindrop status` flags a host you've never seen:

1. **Is the URL a share-aggregator wrapper?** Hosts like `share.google`, `share.weibo.cn`, `out.reddit.com` with a `?link=…` / `?url=…` query param holding the real target. → P-32 share-aggregator-unwrap. Add the rule, re-fetch under the target host. Don't continue down this tree on the wrapper.
2. **Check the URL pattern**: is it a login page, dashboard, calculator, IPFS gateway? → P-18 / P-19, classify as `intentional-stub-app-only`. Done.
3. **Check Content-Type**: is it `application/pdf` or other non-HTML? → P-20, classify as `upstream-not-html`. Done.
4. **Open the URL in a browser**: does the page show real content?
   - **No** (404 / login wall / "page deleted") → P-03 stub-by-design or P-21 stub-threshold.
   - **Yes** → continue.
5. **Look for an API**: REST endpoint? Raw markdown mirror? CSV download? Hydration JSON in `<script>`? → P-23, P-24, P-25, P-26. Strongly preferred.
6. **Check static HTML**: does plain `curl <url>` contain the body text?
   - **Yes** → P-31 article-site factory. Tighten selectors + add dropSelectors. Done.
   - **No, body is empty** → SPA. Continue.
7. **Browser-eval works**: does opencli `browser open <url>; browser eval ...` find the body?
   - **Yes** → either accept `_default`'s hybrid (which already does this) or write a per-host module if you need custom hydration timing / extraction logic. Hydration race? → P-06 longer wait.
   - **No** → site is genuinely interactive (P-18) or auth-walled (P-03 + P-04).
8. **After fetching, eyeball the output** (CLAUDE.md §5e.iv first-pass eye-read checklist). Apply the targeted patterns:
   - Title is `Just a moment...` / `Attention Required` / a 5xx-prefixed CF error code? Body talks about "security verification"? P-33 anti-bot-challenge-detect — the slug isn't really content; it's a CF/Akamai/DataDome interstitial.
   - Quad-asterisks, redundant heading bold? P-09, P-10, P-28.
   - Heavy footer chrome? P-11, P-12.
   - Inline SVG explosions? P-13.
   - Sphinx headerlinks? P-14.
   - Mermaid orphan labels? P-30.
   - Lazy images? P-17.

---

## §5 Cross-cutting cleanups inventory

The cleanups exported from `tools/sites/_shared/post-cleanup.ts` run AFTER every site module's `fetch()` returns. They're host-agnostic; do NOT replicate them in per-site converters.

| Cleanup | Function | When it fires |
|---|---|---|
| Empty anchors | `stripEmptyAnchorLinks` | `[](#anchor)` chrome from permalinks |
| Share widgets | `stripShareWidgetLines` | bare lines like "Share" / "Copy link" |
| Trailing tag chains | `stripTrailingTagList` | `[tag1][tag2][tag3]` at body end |
| Decorative emoji refs | `stripDecorativeEmojiImages` | twemoji `![](...1f98a.png)` → `:fox_face:` |
| Over-escaped brackets | `unescapeBracketsInLinks` | `\[ref\]` → `[ref]` |
| Color tags | `stripColorTags` | `<text color="red">` → plain text |
| Relative image URLs | `resolveRelativeImageUrls` | `/img.png` → absolute against origin |
| Single H1 enforcement | `enforceSingleH1` | demote any `# ` after the first |
| Bold-in-headings | `stripBoldInHeadings` | `## **X**` → `## X` |

If a defect doesn't appear in this list, it's host-specific — fix it in the per-site converter, not here.

---

## §6 Anti-patterns (don't do these)

These are mistakes the existing modules learned to avoid. Documented to keep them from creeping back.

- **AP-01: Don't strip footer chrome via post-turndown regex.** Always drop at the DOM level via `dropSelectors`. Regex passes are fragile and over-strip on real content.
- **AP-02: Don't trust `.textContent` on tables / code blocks.** Use a DOM walker that emits `\n` for `<br>` and between block siblings (P-07, P-08).
- **AP-03: Don't trust `data-lang=` on weixin/mdnice code blocks.** mdnice mis-tags YAML/bash as `sql`. Trust `<code class="language-X">` only; for multi-`<code>` shapes, ignore lang entirely.
- **AP-04: Don't reinvent cross-cutting cleanups.** Check the §5 inventory before writing a new regex.
- **AP-05: Don't skip the eye-read checklist.** Counts (`fences=N tables=M`) are necessary but not sufficient. Always read top 30 / mid 30 / tail 30 lines of a fresh sample. CLAUDE.md §5e.iv.
- **AP-06: Don't capture a fixture/snapshot before user approval.** Locking tests around bad output silently bakes regressions. CLAUDE.md §5a step 5: only after eye-read approval.
- **AP-07: Don't assume `intentional-stub` flag survives reclassify.** It used to be stripped; now preserved (commit `1cf3c89`). When inspecting source.json, accept its presence as a stub signal.
- **AP-08: Don't always-browser when curl works.** browser-eval serializes through the machine-wide opencli lock and adds 3-5s/fetch. Use it only when curl yields < 500 chars (P-02 hybrid).

---

## How to extend this file

After fixing a sub-good site:

1. **Identify the pattern** the fix solves. Was it an existing pattern (just refine the entry) or a new one?
2. **Append to §2** with the standard 5-bullet shape: Symptom · Root cause · Remediation · Generalization · Reference.
3. **Add a row to §1** quick-lookup table.
4. **If the technique is new**, also index in §3.
5. **If you found an anti-pattern**, add to §6.
6. **Cross-link**: Reference field should point at the newly-committed code (file:line is fine).

The playbook grows; `_default` and the factory grow with it. Long-tail singletons should mostly Just Work as the patterns accumulate.
