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
| Bookmark URL is bare-domain (`https://example.com/`) or search-results (`?search=…` / `?q=…`) and slug classifies as `content-too-short` / `content-incomplete-images-zero` / `upstream-spa-no-content` | Bookmark intent IS the site / query, not a specific article | P-18 url-pattern-app-only |
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
| URL ends in `.pdf` / Content-Type is `application/pdf` | PDF — render each page to image-bearing markdown (P-36) or fall back to stub (P-20) on encryption / corruption | P-36 pdf-page-rendering, P-20 nonhtml-stub |
| `_default` extracts < 200 chars but `curl <url>` returns 5+ KB of HTML with `<h1>`, `<p>`, form elements directly under `<body>` (no `<article>`/`<main>`/`.prose` wrapper) | Single-purpose JS tool / IPFS-hosted SPA / hand-rolled HTML — semantic content lives directly in `<body>` | P-37 body-direct-content |
| Output has orphan `](url)` lines (`grep -c "^\s*\]("` non-zero) OR a single line with 4+ adjacent `[X](Y)[X](Y)…` link runs OR many `[![<name>](avatar.jpg)](/profile-url)` rows | Catalog/grid page — turndown's multi-line link wrapper emission + sibling `<a>` no-separator + avatar image-link clutter | P-38 catalog-link-cleanups |
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
| Body title is `404 Not Found` / `Page Not Found` / `Error 404` / `Sorry, this page isn't available`; body says "The requested URL was not found" / "this page doesn't exist" | Page-deleted error body extracted as content (host returned HTTP 200 with a 404 body) | P-34 not-found-page-detect |
| Slug shows `not-yet-fetched` in status but `.fetch-all.log` records it as `errored`; slug dir empty or absent | L2-error code-path didn't write a stub source.json — the slug looks "untried" instead of "attempted-and-rejected" | P-35 stub-on-l2-failure |

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

### P-18 — Interactive web app / homepage / search-results URL (no extractable text by design)

**Symptom.** URL classifies as `upstream-spa-no-content` / `content-too-short` / `content-incomplete-images-zero` — but the page itself IS the product (calculator, dashboard, search UI), the bookmark-target IS the site as a whole (bare-domain homepage), or the URL describes a dynamic query (`?search=`/`?q=`/`?keyword=`).

**Root cause.** Three URL shapes converge on the same conceptual category — "this isn't a content page":

1. **Path-based app**: `/login`, `/dashboard`, `/calculator`, `/tools`, etc. The page IS the application.
2. **Decentralized gateway**: hex-hash subdomain (e.g. `*.eth.limo`, IPFS gateways). Hash IS the content key; the page is whatever app deployed under that hash.
3. **Bare-domain homepage** (refinement, iteration 5): bookmark URL is just the host with no path or only `/`. Bookmark intent is the SITE as an entity, not a specific article. Examples: `hjfy.top/`, `x666.me/`, `trend.tgmeng.com/`. (Real-content homepages like `lilianweng.github.io/` extract clean content and never reach this code path — the URL-pattern check only fires when the slug already has at least one quality flag.)
4. **Search-results URL** (refinement, iteration 5): query params `?search=`, `?q=`, `?query=`, `?keyword=`, `?kw=`, `?term=`. Bookmark intent IS the query; content is dynamic by definition.

**Remediation.** `tools/hirono/raindrop/failure-kind.ts:looksLikeAppShapedUrl(url)` runs the URL through a regex set covering all four shapes. Returns true if any pattern matches.

The classifier checks this in two places:
- **Stub branch — SPA sub-branch** (after extraction failed with `_default-fetch-failed` / `loading-skeleton`): if URL is app-shaped, return `intentional-stub-app-only`; otherwise fall through to `upstream-spa-no-content`.
- **Stub branch — bot-blocked sub-branch**: when the catchall `-fetch-failed` / `-extraction-failed` / `-bot-blocked` regex would route to `upstream-fetch-failed`, FIRST check the URL shape. If the bookmark URL is `/tools/calculator` or similar, the bookmark intent is the tool itself — bot-block is incidental, classification should be `intentional-stub-app-only`. Real-content URLs that happen to be bot-blocked (e.g. `stackoverflow.com/questions/...`) don't match the app-shape regex and stay `upstream-fetch-failed` (operator might clear the CF challenge cookie and refetch). Example: `apxml.com/zh/tools/vram-calculator` is Cloudflare-walled but the URL says "calculator" — app-only is the right kind.
- **Non-stub flagged branch** (iteration 5): when the slug has flags BUT no `intentional-stub` marker (e.g. `short-body` from a homepage extraction), check the URL pattern there too — if it matches, classify as `intentional-stub-app-only` instead of letting the slug masquerade as `content-too-short`.

The non-stub branch check is **guarded on `flags.length > 0`** — a bare-domain URL with clean extraction (real-content blog homepage) classifies as `clean` per the catchall and never reaches the URL-pattern check. The pattern only flips the kind when extraction was already judged sub-good.

