# Fetcher architecture: site modules, opencli, and what "legacy" means

> **Audience.** Operators of `tools/fetch-raw.ts` and contributors writing new site modules under `tools/sites/<host>/`. Read CLAUDE.md §5a–e first; this doc is the architectural overview those sections refer to.

> **TL;DR.** The "legacy" path is *not* opencli. The legacy path is taking opencli's lossy markdown output (`web-read`) and patching it downstream with regex post-processors. opencli's *browser session* (`browser open` + `browser eval`) is a load-bearing piece of the modern architecture — multiple migrated site modules use it. We separated the two because conflating them is what produced years of un-fixable cleanup-recipe bugs.

---

## 1. The four data sources we actually use

Every URL we fetch falls into one of four buckets. The bucket determines which fetcher the site module reaches for, and which post-processing primitives apply.

| # | Source | When to use it | Examples |
|---|---|---|---|
| **A** | **REST / GraphQL API** | Host exposes structured JSON for the content we want | `github.com` (issue/PR/discussion/release APIs) |
| **B** | **Raw markdown mirror** | Host's content originates as markdown in a public repo / CDN | `huggingface.co/blog/*` → `raw.githubusercontent.com/huggingface/blog`; `github.com/<o>/<r>/blob/` → `raw.githubusercontent.com` |
| **C** | **Server-rendered HTML with stable selectors** | Plain `curl` returns the body inside a known container | `aleksagordic.com` (`.prose`); `lmsys.org` (`.blog-post-content`); `qwenlm.github.io` (`.post-content`); `arxiv.org/abs/` (`<blockquote class="abstract">`); `substack.*` (`.available-content`) |
| **D** | **Client-rendered SPA** | Plain curl returns a JS shell with no body content; needs a real browser to hydrate the DOM | `xiaohongshu.com` / `xhslink.com`, `mp.weixin.qq.com`, `zhuanlan.zhihu.com`, `qwen.ai` |

A and B are pure data — no chrome, nothing to clean. The site module fetches the source, optionally maps API JSON into our §2 markdown contract, and returns.

C is the article-shape majority. The site module is a `curl` + JSDOM extraction with a per-host body selector and chrome-stripping list. The `_shared/article-site-factory.ts` collapses this case to a 15-line config.

D is where "browser-eval" enters. Plain curl can't see the content — only a headless browser running the page's JavaScript can. **This is where opencli's browser session is genuinely needed and not a legacy crutch.**

---

## 2. What opencli is

opencli is an external CLI tool we install separately (it has its own auth flow, persistent browser sessions, login state for sites like xhs / weixin / zhihu). We use it for **two distinct things** that are easy to conflate:

```mermaid
flowchart LR
    subgraph opencli["opencli (external tool)"]
        BO["browser open URL"]
        BE["browser eval JS"]
        WR["web-read URL<br/>(returns markdown)"]
        BO -->|"navigates,<br/>holds session"| BE
    end

    subgraph our_code["Our code"]
        SM["Site module<br/>fetcher.ts"]
        LP["Legacy path<br/>fetch-raw.ts<br/>fetchWebReadViaAdapter"]
    end

    SM -->|"sync spawn:<br/>open + eval(outerHTML)"| BO
    SM -->|"raw HTML<br/>back to module"| BE
    LP -->|"web-read returns<br/>opencli's markdown"| WR

    SM -->|"our jsdom + turndown<br/>+ per-site rules"| Result1["§2 markdown"]
    LP -->|"regex post-processors<br/>patch opencli's output"| Result2["§2 markdown<br/>(after N cleanup passes)"]

    style WR fill:#fdd,stroke:#f00
    style LP fill:#fdd,stroke:#f00
    style Result2 fill:#fdd,stroke:#f00
    style BO fill:#dfd,stroke:#0a0
    style BE fill:#dfd,stroke:#0a0
    style SM fill:#dfd,stroke:#0a0
    style Result1 fill:#dfd,stroke:#0a0
```

