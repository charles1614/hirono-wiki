# Site migration playbook

Practical recipe for adding a new host module under `tools/sites/<host>/`. This is the *how-to* — the *why* lives in [`CLAUDE.md`](../../CLAUDE.md) §5a–d. Read this when you are about to start a migration; cross-reference an existing module while you build.

References (read at least one end-to-end before writing your first line):

- `tools/sites/xhs/` — DOM source, no fetcher (HTML supplied by caller)
- `tools/sites/zhihu/` — DOM source, browser eval fetcher
- `tools/sites/weixin/` — DOM source, full-content extractor with image localization
- `tools/sites/github/` — REST API + raw URL paths, no browser

---

## 0. Decide if migration is worth it

Driven by `hirono raindrop check` — the bookmark count for the host is the payoff multiplier. Rule of thumb:

- **>10 bookmarks** — worth a per-host module.
- **3–10 bookmarks** — case-by-case. Migrate if the legacy output has known defects; otherwise leave on `web-read` fallback.
- **≤2 bookmarks** — long-tail. Don't migrate; let `web-read` handle it.

If the host shares a content engine with an already-migrated host (e.g. `wiki.litenext.digital` and `deepwiki.com` are the same DeepWiki page generator), migrate them together as one module.

## 1. Pick the source-of-truth (this decision sets the ceiling on quality)

| Source available | Use | Example |
|---|---|---|
| **REST/GraphQL API** returning structured data | direct `fetch` / `curl`; convert JSON → markdown | github (issue/PR/discussion/release APIs) |
| **Raw markdown** in a public repo or CDN | `curl raw URL`; pass through | github `/blob/`, huggingface mirror |
| **Stable selector on rendered HTML** (`#article-body`, `.Post-RichTextContainer`, `#js_content`) | opencli `browser open` + `browser eval` for `outerHTML`, then jsdom + turndown ourselves | weixin, xhs, zhihu |
| **Rendered page only, no API or stable selector** | last-resort `web-read`, treated as INPUT we still re-clean | rare |

opencli's MD output is **not** a valid source — it's lossy and opaque, and chasing its defects with downstream patches is the failure mode the universal pattern is designed to retire.

## 2. Scaffold the module

Three files, sometimes four:

```
tools/sites/<host>/
├── index.ts        ← Site contract: { name, match(url), fetch(url, opts) }
├── fetcher.ts      ← acquire raw content (HTTP / browser eval / API)
└── converter.ts    ← raw → §2 markdown (PURE FUNCTION, fixture-testable)
```

Optional `metadata.ts` if title/author/date extraction grows beyond a few lines.

**The Site contract** (`tools/sites/_shared/types.ts`):

```ts
export interface Site {
  name: string;                                          // for diagnostics + snapshot dir
  match: (url: string) => boolean;                       // host (or path-scoped) predicate
  fetch: (url: string, opts: FetchOpts) => Result;       // sync; the module owns side effects
}
```

`Result` MUST satisfy the §2 frontmatter contract (H1 title + `> 原文链接:` + `---` separator). Always include it — even stub results.

Register the new site in `tools/sites/index.ts` and wire `fetch-raw.ts` to route to `routeSite()` for the host.

## 3. The converter is the contract

The converter is a **pure function** of `(rawHtml | rawJson, metadata, url)` → `{ markdown, imagesToDownload, stats, metadata }`. No I/O. No browser. This is what the byte-equal fixture tests freeze.

Mandatory output shape:

```
# <Title>

> 原文链接: <url>
> [optional metadata: > **Authors:** ..., > Released by ... · date]

---

<body markdown>
```

Things every converter handles:

1. **Image localization** — emit `imagesToDownload: [{ remoteUrl, localFilename }]`; the index.ts wrapper handles the actual `downloadImage()` calls. Local refs use forward slashes, no leading `./`. Magic-byte sniffing for `.bin` outputs (see `_shared/` if/when it gets shared).
2. **Bold-colon normalization** — `**term：**` (or `**term:**`) → `**term**：` (or `**term**:`). Both weixin and zhihu hit this; bake it into your converter.
3. **Footnote references** — a-tags like `<a data-reference-link>[1]</a>` should become unicode superscripts (`¹²³…`), not `[\[1\]](#ref_1)`.
4. **Empty list-item collapse** — turndown sometimes emits `-   \n-   \n` chains for empty `<li>` decorations. Strip them.
5. **Leading `>` quotes inside table cells** — Feishu/lark-cli can't render quote-blocks inside table cells; either flatten to plain text or convert to `<callout>` later.
6. **Trailing blank line after `---`** — emit two newlines after the `---` separator. The §2 contract is strict.

## 4. The fetcher is glue

For browser-based fetchers, the pattern is:

```ts
opencli browser open <url>          // status check; sleep ~3.5s for JS-rendered pages
opencli browser eval "(() => { ... return JSON.stringify({...}); })()"
```

Notes from prior migrations:

- The eval script's output gets prefixed with opencli logs — find the first `{`, walk to the matched `}` (track string + escape state), then JSON.parse the slice.
- 3500ms sleep after open is the floor for SPA-rendered pages. DeepWiki needs more (~20s — it does dynamic mermaid rendering).
- Always set `maxBuffer: 32 * 1024 * 1024` on the eval spawnSync; default is 1MB and trips on long articles.
- Browser timeouts via `browserTimeoutMs("open" | "eval")` from `fetch-raw.ts` — they read site-specific overrides from a registry there.
- On any failure, return a `stubResult()` with `flags: ["intentional-stub", "<host>-fetch-failed"]`. Stubs still satisfy the §2 contract.