**Generalization.** Recognizing "this URL is fundamentally not an article" early saves a lot of extraction grief. The URL pattern is more reliable than DOM heuristics. When extending: think hard about what bookmark INTENT corresponds to the URL shape — if the bookmark intent is "the site/app/query itself," the slug belongs in `intentional-stub-app-only`. Add the regex to `looksLikeAppShapedUrl`.

**Reference.** `tools/hirono/raindrop/failure-kind.ts:looksLikeAppShapedUrl` (regex set + the three branch usages). Commit `9b2bec6` (original P-18 — SPA sub-branch only); iteration 5 added bare-domain + search-results matchers and lifted the check into the non-stub branch; later refinement added the bot-blocked sub-branch override (apxml VRAM calculator case).

**Sibling pattern: P-37.** A URL matching P-18 (app-shaped) doesn't always mean the page has no extractable content. Single-purpose JS tools often embed substantial documentation directly under `<body>`. If the HTML is non-trivial but `_default` extracted < 200 chars, the cascade missed body-direct content — see P-37 for the body-direct fallback.

---

### P-19 — IPFS gateway URLs (hash-subdomain decentralized hosting)

**Symptom.** URL like `1cb887bb.pinit.eth.limo`, `bafybei*.ipfs.dweb.link` — long hex/base32 subdomain.

**Root cause.** Decentralized content addressing — the URL hash IS the content key. Most are interactive web apps deployed to IPFS.

**Remediation.** Same as P-18 — classify as `intentional-stub-app-only` via URL pattern. The `^https?://[a-f0-9]{8,}\.` prefix regex catches them.

**Reference.** `tools/hirono/raindrop/failure-kind.ts`.

---

### P-20 — Non-HTML detection (stub path)

**Symptom.** `_default-non-html` flag, `intentional-stub`, body is a small "non-HTML response, see archive" stub. Applies to images, videos, archives, app-store deep-links — anything that isn't HTML and isn't a PDF.

**Remediation.** `_default` does Content-Type capture (curl `-D` to header file) + magic-bytes probe (`%PDF-` first 4 bytes) before any extraction. When the response is non-HTML AND not a PDF, short-circuit with the stub.

**For PDFs specifically, see P-36** (render path) — when the non-HTML response IS a PDF, we now render each page to PNG and embed in the markdown body rather than stub. P-20 and P-36 are siblings under the same Content-Type branch; the renderer fires when the response is a PDF, the stub fires for any other non-HTML.