**Green path (modern, target):** site module spawns `opencli browser open <url>` to navigate (using opencli's session/login state), then `opencli browser eval '<JS>'` to extract the `outerHTML` of the right container. Our code converts that HTML to markdown using `jsdom` + `turndown` + per-site rules we control. **opencli handed us structured DOM; we own the conversion.**

**Red path (legacy):** `tools/fetch-raw.ts:fetchWebReadViaAdapter` calls `opencli web-read <url>` — opencli's *own* DOM-to-markdown converter runs inside opencli, and we get back markdown that's already been munged. We then apply N regex post-processors (`tools/hirono/shared/post-process.ts`) to undo the worst of opencli's lossy choices. **opencli decided the markdown shape; we patch.**

The two paths use the same external tool but differ in *who owns the HTML→Markdown conversion*. That ownership question is the architectural axis the redesign turns on.

---

## 3. Why "patch opencli's markdown" is the legacy path

The recipe failures CLAUDE.md §3–4 cataloged trace back to the same shape: opencli's `web-read` flattens DOM features that have no markdown equivalent or that turndown-via-opencli mishandles, and there's no way to recover the lost structure from the markdown after the fact.

| Defect class | What opencli `web-read` produced | Why post-processors couldn't fully fix it |
|---|---|---|
| **Mermaid diagrams flattened** | DeepWiki diagrams emerged as orphan `Cluster GPU Resources\n[actor_num_gpus : actor+critic_num_gpus]` text paragraphs outside any `\`\`\`mermaid` fence | The mermaid source is gone — only the rendered SVG node-labels remain. We had to write a side-channel extractor (`extractDeepwikiMermaidSources`) that pulls source from `<script>` hydration JSON or `data-original-text`, then *splice* it back into the markdown. A regex pass over the markdown alone can't recover deleted information. |
| **WeChat code blocks merged to one line** | Multi-line code split via `<br>` tags inside `<pre>` collapsed to a single `Node.textContent` blob | turndown saw `<pre><code>line1<br>line2<br>line3</code></pre>` and emitted `\`\`\`\nline1line2line3\n\`\`\``. The newlines are gone after this point. We rewrote the WeChat path as a Layer-4 own-converter that walks the DOM with `<br>` awareness *before* turndown sees it. |
| **xhs body never present** | xhs renders body via JS after token validation; opencli `web-read` returned the auth-wall shell | No regex over the shell can recover the body. We migrated xhs to a Layer-4 own-converter (`extractXhsFullContent`) that runs `browser open + eval` ourselves and pulls `#detail-desc` outerHTML directly. |
| **GitHub PR activity events leaking through** | opencli emitted timeline events as bullet lists alongside human comments | Activity-event regex in `githubStripUIChrome` had to handle 4 prefix shapes (avatar-stripped, avatar-kept, plain, indented) because the input shape varied with which earlier post-processors had run. Order of cleanup steps became load-bearing. We migrated GitHub to a REST API path that produces a clean structured input. |
| **Adjacent `<strong>` siblings double-emit** | `<strong>A</strong><strong>B</strong>` → `**A****B**` (4 asterisks) | `\*{4,}` collapse is mostly safe, but inside fences it's wrong. Fence-awareness is a small foothold — but the deeper problem is the same: turndown ran upstream of us and made a choice we now have to recognize and undo. |

The pattern: **information loss runs downhill**. By the time we receive markdown, we can't ask "is this an `<img alt="emoji shortcode">` that should be `:emoji:`, or text content that happens to contain `:emoji:`?" We can only pattern-match the *symptom* and hope our regex isn't a false positive on real content.

The site-module pattern keeps the conversion ours end-to-end. When a defect appears, the fix is in the site's `converter.ts` (a pure function over the DOM), not as the 14th post-processor in a global pipeline whose ordering matters.

---

## 4. The dispatch flow

```mermaid
flowchart TB
    URL["Incoming URL<br/>(e.g. from raindrop export)"] --> Router{routeSite(url)<br/>walks SITES[]<br/>returns first match}

    Router -->|"matched"| SM["site.fetch(url, opts)"]
    Router -->|"no match"| Legacy["DISPATCH_RULES lookup<br/>(fetch-raw.ts)"]

    SM --> Bucket{Source bucket<br/>per §1}
    Bucket -->|"A: API"| FetchAPI["curl + JSON<br/>(github)"]
    Bucket -->|"B: Raw MD"| FetchRaw["curl raw URL<br/>(huggingface)"]
    Bucket -->|"C: Stable HTML"| FetchHTML["curl + JSDOM<br/>(article-site factory)"]
    Bucket -->|"D: SPA"| FetchBrowser["opencli<br/>browser open + eval<br/>→ outerHTML<br/>(xhs, weixin, zhihu)"]

    FetchAPI --> Conv["per-host converter.ts<br/>pure function:<br/>raw → §2 markdown"]
    FetchRaw --> Conv
    FetchHTML --> Conv
    FetchBrowser --> Conv

    Conv --> Result1["Result {markdown,<br/>imagesToDownload,<br/>metadata, flags}"]

    Legacy --> Adapter{"web-read adapter<br/>(case 'web-read')"}
    Adapter -->|"opencli web-read"| Lossy["lossy markdown<br/>(opencli's converter)"]
    Lossy --> PP["applyPostProcessors<br/>(regex pipeline)"]
    PP --> Result2["§2 markdown<br/>(after cleanups)"]

    Result1 --> Final["raw/2026/<slug>/content.md"]
    Result2 --> Final

    style FetchBrowser fill:#dfd,stroke:#0a0
    style FetchHTML fill:#dfd,stroke:#0a0
    style FetchRaw fill:#dfd,stroke:#0a0
    style FetchAPI fill:#dfd,stroke:#0a0
    style Conv fill:#dfd,stroke:#0a0
    style Legacy fill:#fdd,stroke:#f00
    style Adapter fill:#fdd,stroke:#f00
    style Lossy fill:#fdd,stroke:#f00
    style PP fill:#fdd,stroke:#f00
```

The router is the single entry point. If a site module matches, the URL never reaches the legacy path. The legacy path exists only for hosts not yet migrated (or that genuinely belong there — see §6).

**Critical:** site modules using browser-eval (xhs, weixin, zhihu) **are on the green path**. They are not legacy. The defining question is who owns the HTML→Markdown conversion, not which subprocess fetched the bytes.

---

## 5. Anatomy of a site module

Each `tools/sites/<host>/` is self-contained. The module owns the FULL pipeline from URL to `Result`.

```mermaid
flowchart LR
    Router["routeSite(url)"] -->|"matched"| Index["index.ts<br/>{ name, match, fetch }"]
    Index --> Fetcher["fetcher.ts<br/>(may inline in index.ts)"]
    Fetcher -->|"raw HTML or JSON"| Converter["converter.ts<br/>PURE FUNCTION"]
    Converter -->|"markdown +<br/>imagesToDownload[]"| ImgDL["index.ts iterates<br/>imagesToDownload<br/>downloadImage()"]
    ImgDL --> Result["Result"]

    subgraph testable["Fixture-testable boundary"]
        Converter
    end

    subgraph io["Side effects (I/O)"]
        Fetcher
        ImgDL
    end

    style testable fill:#dfd,stroke:#0a0
    style Converter fill:#dfd,stroke:#0a0
```

**The converter is a pure function.** This is the single most important architectural rule. It takes raw HTML (or JSON) + URL + metadata and returns `{ markdown, imagesToDownload, stats }`. No `fetch`, no `spawnSync`, no filesystem — just data in, data out.

Why: the converter is what the byte-equal fixture tests freeze (`tools/__tests__/fixtures/converters/<site>/<name>.input.json` → `<name>.expected.md`). If the converter touches the network, fixtures aren't reproducible. If the converter writes images to disk, the fixture can't run in a fresh checkout without side effects. Image *download* belongs in `index.ts` (the orchestrator); image *URL extraction and filename allocation* belongs in `converter.ts`.

The fetcher and the image downloader are the I/O boundary. They may use `spawnSync("opencli", ...)`, `curl`, `fetch`, whatever — none of that is fixture-relevant because the fetcher's output is the converter's frozen input.

This split is what makes the architecture *testable*: a 99% byte-equal converter test catches converter regressions deterministically, without a network call. A snapshot test (re-running the full pipeline against a real URL) catches fetcher regressions when run periodically.

---

## 6. When to migrate, when to leave on the legacy path

The migration target is **the legacy path's red boxes get smaller over time**, not zero. Migration is gated by *payoff*, not driven to completion.

Migrate a host when ANY of:

- The legacy `web-read` produced an unfixable defect (lost code blocks / tables / mermaid; doubled markers; paragraph collapse) and the fix needs structural work, not regex patches.
- The host has a cleaner source-of-truth (REST API / raw mirror / hydration JSON / DOM attrs / linked downloads) the legacy path doesn't use.
- The host shares a content engine with an already-migrated host.
- The bookmark count is high enough that consolidating logic in one place pays back the migration cost (see `tools/sites/MIGRATION.md` §0).

Legitimately *don't* migrate when:

- The host is a simple article and `web-read + smallChromeCleanup` already produces clean output. Forcing it into a site module adds code without adding quality. (This was the pre-redesign failure mode — pattern-purity ahead of payoff.)
- The host produces only stubs (auth-gated, removed pages) and the existing stub-producing post-processor is correct. Examples: `*.feishu.cn`, `notion.so`, parts of `x.com`, parts of `reddit.com`.
- The host is a one-off in the bookmark set (≤2 entries) and the legacy output is acceptable.

The active legacy-path hosts as of the most recent migration sweep:

| Host | Why it stays | Migration plausibility |
|---|---|---|
| `qwen.ai` | JS-only SPA shell — needs browser-eval. Real Qwen blog content lives at `qwenlm.github.io` (already migrated). | Medium — needs a browser-eval site module |
| `x.com` / `twitter.com` | Substantial conversion logic in `xMetadataStub` (auth-gated stub + visible-content card layout) | High — would be a rewrite, not a port |
| `reddit.com` | `redditReformat` handles deleted/blocked stubs + thread cleanup | Medium |
| `*.feishu.cn` | Auth-gated stub — substantive content not extractable without lark-hirono | Low value |
| `anthropic.com` | Single-purpose SVG-explosion stripper | Low effort, low priority |
| `sebastianraschka.com` (non-gallery) | Scoped post-processor for the blog area | Could move to factory |
| `huggingface.co` (non-`/blog/`) | Model card / dataset page chrome | Different shape per page kind |
| `arxiv.org` (non-`/abs/`, `/pdf/`) | Listing pages + PDFs | PDFs need extraction, not conversion |
| `*.readthedocs.io/.org` | Generic Sphinx-anchor stripper | Could move to factory |

---

## 7. The post-processor pipeline today

Even with the migrations, `tools/hirono/shared/post-process.ts` still exists and runs. Three categories of processors live there:

```mermaid
flowchart TB
    SiteOutput["Site module output<br/>(or legacy web-read output)"] --> PP["applyPostProcessors"]

    PP --> P1["GENERIC: cross-host primitives<br/>match: () => true<br/>strip-empty-anchor-links<br/>resolve-relative-image-urls<br/>enforce-single-h1<br/>strip-color-tags"]

    P1 --> P2["LEGACY: scoped to<br/>not-yet-migrated hosts<br/>match: (u, h) => h === '...'<br/>arxivStripTrailingChrome<br/>redditReformat<br/>xMetadataStub<br/>anthropicStripSvgExplosion"]

    P2 --> P3["RETIRED: match returns false<br/>kept as referenceable code<br/>blogGoogleCleanup<br/>lmsysCleanup<br/>intuitionlabsCleanup<br/>sspaiCleanup<br/>substackReformat"]

    P3 --> Out["finalMarkdown"]

    style P1 fill:#dfd,stroke:#0a0
    style P2 fill:#fec,stroke:#fa0
    style P3 fill:#eee,stroke:#888
```

- **Generic** processors (`match: () => true`): apply to every URL regardless of source. These are universally useful (e.g. resolving relative image URLs to absolute, enforcing one H1 per document). They run on site-module output too — which is fine, because the operations are idempotent and don't mangle correct input.
- **Legacy-host-scoped**: still active for hosts not yet migrated. As migrations land, these flip to `match: () => false`.
- **Retired**: `match: () => false` but the transform code is preserved. They live on as reference material in case a similar shape resurfaces on a new host.

The tests in `__tests__/post-process-fixtures.test.ts` cover all three categories. Retired processors keep their tests so the regression coverage doesn't drift.

---

## 8. Putting it together: the universal pattern restated

For any URL, the question to ask is:

> Where does the cleanest source of this content live?

In order of preference:

1. **Structured API or raw markdown** (buckets A, B above) — use it directly. opencli does not enter the picture.
2. **Server-rendered HTML with a stable selector** (bucket C) — `curl` it, run our own JSDOM + turndown. Use the article-site factory for blog-shape pages; write a custom converter for richer shapes (catalog tables, gallery cards, mermaid-heavy wikis).
3. **SPA / auth-gated dynamic content** (bucket D) — use `opencli browser open + eval` to get the rendered DOM, then run our own converter on the `outerHTML`.
4. **Last resort, no good source available** — `opencli web-read` (the legacy path). Acceptable only when 1–3 are all impossible AND the lossy markdown is good enough for the host's content. Migrate out if a defect appears.

The architecture's promise: **defects in a site's output have a single clear owner — the site's own converter** (or, for buckets A/B, the API/mirror itself, which is upstream of us). Cross-cutting regex pipelines patching opaque opencli output are no longer an acceptable answer for new defects.

---

## See also

- [`CLAUDE.md`](../CLAUDE.md) §5a (universal pattern), §5e (direction-finding for new hosts), §6b (test architecture).
- [`tools/sites/MIGRATION.md`](../tools/sites/MIGRATION.md) — step-by-step recipe for migrating a new host.
- [`tools/sites/_shared/article-site-factory.ts`](../tools/sites/_shared/article-site-factory.ts) — the 15-line per-host factory for bucket C.
- [`tools/sites/_shared/article-converter.ts`](../tools/sites/_shared/article-converter.ts) — the shared converter the factory drives.
- [`tools/sites/_shared/types.ts`](../tools/sites/_shared/types.ts) — the `Site` contract every module exports.
- Reference modules to read end-to-end before writing your first one:
  - `tools/sites/aleksagordic/` — simplest factory user (15-line config)
  - `tools/sites/huggingface/` — bucket B (raw markdown mirror)
  - `tools/sites/github/` — bucket A (REST API)
  - `tools/sites/xhs/` — bucket D (browser-eval SPA)
  - `tools/sites/deepwiki-com/` — bucket C with mermaid splice + table splice (the recipe-heavy end of the spectrum)