For API-based fetchers (github), there is no browser. Just `fetch()` (or `curl` via spawnSync) the JSON, hand off to converter. Hold a structured `metadata` blob (status, labels, branches, diff stats) and put it in frontmatter — REST data that the API gives you for free should never be re-derived from rendered HTML.

## 5. Iterate on output quality (the loop)

This is the longest phase. Workflow:

```
fetch URL #1 → eye-read content.md → spot defect → fix converter → re-fetch → repeat
                                                                  ↓
                                                         (bypass cache: rm -rf raw/<slug>/)
```

Don't capture fixtures yet. Fixtures freeze whatever output exists; if you freeze defects, you bake regressions into the test gate.

Self-iteration target before user eye-review: 3 representative URLs covering distinct content shapes (text-heavy, image-heavy, code-heavy, table-heavy — pick what the host emits). For each:

- H1 present and accurate
- `> 原文链接:` line in first 10 lines
- No remote `![](http://...)` refs (all images localized)
- No bare chrome lines (`Subscribe`, `订阅`, `Share`, `分享`, ...)
- No `\*{3,}` runs or odd `**` counts outside code (unbalanced bold)
- No empty `## ` heading lines (H1-demotion artifact)
- Code fences have language tags where the source provided them
- Tables render as `|---|---|` markdown
- Footnote refs are unicode superscripts, not `[\[N\]](#ref_N)`
- Lead/trail of body matches the article flow (no nav chrome bleeding through)

Common defects to fix in the converter (not in a downstream post-processor):

| Defect | Fix |
|---|---|
| `[\[1\]](#ref_1)` ugly footnote | regex unwrap to unicode superscript |
| `**效果：**` colon inside bold | regex `\*\*([^*\n]+?)([:：])\*\*` → `**$1**$2` |
| Missing blank line after `---` | append empty string to frontmatter array before `.join("\n")` |
| Image `.bin` extensions | sniff magic bytes; rename to .png/.jpg/.gif/.webp/.svg |
| Activity-log entries leaking through (github) | filter `<div>` blocks by class before HTML→MD |
| `<text color="green">X</text>` raw HTML in MD | strip color tags or convert to `{green:X}` shorthand for lark-hirono |

## 6. Show the user — get explicit approval before locking

When you think the output is good across all 3 samples:

1. Open each `raw/<slug>/content.md` and skim head + tail in your own response.
2. State explicitly: "I think these 3 are ready for eye-review." Show the user the file paths.
3. **Wait for approval.** Don't capture fixtures or snapshots until the user says it looks right.

This step exists because preferences (what's content vs chrome, how aggressive to be on emphasis stripping, when to keep / drop a UI element) aren't knowable from the markdown alone. Locking tests around bad output is the worst-case outcome — you spend the next month explaining why a "passing" test still produces garbage.

## 7. Lock with fixtures (after approval)

Two layers of test coverage to add:

```bash
# Byte-equal converter fixtures (per CLAUDE.md §6b workflow):
npx tsx tools/__tests__/capture-fixtures.ts <host> <name> <url>
# Capture ≥3 fixtures covering distinct content shapes.

# Per-host snapshot:
npx tsx tools/__tests__/snapshot-create.ts <url> --slug <slug>
# Refuses on hard-rule defects; eye-read top + tail before commit.
```

If `capture-fixtures.ts` doesn't have a case for your host yet, add one (see CLAUDE.md §6b "Adding fixture support for a NEW converter").

Run `npm test` 3 times back-to-back. Test count must be identical and `fail = 0` every time. If it varies, you have a path-resolution bug (`fileURLToPath(import.meta.url)`, not cwd-relative literals — see commit `4ca244e`).

## 8. Retire legacy code in the SAME commit

When the new site module ships, the old code paths it replaces become dead code:

- Adapter case in `fetch-raw.ts` for the host
- Site-specific post-processor in `tools/hirono/shared/post-process.ts` (e.g., `githubStripUIChrome` retired in 46c7be0)
- Adapter file in `tools/opencli-adapters/` if the host had a custom one

Delete them in the same commit as the migration. Carrying them as "just in case" is technical debt that grows.

## 9. Commit shape

One host per commit. Title: `sites: <host> migrated to per-host module (<source>, no web-read)`. Body lists what landed and what got deleted. Reference the prior migration commit when retiring the legacy processor.

---

## Quick reference: file roles

| File | Type | What lives here |
|---|---|---|
| `index.ts` | thin orchestrator | Site contract export, calls fetcher → converter → image download → result |
| `fetcher.ts` | I/O boundary | opencli spawn / fetch / curl; returns raw HTML or JSON |
| `converter.ts` | pure function | jsdom + turndown + per-site rules; emits markdown + image refs |
| `metadata.ts` (optional) | pure function | when title/author/date logic exceeds ~30 lines, extract here |

## Quick reference: anti-patterns to refuse

- "I'll just patch opencli's MD output for this host" → no. Universal pattern from the start.
- "I'll capture fixtures now, then iterate the converter" → no. Iterate first, capture last.
- "This defect is a one-off, I'll fix it as a downstream post-processor" → no. Defects belong in the host's converter.
- "The legacy adapter still works, I'll leave it as a fallback" → no. Delete it in the migration commit.
- "Snapshot test passing means the output is correct" → no. Snapshot tests catch *regressions from a frozen baseline*. Output correctness comes from eye-review.