**Reference.** `tools/sites/_default/index.ts` (`detectNonHtml`, `nonHtmlStub`, plus the PDF branch that delegates to P-36's `renderPdfFromUrl`).

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

The universal cleanups in `tools/sites/_shared/post-cleanup.ts` already run after EVERY site module's output. If you find yourself writing a regex to fix one of these, stop and check the existing list:

| Cleanup | Fixes |
|---|---|
| `collapseMultiLineLinkWrappers` | `[![alt](src)\n\n    ](url)` → `[![alt](src)](url)` (P-38) |
| `stripAvatarImageLinks` | `[![<author>](avatar.jpg)](/profile-url)` and `[<short-text>](/profile-url)` → ∅ (P-38) |
| `splitAdjacentInlineLinks` | run-together `[X](Y)[X](Y)…` chains → ` · `-separated (P-38) |
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

**Auto-resolve retry.** CF challenges typically auto-resolve in 10-15s with JS execution — the default 3.5s browser wait often catches the challenge mid-resolution. When the first eval shows a CF challenge signature, the fetcher retries with a 15s wait against the same URL. opencli's user-bound Chrome carries organic cookies + behavior signals that Cloudflare often trusts; the retry usually clears the challenge automatically. If the retry also returns a challenge body, THEN emit the stub.

The retry is gated on signature pattern: only `cloudflare-just-a-moment`, `-attention-required`, `-security-verification`, `-browser-check`, `-class-marker`, `-ray-id-blocked` are auto-resolvable. Origin-error interstitials (`cloudflare-origin-error`, CF 5xx) won't auto-resolve no matter how long we wait, so they skip retry and stub immediately. Other vendors (Akamai, DataDome, PerimeterX) similarly skip retry — they require human-shaped behavior signals our automation can't supply.

Worked example: `apxml.com/zh/tools/vram-calculator` (Cloudflare-walled VRAM calculator). First eval at 3.5s caught "Just a moment..." challenge. Retry at 15s cleared the challenge → 8714 chars of substantive content extracted (FAQ, calculation principle, changelog, references). Slug went from `_default-bot-blocked` stub to `clean` extraction in a single fetcher invocation. The 15s cost is paid only on actual CF-protected sites; non-CF sites skip the challenge detection entirely.

**Generalization.** Three rules of thumb:

1. **The body's title is the strongest single signal.** `Just a moment...` / `Attention Required` / `<digits>: <error name>` are reliable. Body-text signatures are useful but more prone to false positives — keep them broad enough to match variants but narrow enough that real content doesn't trip them.
2. **CF origin errors (5xx) belong here too**, not just challenges. `525: SSL handshake failed` means the origin is unreachable from the CF edge — same observable outcome (we can't get the content) and the same operator action (check the URL in a browser, accept the stub if the host is consistently broken). These are NOT auto-resolvable — skip retry.
3. **Auto-resolvable challenges deserve a retry, not an immediate stub.** Earlier guidance was "don't try to evade" — refined: don't try to FORGE behavior signals (User-Agent spoofing, fingerprint evasion, etc.), but DO let opencli's already-trusted Chrome session handle the challenge with adequate wait time. The 15s retry is patience, not evasion.

When extending: add new signatures to `looksLikeBotChallenge` as new gating systems appear. Add the signature to the auto-resolve regex in `_default/index.ts` IF it's a JS-challenge type that resolves on its own. Test on a fixture where you've captured the challenge HTML in `tools/__tests__/fixtures/converters/_default/<challenge-name>.input.json`.

**Reference.** `tools/sites/_default/index.ts:looksLikeBotChallenge` + `:botBlockedStub` + the 15s retry path in the fetch flow. Classifier rule: `tools/hirono/raindrop/failure-kind.ts` (`-bot-blocked` suffix in the stub branch, with URL-shape app-only override). Sample outputs: `sweep-results/stackoverflow.com/sample.md` (origin-error, no retry), `sweep-results/ai.joshuasun.asia/sample.md` (CF 525 origin-error), `sweep-results/apxml.com/sample.md` (CF challenge cleared via retry — full 8.7KB content extracted).

---

### P-34 — 404 / page-deleted error pages extracted as content

**Symptom.** A slug body's `# H1` reads `404 Not Found` / `Page Not Found` / `Error 404` / `HTTP 410` / `Sorry, this page isn't available`, OR the body text contains `The requested URL .* was not found on this server` / `the page you are looking for doesn't exist`. The extracted "content" is the host's page-deleted error page.

`hirono raindrop status` typically shows these as `content-too-short` (body has 200-1000 chars of error text — passes the stub threshold but flags the size). Operators reading the kind alone can't tell that the resource is genuinely GONE rather than partially-rendered.

**Root cause.** The host serves an HTTP 200 (or 410, or 451) response with a body that's its 404 / page-deleted page. Curl doesn't error because the status code is in the success range or the host is sloppy about HTTP semantics. `_default`'s extractor sees substantive HTML, runs body selectors, produces 200-1000 chars of "The requested URL was not found on this server" text — and saves it as content. Different from P-33 (anti-bot challenge): there the host is gating you out temporarily; here the resource has been deleted and won't come back.

This is the third instance of the meta-pattern "we extracted a wrapper page rather than real content," after P-32 (share-aggregator wrappers) and P-33 (anti-bot challenges). When you hit a fourth, consider whether to introduce a unified detection pipeline.

**Remediation.** `tools/sites/_default/index.ts:looksLikeNotFoundPage(title, body)` scans the extracted title + first ~1500 chars of body for known not-found signatures:

- Title-first (high confidence): `^(?:404|Page Not Found|Not Found|Error 404|HTTP 4(?:04|10|51))`, also `| 404` / `— Page Not Found` / `· Page Not Found` suffixes when a site appends its name.
- Platform-specific: `Sorry, this page isn't available` (Instagram-style), `This page isn't available / doesn't exist / could not be found`.
- Body-text fallback for sites with generic site-name `<title>` on 404s: Apache/nginx `The requested URL was not found on this server`, generic `the page you are looking for doesn't exist`, HTTP `410 Gone` / `451 Unavailable For Legal Reasons` literals.

On match, `notFoundStub(url, signature, errorDetail)` returns a §2-contract stub flagged `["intentional-stub", "_default-not-found"]`. The signature name (`title-404`, `apache-nginx-404`, `instagram-deleted`, etc.) lands in the diagnostic block.

The failure-kind classifier matches the host-agnostic suffix `/-not-found$/` in the deleted-upstream branch, alongside `feishu-deleted` / `reddit-deleted` / `x-twitter-empty`. Routes to `upstream-deleted` (operator action: edit/remove the bookmark, or fetch from archive.org). Future host modules emitting `<host>-not-found` flags pick up the classification automatically.

The check runs BEFORE the bot-challenge check in the fetch flow — both are "we extracted the wrong page" detections, but a 404 body trumps a CF challenge body (if both fire, the page is gone regardless of bot-block status).

**Generalization.** Three rules of thumb:

1. **Title is again the strongest signal.** Real articles whose CONTENT mentions "404" or "not found" don't have those phrases in their `<title>`. Title-pattern matching has very low false-positive rate.
2. **Don't conflate "page not found" with "anti-bot blocked".** Different operator action (edit/delete bookmark vs re-auth Chrome session). Different failure kind (`upstream-deleted` vs `upstream-fetch-failed`). Keep the detections separate.
3. **HTTP 410 (Gone) and 451 (Legal) belong here too**, not in their own kind. Same effect: the resource is unreachable now and will stay that way.

When extending: add new signatures to `looksLikeNotFoundPage` as new platform-specific dead-page messages appear. Look at the actual error body before adding a regex — Instagram, YouTube, Twitter all have their own dead-page wording.

**Reference.** `tools/sites/_default/index.ts:looksLikeNotFoundPage` + `:notFoundStub`. Classifier rule: `tools/hirono/raindrop/failure-kind.ts` (`-not-found` suffix in the deleted-upstream branch). Sample output: `sweep-results/mapp.api.weibo.cn/sample.md`.

---

### P-35 — Write a stub source.json when L2 errors fire (don't leave the slug as `not-yet-fetched`)

**Symptom.** A bookmark perpetually classifies as `not-yet-fetched` in `hirono raindrop status`, even though `raw/.fetch-all.log` shows we tried it (with `outcome:"errored"`). The slug dir is empty or absent on disk. Operators can't tell from the kind alone whether the bookmark was never attempted vs. attempted-and-rejected.

**Root cause.** Pre-2026-05 fetcher pipeline: when `fetchUrlAndStore` (or a site module's `fetch()`) threw an L2 error (skip-and-continue level), the runner caught the throw, logged the slug as `errored` in `.fetch-all.log`, and moved on. No `source.json` was written. The next `hirono raindrop status` run had no on-disk evidence that the slug was attempted, so it joined the bookmark to "no slug" → kind `not-yet-fetched`.

L2 error sources that hit this:
- `AUTO_SKIP_RULES` pre-fetch rejection (e.g. `auto-skipped-hf-space` for HuggingFace Spaces)
- Site-module L2 throws (e.g. `weixin-account-migrated` from `tools/sites/weixin/fetcher.ts`, lark-cli forbidden from feishu, etc.)

**Remediation.** `tools/fetch-raw.ts:writeL2ErrorAsStub(opts, errorCode, errorMessage)` writes a §2-contract stub (`# Auto-skipped: <code>` title + status callout + advice) and a source.json flagged `["intentional-stub", <errorCode>]`. The error code becomes the typed flag — same pattern as `_default-bot-blocked` / `_default-not-found` — so the failure-kind classifier can recognize it.

Wired in at two L2 throw sites in `fetchUrlAndStore`:
- AUTO_SKIP_RULES loop: writes the stub before the throw.
- `matchedSite.fetch()` try/catch: catches L2 from inside any site module, writes the stub, re-throws.

Caller (e.g. `fetch-all.ts`) still sees the throw and logs `outcome:"errored"`, so the audit trail is preserved. Subsequent status reports now classify the slug correctly because source.json is on disk.

Failure-kind classifier maps known L2 error codes to the right kind:
- `auto-skipped-hf-space` → `intentional-stub-app-only` (interactive HF space)
- `weixin-account-migrated` → `upstream-deleted` (publisher gone)
- Unknown codes fall through to `upstream-fetch-failed` via the `/-fetch-failed$/` / `/-extraction-failed$/` / `/-bot-blocked$/` regex catchall

**Generalization.** This is a fetcher-pipeline pattern, not a per-host fix. Two rules of thumb for L2 throws in any module:

1. **Choose the error code thoughtfully — it becomes the flag.** Format `<host>-<failure-mode>` (`weixin-account-migrated`, `feishu-user-auth-required`) or `<action>-<noun>` (`auto-skipped-hf-space`). The classifier matches by suffix (`-fetch-failed`, `-extraction-failed`, `-bot-blocked`, `-not-found`) so consider whether your code should hit one of those generic catchalls.
2. **Add an explicit classifier rule for novel codes** if the catchall doesn't fit. E.g. `weixin-account-migrated` belongs in `upstream-deleted`, not `upstream-fetch-failed` — added to the deleted-upstream branch alongside `feishu-deleted`.

When introducing a new L2 throw in a site module, check that `hirono raindrop status` classifies the resulting stub correctly. If it lands as `upstream-fetch-failed` and the failure mode is actually deleted/auth-gated/not-html/etc., extend the classifier.

**Reference.** `tools/fetch-raw.ts:writeL2ErrorAsStub` + the two wired-in throw sites (AUTO_SKIP loop + matchedSite.fetch try/catch). Classifier rules: `tools/hirono/raindrop/failure-kind.ts` (`auto-skipped-hf-space` in app-only branch, `weixin-account-migrated` in deleted-upstream branch). Sample outputs: `sweep-results/huggingface.co/spaces/sample.md`, `sweep-results/mp.weixin.qq.com/sample-migrated.md`.

---

### P-36 — PDF page-rendering (sibling to P-20's stub path)

**Symptom.** A bookmark URL returns `Content-Type: application/pdf` (or starts with `%PDF-` magic bytes). P-20 (the stub path) flags this as `upstream-not-html` and emits a small "PDF, not extractable as markdown" stub — losing the actual content.

**Root cause.** PDFs aren't HTML, so the standard turndown pipeline can't extract content from them. But the bookmark exists for a reason: the operator wanted that PDF's content archived. A stub satisfies the §2 contract but throws away the actual signal.

**Remediation.** Render each page to a high-DPI PNG, embed each in the markdown body via `![Page N](page-NNN.png)`, and pack PDF metadata (title, author, pages, dimensions, creation date) into the §2 frontmatter callout. The slug becomes a §2-shaped image-bearing markdown document with one-image-per-page rather than a stub. Routing remains catch-all-friendly: any host that lets PDFs pass through `_default` gets rendering for free; sites with their own modules (arxiv, intuitionlabs) opt in by detecting `.pdf` URLs and delegating to `renderPdfFromUrl`.

**Engine: `mupdf` npm package** (official Artifex WASM bindings; v1.27 wraps the same MuPDF engine as pymupdf). Picked over poppler / pdftoppm after benchmarking on a typical arxiv paper:

- Render output is **byte-equal** to pymupdf at 150 DPI (same engine).
- Indistinguishable from poppler quality on text-heavy PDFs (poppler's edge is on CMap/CID-font corner cases that arxiv/cursor/intuitionlabs PDFs don't exercise).
- 14 MB node_modules footprint, no system deps, no Python subprocess overhead. Stays in the TypeScript dep tree.

**Render parameters:**

- **150 DPI** for letter-sized pages → 1275×1650 px PNG, sharp at native size + readable under 2× zoom. 72 DPI is too soft for body text; 300 DPI doubles the file size with no on-screen readability gain.
- **PNG, lossless**. JPEG q80 saves only ~10% with text-aliasing artifacts around glyph edges; not worth the quality loss.
- Average ~500 KB per page → 6 MB for a typical 12-page arxiv paper. 50-page threshold flags `_default-pdf-large`.

**Edge cases (each emits a typed stub via `makeStub`):**

| Failure mode | Flag | Detection |
|---|---|---|
| Encrypted PDF | `_default-pdf-encrypted` | `doc.needsPassword() === true` |
| Corrupt PDF (mupdf throws on load) | `_default-pdf-corrupt` | catch around `Document.openDocument` |
| All page renders threw | `_default-pdf-corrupt` | `renderedFiles.length === 0` |
| Some page renders threw | `_default-pdf-render-partial` (still good output, partial flag) | per-page try/catch counter |
| Curl couldn't download | `_default-pdf-fetch-failed` | curl exit non-zero or output < 64 B |
| > 50 pages rendered | `_default-pdf-large` (informational) | `pageCount >= 50` |

The encrypted path doesn't try to brute-force or prompt for passwords — there's no place to store one securely in the bulk-fetch loop, and the operator would need to decrypt locally and re-host anyway.

**Marker flag handling.** `pdf-rendered` is added to `NON_PROBLEMATIC_FLAGS` in `classifyQuality` (alongside `intentional-stub`) so a successfully-rendered PDF stays `quality_status=good`. The image-bearing body is the deliberate output; text-length floors don't apply (`short-body` / `below-host-expected-size` are skipped when `pdf-rendered` is in extraFlags). The failure-kind classifier also overrides the URL-shape `.pdf` → `upstream-not-html` rule when `pdf-rendered` is present, so the slug correctly classifies as `clean`.

**Generalization.** Three rules of thumb:

1. **Engine choice over CLI inertia.** "Use poppler because it's canonical" ignores that the codebase ecosystem matters: poppler needs `brew install`, pymupdf needs Python subprocess, npm mupdf is `import * as mupdf from "mupdf"`. Same render quality, single-ecosystem install.
2. **Match dispatch to existing patterns.** PDFs hit `_default`'s non-HTML branch first (Content-Type / magic-bytes detection already there from P-20); add a rendering hook there rather than inventing a new content-type-based router. Hosts with dedicated modules opt in by detecting the `.pdf` URL pattern at the start of their `fetch()` and delegating.
3. **Mark image-bearing slugs explicitly.** A slug whose body is `![Page N](…)` references is structurally clean even if the markdown text is short. Adding `pdf-rendered` to a small whitelist of "marker, not problem" flags keeps the quality machinery from misfiring.

**Reference.** `tools/sites/_default/pdf-render.ts` (`renderPdfFromUrl`). Hooks: `tools/sites/_default/index.ts` (Content-Type branch), `tools/sites/arxiv/index.ts` (`/pdf/` path branch), `tools/sites/intuitionlabs/index.ts` (`.pdf` URL pattern). Classifier: `tools/hirono/raindrop/failure-kind.ts` (URL-shape rule overridden by `pdf-rendered` flag presence). Marker flag: `tools/fetch-raw.ts:classifyQuality:NON_PROBLEMATIC_FLAGS`. Tests: `tools/__tests__/pdf-render.test.ts`. Doctor check: `tools/hirono/doctor.ts:mupdf`. Samples: `sweep-results/{arxiv.org,cursor.com,intuitionlabs.ai}/sample-pdf-rendered.md`.

P-36 is the **render path** for non-HTML; P-20 remains the **stub path** for non-HTML responses we genuinely can't extract (images, videos, archives). The two are siblings under the catch-all non-HTML detection; the renderer fires when the response is a PDF specifically.

---

### P-37 — Body-direct content (no `<article>` / `<main>` wrapper)

**Symptom.** A page returns substantive HTML (5+ KB of markup) with a real `<title>`, `<h1>`, and prose `<p>`/`<label>`/`<button>` elements, but `_default` extracts < 200 chars of body and the slug ends up as `_default-fetch-failed` (or `intentional-stub-app-only` via P-18's URL-pattern catch). Opening the URL in a browser shows clear documentation / instructions / form labels — the content IS there, the cascade just doesn't see it.

**Root cause.** `_default`'s body-selector cascade looks for `article, main, [role="main"], .prose, .post-content, .article-body, .content` — semantic article containers. Pages that put their content **directly under `<body>`** without one of these wrappers don't match any selector, the cascade falls through to its short-body threshold, and the slug emits a stub.

Concrete corpus example: `1cb887bb.pinit.eth.limo/` — Cloudflare IP filter tool, IPFS-hosted JS app. 11.8 KB HTML with `<h1>Cloudflare优选IP筛选工具</h1>`, instructions `<p>`, form `<label>`s and `<button>`s — all immediate children of `<body>`. No `<article>` or `<main>`. Cascade extracts 133 chars (just the page title leaking through), short-body threshold trips, slug becomes a stub. Content is genuinely there and readable; we just need a wider net.

Common shapes that hit this:

- Single-purpose JS tools (calculators, formatters, extractors) with embedded usage docs
- IPFS-hosted SPAs whose entry HTML is hand-rolled (no framework template)
- Very-old static HTML pages that predate the `<article>` element
- Hand-rolled landing pages with just enough content to describe the tool

**Remediation (manual, today — proven on the 1cb887bb slug).**

1. Read `<body>` HTML after stripping `<style>`, `<script>`, `<noscript>` (purely runtime; no extractable content).
2. Run turndown on the result. Form-element rules: `<button>` → plain `**bold**` (NOT `**[bold]**` — `[]` reads as link syntax in markdown). `<label>` → `**bold** ` followed by an inline-italic placeholder for the input field. `<input>`/`<textarea>`/`<select>` → italicized placeholder describing the field.
3. Write the §2 frontmatter callout above the converted body (origin URL + a "工具元信息" line describing the page shape — IPFS-hosted, JS web tool, runtime-populated, etc.).
4. Update `source.json`: clear `intentional-stub` and `_default-fetch-failed` flags, set `quality_status: "good"`, recompute `content_sha` + `content_length`, drop `error_detail`.
5. Slug now classifies as `clean` (the failure-kind classifier's app-only URL-pattern check is gated on `flags.length > 0`, so a clean extraction overrides the URL-pattern signal).

Reference output: `sweep-results/1cb887bb.pinit.eth.limo/sample-converted.md`.

**Remediation (automated, future).** Extend `tools/sites/_default/index.ts` body-selector cascade with `<body>` as a final fallback. Apply alongside aggressive dropSelectors (`style, script, noscript, nav, footer, aside, header`). Fire only when (a) no narrower selector matched AND (b) the body's text-after-strip exceeds a threshold (~300 chars) so SPA shells pre-hydration still go through the browser-eval path. Tracked in `Meta/post-fetch-todo.md`.

**Generalization.** Two heuristics for when the body-direct fallback should fire:

1. **The page IS its body.** If `<body>` directly contains the title, the H1, and the main prose — that IS the document. No `<article>` wrapper is going to exist later.
2. **Don't fall back when narrower selectors would work.** A page where `<article>` exists but is empty (SPA shell pre-hydration) shouldn't trip the fallback — the cascade already handles that case via browser-eval. The body-direct fallback is for pages that **never had** a semantic container.

Pages this pattern recovers usually still match P-18's URL-pattern check (hex-hash subdomain, `/tools/` path, etc.). What changes after the fallback: classifier sees prose-bearing flags=[], the URL-pattern app-only check (gated on `flags.length > 0`) doesn't fire, the slug classifies as `clean`. The URL pattern is right that it's an app — and now the documentation IS the archive.

**Reference.** Manual conversion proven on the `1cb887bb.pinit.eth.limo` slug — content.md hand-derived from the page's `<body>` after stripping `<style>`/`<script>`. Sample at `sweep-results/1cb887bb.pinit.eth.limo/sample-converted.md`. Automation TODO: extend `tools/sites/_default/index.ts` BODY_SELECTORS cascade per the heuristics above.

---

### P-38 — Multi-line link wrappers + run-together inline-link chains + avatar image-links (catalog/grid post-cleanups)

**Symptom.** Output markdown contains shapes that violate §3 contract:

- **Multi-line link wrapper:** `[![alt](src)\n\n    ](url)` — turndown emits an `<a>` opener that wraps an `<img>` plus subsequent siblings, producing a `[` + image + blank line + orphan `](url)` on its own line. CLAUDE.md §3 calls this out explicitly. `grep -c "^\s*\](" content.md` returns non-zero.
- **Run-together inline-link chain:** `[Label1](url1)[Label2](url2)[Label3](url3)…` — multiple `<a>` siblings rendered with no separator. Common on category lists / nav rows / breadcrumb trails. Reads as one long unbroken string.
- **Avatar image-link clutter:** `[![<author-name>](<avatar-img>)](<profile-url>)` — small profile avatars rendered as image-links to a profile page. CLAUDE.md §3 says strip (case 1, "drop whole unit"). The avatar pixel is decorative chrome AND the author-link adds catalog noise — neither carries archive value. Common on every catalog/feed/forum/grid page that surfaces author attribution.

Both shapes are common on **catalog / grid** pages where the page is a list of cards (each with image + title + author/category links) plus header navigation rows. 21st.dev community page (`https://21st.dev/community/components`) had 94 multi-line wrappers, 3 run-together chains, and 106 avatar image-links in a single 25KB extraction.

**Root cause.** Turndown's default rendering of complex `<a>` children (multi-paragraph or multi-element) produces the multi-line wrapper. Sibling `<a>` elements with no whitespace between them in source HTML render as adjacent inline links with no separator. Avatar `<a>` elements wrap a tiny profile image; turndown emits them as image-links because that's literally what they are in the DOM. All three are turndown-emission defects, not extraction-stage defects — the right fix layer is post-cleanup.

**Remediation.** Three new cleanups in `tools/sites/_shared/post-cleanup.ts`:

- `collapseMultiLineLinkWrappers` — regex match for `[INNER\s*\n\s*\n\s*](URL)` where INNER is a single-line `![alt](src)` image OR a short text run (≤80 chars). Refuses to fire when INNER's bracket count is unbalanced (regex false-positive guard). Collapses to single-line `[INNER](URL)`. Skips fenced code blocks.
- `stripAvatarImageLinks` — match BOTH the image-link form `[![<alt>](<img>)](<profile-url>)` AND the text-link residual `[<short-text>](<profile-url>)` (idempotent across re-runs). Drop the whole unit. The text-link variant is gated on `<short-text>.length ≤ 60` to avoid stripping long inline link runs that incidentally point at profile-shape URLs. After stripping, whitespace-only lines (4-space list indents left orphaned) are trimmed and `\n{3,}` runs collapsed. Discriminator: profile-shape URL with ≤2 path segments — `/<segment>`, `/@<segment>`, or `/(?:user|users|u|profile|people|members?|authors?|community)/<segment>`. Component-page URLs (3+ segments) don't match and survive.
- `splitAdjacentInlineLinks` — for lines ≥100 chars containing 4+ adjacent `)[…](` joins, insert ` · ` between each. Conservative thresholds avoid breaking real prose with occasional dense inline-link runs. Skips fenced code blocks.

All three run early in the post-cleanup chain (before `stripEmptyAnchorLinks` etc.) so subsequent cleanups see the simplified canonical form. Avatar simplification runs AFTER multi-line collapse but BEFORE split-adjacent — because avatar simplification reduces the number of adjacent image-links per line, which prevents split-adjacent from misfiring on legitimate icon-link rows.

**Generalization.** Three rules of thumb:

1. **Detect via `grep`, not visual inspection.** `grep -c "^\s*\](" raw/.../content.md` reliably surfaces multi-line wrappers. `grep -cE "\]\([^)]+\)\[[^!]" content.md` surfaces run-together link chains. Routine sweeps should include both.
2. **Multi-line wrapper collapse is safe at the post-cleanup layer.** The shape is a turndown emission defect; the inner image+url is correct, just split across paragraphs. Collapsing produces clean `[![alt](src)](url)` without losing content.
3. **Run-together split needs a high threshold.** Real prose can have 1-3 adjacent inline links naturally (e.g., a sentence with a reference + a follow-up reference). The `≥4 adjacent + ≥100 char line` gate keeps the split scoped to genuine catalog/nav rows.

If a site emits these shapes via a host-specific extraction quirk (DOM walker that misses paragraph boundaries), the host module's converter is the better fix layer. Post-cleanup catches the 80% cross-host case.

**Reference.** `tools/sites/_shared/post-cleanup.ts:collapseMultiLineLinkWrappers` + `:splitAdjacentInlineLinks`. Wired in at the top of `POST_CLEANUPS` array. Proven on `21st.dev/community/components` slug — collapsed 94 wrappers + split 3 chains, no false positives. Detection grep one-liner: `grep -c "^\s*\](" raw/.../content.md`.

---

### P-39 — Lazy-loaded images: scroll-trigger before extracting

**Symptom.** Image files saved alongside the markdown are tiny (1-6 KB) compared to what the page actually displays. `file <slug>-images/<name>.webp` reports dimensions like `100x*` or `300x*` instead of the typical 800-2000px-wide content image. Visual inspection of the rendered page shows much larger images.

**Root cause.** Modern sites use intersection-observer-driven lazy loading: the initial `<img src>` attribute is a small placeholder (e.g. `width-100` Google Cloud Storage thumb), and the high-res variant only loads into `<img src>` when the image scrolls into the viewport. Without scrolling — which curl-only extraction never does, and even default browser-eval extraction skips — the post-fetch DOM still shows placeholder URLs.

Concrete corpus example: `blog.google` ironwood-tpu article. The article has 4 images. Without scroll, the inline charts had `<img src=".../TPUv7_Inline_PeakPerformanceGraph.width-100.format-webp.webp">` — a tiny placeholder. With scroll, the same `<img>` upgrades to `.../TPUv7_Inline_PeakPerformanceGrap.width-1000.format-webp.webp` (note the truncated stem name; Google's CDN uses different filename conventions for higher-res variants). Result: image saved at 1.1 KB → 18.4 KB (10× larger) and `100x*` → `1000x*` (10× width).

**Remediation.** `_default`'s `browserFetch` now scrolls the page progressively (0% → 100% → 0% in 9 steps with 600ms pauses, ~5s total) BEFORE extracting outerHTML. Intersection observers fire at each scroll position, lazy-loaded images upgrade their `src` to high-res URLs, and the captured HTML reflects the post-scroll state. The extracted markdown then references the high-res URLs, which the image-download phase saves at native resolution.

The scroll cost (~5s) is paid on every browser-eval-routed fetch. Non-browser routes (curl-only article-shape sites going through the article-site factory) DON'T benefit from this — the factory is curl-only by design. Sites with substantive lazy-loading on the curl path stay sub-good for images until the factory grows browser-assist; tracked in `Meta/post-fetch-todo.md`.

**Generalization.** Three rules of thumb:

1. **Scroll-trigger is patience, not evasion.** It's exactly what a human reader's browser does — load the image when it scrolls into view. We're emulating organic browsing behavior to let the site's own JS deliver high-res. No fingerprint forgery, no UA spoofing.
2. **Scroll cost is bounded.** 9 steps × 600ms ≈ 5s. Every browser-eval fetch pays it. Acceptable on a long-tail bulk-fetch (single sites take 5-30s anyway); cheap relative to the image-quality improvement.
3. **CDN URL filename truncation is real.** Google Cloud Storage truncates long basenames at 32 chars when generating higher-res variants (`PeakPerformanceGraph` → `PeakPerformanceGrap` for `width-1000`). Don't try to guess high-res URLs from the placeholder URL — let the page's JS resolve them via lazy-load, then read the result.

**Diagnostic:** for any slug suspected of having low-res images, `file raw/raindrop/<host>/<slug>/*.{png,jpg,webp}` reports dimensions; flag any image < 400px wide that's clearly meant to be a content image (not an icon/avatar).

**Reference.** `tools/sites/_default/index.ts:browserFetch` (scroll loop before the extraction eval). Proven on `blog.google/products/google-cloud/ironwood-tpu-age-of-inference/` — 3 inline charts went from 100×*/1.1-1.4 KB placeholders to 1000×*/15-50 KB native variants. Article-site factory browser-assist is a future TODO.

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
- 404 / page-deleted detection — `looksLikeNotFoundPage(title, body)` (P-34)

### URL-pattern classifier (no fetch needed)
- App-only detection: `intentional-stub-app-only` via URL regex
- Reference: `tools/hirono/raindrop/failure-kind.ts` `APP_URL_PATTERNS`

### Pre-fetch URL rewrite
- Share-aggregator unwrap: `unwrapShareUrl(url)` extracts the real target from a query parameter and re-routes through the host-specific module (P-32)
- Reference: `tools/sites/_shared/url-unwrap.ts`

### Fetcher-pipeline structure
- L2-error stub-write: every L2 throw goes through `writeL2ErrorAsStub` so failed fetches still produce queryable source.json (P-35)
- Reference: `tools/fetch-raw.ts:writeL2ErrorAsStub` + the two wired-in throw sites (AUTO_SKIP loop + matchedSite.fetch try/catch)

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
   - Title is `404 Not Found` / `Page Not Found` / `Error 404` / `Sorry, this page isn't available`? Body says "The requested URL was not found"? P-34 not-found-page-detect — the resource is gone upstream, classify as `upstream-deleted`.
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
