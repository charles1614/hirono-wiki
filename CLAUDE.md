# CLAUDE.md

Quality rules and fix recipes for raw-content fetchers (`tools/fetch-raw.ts`, `tools/sites/_shared/post-cleanup.ts`). Scan the checklists, match symptoms to fixes, don't re-derive from scratch.

## Where to look

Match your intent to the canonical doc; don't re-derive what's already written down.

| Intent | Read |
|---|---|
| Run / understand the operator pipeline (`hirono raindrop refresh-cache`, `fetch-all`, `sync`, `status`, daily/weekly cadence) | [`Meta/operator-workflows.md`](Meta/operator-workflows.md) |
| Triage a sub-good site, build a new site adapter, or look up a specific defect pattern (SPA hydration, auth-walled, mermaid splice, etc.) | [`Meta/site-handling-patterns.md`](Meta/site-handling-patterns.md) — symptom→cause→remediation index |
| Architectural overview of the fetcher (site module contract, `_default` catchall, opencli vs legacy) | [`docs/fetcher-architecture.md`](docs/fetcher-architecture.md) |
| Step-by-step recipe for a new per-host site module | [`tools/sites/MIGRATION.md`](tools/sites/MIGRATION.md) |
| Pending punch-list after the most recent bulk fetch | [`Meta/post-fetch-todo.md`](Meta/post-fetch-todo.md) |
| Wiki page conventions (frontmatter, page types, tier rules — the governance layer for `Sources/`, `Entities/`, `Topics/`) | [`Meta/schema.md`](Meta/schema.md) |
| Known drift / contradictions / cleanup TODOs across the wiki | [`Meta/linting-notes.md`](Meta/linting-notes.md) |
| What this file (`CLAUDE.md`) covers | the section list immediately below — quality rules, fidelity check, output contract, formatting rules, fix recipes, regression set, code pointers |

This file deliberately overlaps with the docs above on a few load-bearing topics (output contract, fidelity checks, fix recipes) — those are the rules that should fire on every commit, regardless of whether the operator opened the workflow / patterns docs first. When in doubt about a workflow or a per-site fix, defer to the dedicated doc.

## Before shipping anything — read this first

Fidelity before cleanliness, always. I've shipped "clean-looking" outputs that were missing 30+ lines of content every time I skipped this order.

**Five failure modes I keep hitting**:

1. **Validating against my mental model, not source truth.** A 1,645-line prose output can be missing all 28 code blocks; fence count = "looks right", feature count against source = "broken". Always diff against source.
2. **Greps that match what I wanted to strip, not what's in the file.** If my cleanup regex says `^- NAME verb` but the file has `[@user](/user) - NAME verb`, my "0 activity lines" report is a lie. Validate with `grep -vE 'known-good-only' <file>` to surface what slipped through.
3. **Post-processing is subtractive.** If opencli dropped whole structural categories, no regex recovers them — use an extraction fallback (API / raw / git mirror), not another cleanup pass.
4. **Declaring victory on the manifest, not the output.** `source.json` notes "spliced 3/3 mermaid + 3/3 tables" and I call it done — but never opened the `.md` file. Mechanism-level success ("splicer ran") ≠ output-level success ("markdown reads well"). Every claim of "pass" must be grounded in the final file, read end-to-end. Deepwiki splicer shipped with duplicate cell-runs below every spliced table; the manifest said 3/3; the user had to point it out.
5. **Cleanup creates its own artifacts.** Removing a cell-run leaves the `**Label:**` bold lead-in orphaned. Stripping a nav block leaves stray blank lines. Splicing a table leaves a double-blank gap after the heading. Every removal/insertion needs a boundary-check on the paragraph immediately before and after.
6. **Substring assertions are not UI tests.** `assert.match(r.md, /Foo Bar/)` + `assert.match(r.md, /@foo/)` both pass even when "Foo Bar" and "@foo" are 4 paragraphs apart in a stew of half-stripped link wrappers. A green test suite is a necessary gate, not a sufficient one — eye-read the actual output before declaring done. When converting conversational/threaded content, assertions must check rendered SHAPE (`/^\*\*Foo Bar\*\* \[@foo\]\(.*\) · \[date\]\(.*\)$/m`), not just substring presence. The x.com cleaner shipped twice with passing tests before the second pass actually produced a readable thread — the first pass had multi-line link-card wrappers and 4-paragraph-per-tweet whitespace that the substring tests missed entirely.

## 1. Fidelity check (ALWAYS run first)

Count features in output, compare to source. Any category zero in output but non-zero in source → extraction failure, needs a fallback.

```bash
f=raw/raindrop/<host>/<slug>/content.md
echo "lines=$(wc -l < $f)  chars=$(wc -c < $f)" \
     "fences=$(grep -c '^```' $f)" \
     "tables=$(grep -c '^|' $f)" \
     "images=$(grep -oE '!\[' $f | wc -l)" \
     "headings=$(grep -c '^#' $f)" \
     "FM=$(head -5 $f | grep -c 原文链接)"
```

For source-truth: use raw/API when available (clean markdown); curl HTML only as last resort (feature counts are proxies: `<pre>`, `<table>`, `<img>`).

**Questions in order**:
1. Any feature count 0 in output but non-zero in source? → fallback needed.
2. Output `wc -c` < 80% of source body `wc -c`? → real content removed (not chrome).
3. Every H2/H3 in source also in output? → `diff <(grep -E '^#{1,3} ' src) <(grep -E '^#{1,3} ' out)`.
4. Exactly one `# ` H1 in the output? → `grep -c '^# ' $f` must equal 1 (the frontmatter title). A second H1 from the source's own page-title block is a contract violation — demote or strip.

If any fail, STOP. Extraction fix, not cleanup.

**Treat every `0` in the counts line as a STOP, not a data point.** "Plausible for a prose article" is how I rationalized `tables=0` on a zhihu article that had two comparison tables flattened into per-cell paragraphs. The counts are a pass/fail test, not a readout. For any column that's 0, spend 30s on the source: `curl -sfL <url> | grep -oE '<table|<pre|<img' | sort | uniq -c`. If the source has non-zero instances and the output has zero, that's an extraction bug, full stop — no "maybe this article just doesn't have any."

**After counts pass, read the output.** Counts are necessary but not sufficient. Before declaring done: skim the first 30 lines (chrome at top?), last 30 lines (chrome at tail?), and one mid-document section around each spliced element (orphan lead-ins? missing blank lines around fences/tables? doubled blank lines after headings?). If I can't spot these in counts, I have to read the text.

**Per-host regression gate**: each adapter-covered host has a snapshot at `tools/__tests__/snapshots/<host>/<slug>.md` paired with a `<slug>.invariants.json` sidecar (feature counts captured at snapshot time). The test suite asserts feature-count invariants, not byte equality, so legitimate editorial revisions don't flake. When a snapshot test fails: re-fetch fresh, diff against snapshot, decide site-changed vs adapter-regressed (per the regression-triage workflow in the per-site plan).

## 2. Output contract

Every fetched source must produce markdown in this shape:

```markdown
# <Title> [· <org>/<repo>] [· Issue #NNN]

> 原文链接: <source URL>
[> <one-line metadata — released by / authors / date — if available>]

---

[body]
```

For conversation-style pages (PR / issue / discussion), body uses the **split speaker format**:

```markdown
## <username>

> opened this [discussion] on <Mon D, YYYY> [· <Role>]

<body markdown — H3 and below>

## <other-username>

> commented on <Mon D, YYYY> [· <Role>]

<comment body>
```

Discussion replies use `> replied on ...` (distinct from `> commented on ...` so threading is visible).

## 3. Formatting rules (do not re-ask)

- **No `**bold**` inside headings or already-emphasized text.** "When everything is bold, nothing is emphasized." Applies to H2/H3/H4, list-item leaders that are already bold, etc.
- **Attribution is a blockquote below the name heading, not part of the heading.** `## qgallouedec\n\n> opened this on Jun 1, 2025 · Member` — NOT `## qgallouedec opened this on Jun 1, 2025 (Member)`.
- **PR / issue / discussion bodies contain only OP + comments.** No activity timeline (merged / added label / mentioned this / self-assigned / closed / pushed / reopened / etc.), no reviewer rows, no participant avatars, no emoji-reaction counts. If it isn't a contentful message from a human or bot, strip it.
- **Heading hierarchy follows the outline.** Speakers at `##`, their body at `###`+, sub-subsections at `####`+. When injecting a speaker heading, demote the body's existing `##` → `###` so nothing outranks its parent.
- **Backticks for semantic tokens only.** Commit SHAs (`` `c0925be` ``), label names (`` `enhancement` ``), paths, flags. Not actor names, not dates, not section titles.
- **Avatars: strip.** Three DOM shapes (below). For `/username`-style relative links with no non-image text, DROP the whole unit. For external links (badges, shields), keep `[alt](url)` so the label survives.
- **Images: all local.** Never ship a `![](https://...)` remote URL. Any URL surviving to final output means `processImages` didn't see it. New adapters must pipe their markdown through `processImages` before returning.
- **Stubs are a deliberate output, not a failure.** Auth-gated, interactive-app, or page-removed pages produce a stub template (below) AND the processor emits `extraFlags: ["intentional-stub"]`. classifyQuality strips the flag and suppresses size-based flags.
- **Raw files are user-visible too.** `raw/<slug>/content.md` is not an internal cache — it's opened for inspection. Defects belong in the host's converter under `tools/sites/<host>/converter.ts` (DOM level, before turndown), NOT as downstream regex patches. The shared post-cleanup pipeline (`tools/sites/_shared/post-cleanup.ts`) does host-agnostic cosmetic fixes only.
- **Splicer insertions must self-check spacing.** When inserting a block between existing content, the result should have exactly one blank line on each side — not zero, not two. Don't blindly prepend `\n\n`: if the preceding chunk already ends with `\n` (e.g. `insertAt` is right after a heading line), one `\n` is enough. Same for trailing. A `\n\n + block + \n` inserted after `...Heading\n\nintro...` produces `Heading\n\n\nblock\n\nintro` → triple newline. Reason through the surrounding whitespace before choosing the glue.
- **Removals must check boundaries.** After deleting a span, inspect the line immediately before the cut (might now be an orphan label like `**Component Roles:**` with no body) and the line immediately after (stray blank? merged paragraph?). Extend the removal range to swallow the orphan when it's clearly tied to the removed content.

### Stub template

```markdown
# <Type>: <identifier>

> **Source:** <original URL>
> **Status:** <one-line reason — auth-gated / interactive-app / page-removed>

*This entry is a metadata stub. <what the reader should do — "visit the URL" / "fetch via X tool" / "page archived">*
```

## 4. Fix recipes

**When §1 flags a bug whose shape matches a recipe below, apply — don't ask.** The recipes exist so documented-symptom bugs become commits, not tickets. "Want me to fix?" after finding a recipe-matched bug wastes a round-trip. The pause to ask is only warranted when the fix is novel, destructive, or scope-unclear — not when the recipe is right here. On zhihu I ran §1, found `tables=0`, wrote an abstract report, and asked permission to fix instead of applying the `<table>` DOM-extraction recipe I'd already used for deepwiki. Don't do that.

### Missing body / comments / tables / code blocks

Check raw HTML first: `curl -sfL <url> -A 'Mozilla/5.0' | grep -c '<keyword-from-body>'`. If HTML has it and opencli doesn't, use a fallback:

| URL pattern | Fallback |
|---|---|
| `huggingface.co/blog/<slug>` | `raw.githubusercontent.com/huggingface/blog/main/<slug>.md` (parse YAML frontmatter) |
| `github.com/<o>/<r>/pull/<n>` | REST `.../pulls/<n>` + `/issues/<n>/comments` |
| `github.com/<o>/<r>/issues/<n>` | REST `.../issues/<n>` + `/issues/<n>/comments` |
| `github.com/<o>/<r>/discussions/<n>` | REST `.../discussions/<n>` + `/discussions/<n>/comments` (flat; replies have `parent_id`) |
| `github.com/<o>/<r>/releases/tag/<v>` | REST `.../releases/tags/<v>` |
| `github.com/<o>/<r>[/blob/<b>/<p>\|/tree/<b>\|/]` | `raw.githubusercontent.com/<o>/<r>/<branch>/<path>` (default path `README.md`) |
| `huggingface.co/spaces/<o>/<n>` | `AUTO_SKIP_RULES` L2 skip, no output |

**Rate limits**: GitHub REST API anon = 60/hr. Set `GITHUB_TOKEN` env var for 5000/hr — required for bulk jobs.

### Activity timeline leaking through

The strip regex must handle multiple prefix shapes from the same source (depends on whether avatar-strip has run yet):

- `- NAME verb ...`                          (clean bullet)
- ` - NAME verb ...`                         (leading WS from stripped avatar)
- `[@NAME](/NAME) - NAME verb ...`           (avatar kept alt `@` prefix)
- `[NAME](/NAME) - NAME verb ...`            (avatar text preserved as plain link)

Regex shape: `^\s*(?:-\s+|\[@?[A-Za-z0-9_-]+\]\(\/[A-Za-z0-9_-]+\)\s*-?\s*)[A-Za-z0-9_-]+\s+(?:VERB_KEYWORDS)\b[^\n]*$`. Keep VERB_KEYWORDS as short keywords (`merged`, `mentioned this`, `added`, `self-assigned`, `deleted the`, `restored the`, `changed the title`, `approved these changes`, `reviewed`, `requested`, `closed this as`, `locked as`, `pushed a`, `reopened this`, `assigned`, `removed`, `and removed`) — let `[^\n]*$` consume anything after the verb. Don't try to match specific SHA/URL shapes; tooltips with `)` in them break that.

Additional strips: commit-ref bullets (`- [\`sha\`](url) title`), short-SHA followups (`` `[sha](url)` ``), pathological 3-link merge commits (any backticked line containing `/commit/<sha>`), `…X\_pack` truncation tails, orphan `[Title #NNN](/org/repo/pull/N)` cross-refs, bare `[NAME](/NAME)` user-link lines, `## Activity` header.

### DeepWiki mermaid diagrams leaking as orphan labels

Symptom: text like `Cluster GPU Resources` / `Total GPUs requested` / `_create_placement_group(num_gpus)\nPACK strategy` appears as loose paragraphs outside any ```` ```mermaid ```` fence. These are node labels from a mermaid diagram that opencli's DOM-to-markdown converter flattened into text.

DeepWiki stores mermaid source in different places depending on the host:
- **wiki.litenext.digital**: `.mermaid[data-original-text]` attribute on each `<div>` — straightforward attribute pull.
- **deepwiki.com**: no DOM attribute; source lives as `\`\`\`mermaid\n...\`\`\`` fences inside Next.js hydration scripts (`self.__next_f.push(...)`). Hydration ships the ENTIRE wiki's mermaids (not just the current page), so the extractor caps results to `document.querySelectorAll('svg[id^="mermaid"]').length` — the number of SVGs actually rendered on this page, in document order.

`extractDeepwikiMermaidSources` tries the data-attr strategy first, falls back to script-scan + SVG-count cap. `spliceDeepwikiMermaid` then replaces runs of orphan node-label lines with `\`\`\`mermaid ... \`\`\`` fences.

**When the splice misses a diagram**, it's because `isDiagramNode` rejected some of the label lines or the orphan run was shorter than the minimum-run threshold, so the splicer left the orphan text alone.

Recipe: `isDiagramNode` must accept:
- Any line containing `\\n` or `\\_` (mermaid-label literal escapes — strong affirmative signal, accept up to ~200 chars)
- Short-enough plain text (≤ 80 chars, ≤ 10 whitespace tokens, no markdown markers, no numbered-list/URL/image-prefix)

The previous thresholds (40 chars / 5 tokens) rejected labels like `Critic slice (optional)\n[actor_num_gpus : actor+critic_num_gpus]`, breaking the diagram-node run after only 2 matches.

**Adaptive minimum-run threshold.** The splicer's `minRun` is derived from the smallest extracted source's node-line count, clamped to `[3, 6]`. This catches small sequence/state/ER diagrams (often 3–4 labels) without false-splicing normal short-line clusters. Old hard-coded `>= 6` missed any diagram whose exploded form had fewer than 6 label lines — e.g. the JAX overview's architecture subgraph.

**Silent-miss guard — `deepwiki-mermaid-splice-incomplete` / `deepwiki-table-splice-incomplete`.** Both splicers return `{placed, total}` / `{matched, skipped}`. When placed < total or skipped > 0, the adapter emits the corresponding flag + a `WARNING — extracted N but only placed M` note into `source.json`. Grep for these flags after bulk-fetches to surface diagrams/tables that were extracted but couldn't be reinserted (usually: heading text drift for tables, or `isDiagramNode` rejection for mermaid).

### WeChat / mdnice malformed bold + lists + code (Layer-4 hosts)

mdnice (the editor most weixin authors use) emits HTML with several
quirks that Markdown converters mishandle. opencli's weixin adapter has
no raw-HTML option, so we extract `#js_content` outerHTML via
`browser eval` and convert in
`tools/hirono/weixin/raw-html-converter.ts`. The recipes below are
encoded there; reference implementations for any new Layer-4 host.

| Symptom | Cause | Fix in converter |
|---|---|---|
| `-   • text` / `1.  1. text` | mdnice injects visual bullet/number AS TEXT inside each `<li>` | `stripListMarkerPrefixes` — trim leading `[•·●◦‧▪◆■▶►]` or `[0-9]+[.、)]` from the first text node of every `<li>` |
| `**作者**丨何煦阳**` (5 unbalanced `*`) | Adjacent `<strong>A</strong><strong>B</strong>` siblings → turndown emits `**A****B**`; naive `\*{4,}` collapse breaks the closing pair | HTML-level: `unwrapInertSpans` first (pure-style `<span>` wrappers block adjacency detection), then `normalizeEmphasis` Pass 2 merges adjacent same-type siblings |
| `******text******` (6+ `*`) | `<strong><strong><strong>X</strong></strong></strong>` self-nesting up to 3 levels | `normalizeEmphasis` Pass 1 — LOOP unwrap until stable (8 passes max) |
| `## **title**` redundant bold | `<h2><strong>title</strong></h2>` | Post-turndown regex strips `^(#{1,6}\s+)\*+\s*([^*\n]+?)\s*\*+\s*$` → `$1$2` |
| Empty `## ` heading lines | H1 with whitespace-only first child → `enforceSingleH1` demotes to empty `## ` | Post-turndown regex drops `^#{1,6}\s*$\n?` |
| Multi-line code collapsed to 1 line | mdnice splits a code block into lines via `<br>` (Shape A2) or per-line `<code>` children (Shape B) or per-line `<p>`/`<section>` siblings (Shape C); `Node.textContent` silently drops `<br>` | `textWithLineBreaks(el)` — manual tree walk emitting `\n` for `<br>` AND between `<p>`/`<div>`/`<section>` block siblings. Single rule branches on `<code>`-child count: multi → join with `\n`; single → text + lang from `class="language-X"`; bare `<pre>` → walk-with-breaks |
| YAML/code body content silently lost | Single `<pre>` with multi `<code>` children, taking only `.querySelector("code")` returns just the first line | Use `Array.from(pre.children).filter(c => c.tagName === "CODE")` and join all with `\n` |
| `data-lang="sql"` mislabel | mdnice frequently mis-tags actual YAML/bash/text as `sql` | For multi-`<code>` shape, IGNORE `data-lang`. Single-`<code>` shape can trust `<code class="language-X">` (more reliable) |
| jsdom CSS-shorthand crash | malformed `style="background:..."` from mdnice trips jsdom 23+ | Strip `style="..."` from raw HTML before passing to JSDOM (regex pre-pass) |
| SVG diagrams flattened to garbage | WeChat embeds mermaid-rendered flowcharts as inline `<svg>` with `<foreignObject>` labels, not `<text>`. Source recovery is INFEASIBLE — mdnice strips every `class` and `id` from the rendered SVG, leaving anonymous `<g>`/`<rect>`/`<path>` with no semantic structure to reconstruct mermaid from. Save SVG-as-image. | `processSvgs(doc, root, originalSvgs)`: real (≥2KB OR has `aria-roledescription` matching flowchart/sequence/diagram/graph) → save as `weixin-svg-NNN.svg` standalone file + `<img data-local-svg="1" src="…">` placeholder; decorative (~500-byte 3-ellipse dots) → drop. CRITICAL: harvest pristine SVG bytes BEFORE the style-strip pass, otherwise the saved file renders as black-on-white wireframe with broken markers (mermaid's visual semantics live entirely in inline styles) |
| SVG placeholder removed by `normalizeImages` | The placeholder `<img src="weixin-svg-001.svg">` has a relative URL → `normalizeImages`'s http-only filter treats it as a tracking pixel | Tag SVG placeholders with `data-local-svg="1"`; `normalizeImages` checks for it and skips |

### x.com / Twitter

`tools/sites/x-twitter/` emits a deterministic stub for every URL — Twitter/X requires login to render content reliably. Visible-content extraction is preserved in git history (the legacy `xMetadataStub`'s 13-step pipeline) and can be revived if/when authenticated fetching becomes practical, but the active path is stub-only.

### KaTeX triple-rendered math (HuggingFace blog)

Each inline formula appears 3x: text-fallback + LaTeX-source (with `\\cmd`) + alt-text-fallback. `collapseHfTripleMath` uses V1/V3 suffix-match to collapse. After collapse, convert `\\cmd` → `\cmd` — LaTeX `\\` means newline, not a command escape. Single-variable `N N N → $N$` is a separate pass (no `\\` to anchor on).

### Avatar residuals / badges

Three DOM shapes to process in order:

1. **Nested** `[![alt](img)TEXT?](url)` — inspect URL:
   - URL is `/username` + TEXT empty → drop whole unit
   - URL is external (http) → keep `[alt](url)` (badge pattern)
   - Otherwise → keep `[TEXT](url)` (explicit username)
2. **Separated** `![alt](img) [name](/name)` → keep user link, drop image
3. **Bare `[@name](/name)`** → strip (residual from avatar passes)

After: sweep inline empty-anchor sequences `(?:\[\s*\]\([^)]+\)\s*){2,}` and single-remnant prefixes before event bullets `^\s*\[\s*\]\([^)]+\)\s+(?=-\s+\S)`.

### GitHub UI chrome bleed-through

Categorized patterns in `githubStripUIChrome`:

| Category | Lines to strip |
|---|---|
| CI status | `Loading`, `Loading status checks…`, `### Uh oh!`, `There was an error while loading. Please reload this page.`, `## Sorry, something went wrong.` |
| Signed commit | `Verified`, `# Verified`, `This commit was created on GitHub.com...`, `GPG key ID:`, `[Learn about vigilant mode]` |
| Editor toolbar (standalone + bulleted) | `Heading` / `Bold` / `Italic` / `Quote` / `Code` / `Link` / `Numbered list` / `Unordered list` / `Task list` / `Attach files` / `Mention` / `Reference` / `Saved replies` / `Slash commands` / `Menu` / `Comment Write Preview` / `Add your comment here...` / `Markdown is supported` |
| Release top | `Compare`, `# Choose a tag to compare`, `Filter`, `No results found`, `[View all tags]` |
| Release bottom | `Assets N` + emoji reactions bar + `All reactions`, `N people reacted` |
| PR tabs / events | `## Conversation`, `Hide details View details`, `Issue body actions`, `More actions`, role-alone `Contributor\|Member\|Owner\|Collaborator`, `N tasks`, `N participants` |
| Label concat | `[bugSomething isn't working](labels-url)Something isn't working` → `` [`bug`](url) `` |
| Self-link | `[[Title](#top)#NNNN]`, `[Title](#top) #NNNN`, `[Return to top]` |
| Discussion | multi-line category link `[\n\n📣\n\nAnnouncements](/.../categories/...)` |
| Dup-H1 block | everything between `\n---\n` and the first recognized speaker heading (OP / comment / discussion announcement) |

### githubStripUIChrome match predicate

```ts
match: (u, h) => h === "github.com" && /\/(?:pull|issues|discussions)\/\d+/.test(u)
```

**Do not widen this.** Raw-fetched content (`/blob/`, `/tree/`, `/releases/tag/`, repo main) arrives as clean markdown with no DOM chrome. Running the aggressive dup-H1 strip on it wipes real README content — I once ate 2 KB of content (intro paragraphs, badges, `## Latest News`) between `---` and `## Overview` because the match was too broad.

### Post-processor ordering inside githubStripUIChrome

When adding a new collapse, insert it at the right stage — order is load-bearing:

1. Block-level pre-strips: dup-H1 + leading-chrome → CI-loading → Verified → release-top → release-reactions → discussion-category link
2. OP identity collapse (needs avatars intact)
3. OP-body heading demotion (after OP collapse, anchored on `> opened this`)
4. Label collapse (before activity events — labels appear inside verb phrases)
5. Activity event strip (keyword-based, all prefix shapes)
6. Pagination chrome + "N remaining items" note
7. Comment header collapse
8. Commit-entry / alt-format commit-ref collapse
9. `Hide details View details` inline prefix strip
10. **Avatar strip** (three variants + bare `[@name](/name)` — only NOW do we flatten)
11. Discussion-specific post-avatar cleanups (duplicate author, leading `[](/user) -`)
12. Inline empty-anchor sweep
13. Line-level filter + sidebar cutoffs
14. Trailing-avatar trim (3 iterations — avatars become newly-trailing after step 13)

A regex that fails because its input shape differs from expectation is usually an ordering problem, not a regex bug.

## 5. New-URL / new-host protocol

### 5a. The universal pattern (the only architecture)

Every URL flows through a self-contained site module under `tools/sites/<host>/`. The module owns the full pipeline from URL to clean §2 markdown. opencli is used for browser session + auth ONLY (or not at all if a structured source exists); we never consume opencli's lossy markdown output as the canonical content.

Routing is **total**: `tools/sites/_default/` is registered last in the router with `match: () => true`, so `routeSite(url)` always returns a Site (never null). There is no legacy fallback path. After every `site.fetch()` returns a Result, `applyPostCleanups()` runs 8 host-agnostic cosmetic fixes — see `tools/sites/_shared/post-cleanup.ts`. That's the entire pipeline.

References for new modules:
- Simplest article-shape host: `tools/sites/aleksagordic/` (15-line factory config)
- API source: `tools/sites/github/` (REST + raw-URL paths)
- Raw-markdown mirror: `tools/sites/huggingface/` (GitHub mirror for /blog/)
- Browser-eval SPA: `tools/sites/weixin/`, `tools/sites/xhs/`, `tools/sites/zhihu/`
- Stub-only: `tools/sites/feishu/`, `tools/sites/x-twitter/`, `tools/sites/qwen-ai/`
- Catch-all: `tools/sites/_default/` (permissive selectors + chrome dropSelectors)

Architecture doc: [`docs/fetcher-architecture.md`](docs/fetcher-architecture.md). Migration recipe: [`tools/sites/MIGRATION.md`](tools/sites/MIGRATION.md).

**Source-of-truth selection** for the site's fetcher — pick the cleanest available source:

| Source available | Use it via | Examples |
|---|---|---|
| **REST / GraphQL API** that returns structured data | `curl` or `fetch` directly; convert JSON → markdown ourselves | github (issue/PR/discussion/release APIs) |
| **Raw markdown** in a public repo or CDN | `curl raw URL`; pass through with image localization | huggingface /blog (`raw.githubusercontent.com/huggingface/blog`) |
| **Server-rendered HTML with stable selectors** | plain `curl` + JSDOM + per-host rules — usually via the article-site factory | aleksagordic, lmsys, qwenlm.github.io, arxiv abstracts, sebastianraschka, anthropic |
| **JS-rendered SPA / auth-gated** | `opencli browser open` + `browser eval` to extract `outerHTML`; then own the conversion | xhs, weixin, zhihu |
| **No usable content** | emit `intentional-stub` deterministically from the URL | feishu, x.com, reddit, qwen.ai |

When adding a new host module, defects belong in the site's own `converter.ts` (DOM-level, before turndown), NOT in cross-cutting cleanup. The cross-cutting pipeline only does 8 universal fixes (color tags, single-H1, relative-URL resolution, etc.) — anything host-specific is the host module's responsibility.

**Steps to add a new host module** (see [`tools/sites/MIGRATION.md`](tools/sites/MIGRATION.md) for the full recipe):

```
   ├─ Step 1: Pick the source per the table above.
   ├─ Step 2: Build tools/sites/<host>/:
   │     index.ts       — { name, match(url), fetch(url, opts) ⇒ Result }
   │     test-hooks.ts  — re-export from index.ts (factory does it for you)
   │     converter.ts   — only if not using the factory (custom DOM logic)
   │   Most blog-shape hosts are 15-line `makeArticleSite({...})` configs.
   ├─ Step 3: Register the site in tools/sites/index.ts (BEFORE _default)
   │   AND tools/sites/test-hooks-registry.ts.
   ├─ Step 4: Generate fresh markdown for ≥3 representative URLs. EYE-READ
   │   each (do not skip). Show to the user for approval before locking.
   ├─ Step 5 (AFTER user approves md quality): capture fixture + snapshot:
   │     npx tsx tools/__tests__/approve.ts --site <host> --name <slug>
   │       --url <url> --slug <host>-snap-<slug> --yes
   │   Capture ≥3 fixtures covering distinct content shapes.
   └─ Step 6: Run npm test (must be green) + commit (one host per commit).
```

**Do NOT** add fixtures or snapshot-tests until the user has eye-read the markdown and approved the quality. Locking in tests around bad output silently bakes regressions in.

### 5b. Long-tail graduation watchdog

`hirono raindrop check` flags hosts that crossed from count==1 → count>=2 since the last accepted snapshot. Address each via Step 1+ above, then `hirono raindrop check --update-graduation-snapshot` to bake the new counts into `tools/opencli/host-counts.json`. Non-zero exit code if there are unaddressed graduations.

### 5c. Iterate on the first 1–2 outputs before bulk-processing

Don't guess the quality bar — preferences (what's content vs chrome, formatting choices) aren't knowable from markdown alone. Show the user the first sample and iterate.

### 5d. Where code lives (universal pattern)

- **All per-host code** → `tools/sites/<host>/{index,fetcher,converter,metadata}.ts` + fixtures under `tools/__tests__/fixtures/converters/<host>/` and snapshots under `tools/__tests__/snapshots/<host>/`. Every host module owns its full pipeline.
- **Cross-site primitives** → `tools/sites/_shared/`:
  - `article-site-factory.ts` + `article-converter.ts` — the 15-line config pattern most hosts use
  - `post-cleanup.ts` — `applyPostCleanups()` and the 8 host-agnostic cosmetic cleanups
  - `markdown-cleanups.ts` — bold-spacing walker + quad-asterisk collapse (used by converters before turndown output is finalized)
  - `generic-converter.ts` — JSDOM + turndown plumbing
  - `types.ts` — the `Site` contract every module exports
  - `test-hooks-types.ts` — `SiteTestHooks` contract
  - `browser-eval-json.ts` — opencli browser-eval helpers (only for D-bucket modules)
- **Recipes for non-obvious patterns** (auth walls, hidden APIs, multi-step extraction) → §4 of this file.

There is no legacy location for new code. All host-specific cleanup belongs in the host's site module; only host-agnostic cosmetic fixes belong in `_shared/post-cleanup.ts`.

### 5e. Direction-finding for new hosts (cross-host patterns)

Don't start from blank. Every verified host falls into one of a handful of *shapes*, has chrome from a small set of *categories*, and yields to ordering *invariants* that existing recipes have validated. Use the catalogues below as a map: classify the shape, scan for chrome categories, plan the cleanup ordering. The §4 recipes are then targeted reference material, not first-principles work.

#### 5e.i. Content-shape taxonomy

After reading 2–3 sample URLs from a new host, classify into one of these. Each shape has a recipe template — the cleanup converges much faster when you know which template you're aiming at.

| Shape | Signal | Recipe template | Reference sites |
|---|---|---|---|
| **Article** | Single prose body, one author/date, may have images/code/tables | H1 title + `> 原文链接:` + optional `> Authors:` callout + body. Strip header chrome (nav, share row), strip footer chrome (subscribe, related, tags). | aleksagordic, blog.google, intuitionlabs, qwen, sspai |
| **Thread / conversation** | Repeated `[Name][@handle][date][body]` blocks; flat or nested replies | Per-message card: `**Name** [@handle](profile) · [date](url)` byline, body, `---` between cards | x.com, linux.do, reddit |
| **PR / issue / discussion** | OP + activity timeline + threaded comments + reactions | Split-speaker: `## username` heading + `> opened/commented/replied on … · Role` blockquote + body. Strip activity events, reactions, avatars per §3 | github.com PR/issue/discussion |
| **Catalog / table page** | Page is mostly a structured table/note with metadata fields | Title + author/metadata callout + flattened table. Image-only variants get explicit "Text content unavailable" marker | xhs, github releases |
| **Data / interactive viz** | Interactive chart/dashboard; real data lives in JS state or a CSV download | Intro prose + `## Dataset (top N of M rows)` markdown table built from the CSV | epoch.ai |
| **Wiki / docs** | Multi-page hierarchy, mermaid diagrams, rich tables, code refs | Body + spliced mermaid fences + spliced table contents (see DeepWiki recipe in §4) | deepwiki.com, wiki.litenext.digital |
| **Gallery / SPA** | React-rendered grid with dropdown filters; "content" lives in JS state | Best-achievable: capture visible prose, flag interactive UI as known-limit, do NOT lock fixtures around partial output | sebastianraschka.com |

If a host matches none of these, *say so explicitly to the user before guessing*. Adding a new shape is a deliberate design decision, not a fallback.

#### 5e.ii. Universal chrome categories

These categories appear on almost every content host in some combination. Scan for them in the first/last 30 lines of any new sample. For each present: reuse the §4 recipe regex if one matches, else write a new line-filter following the same shape.

| Category | Common shapes | Already-handled hosts |
|---|---|---|
| **Profile / avatar links** | `[\n\n![](avatar)\n\n](/handle)`, `[\n\nName\n![](badge)\n\n](/handle)`, bare `[@name](/name)` | x.com, github, sspai, huggingface |
| **Engagement metrics** | `[\n\nNN.NM\n\n查看](.../analytics)`, reactions bars, "N people reacted", view-count text | x.com, github releases, zhihu |
| **Sidebars / rails** | `## Trending`, `## What's happening`, `## 当前趋势`, recent-articles lists, related-posts blocks | x.com, blog.google, sebastianraschka |
| **Subscribe / signup prompts** | "Subscribe to X", "Join N readers", `Ready for more?`, `Discussion about this post`, `点击 订阅 到 …` | substack/magazine, intuitionlabs, sspai, x.com |
| **Author / footer cards** | Author bio below content, tag chains, social-share rows, copyright lines, byline-tail metadata | most blogs (blog.google, intuitionlabs, hf, sspai) |
| **Editor / UI controls** | "Heading / Bold / Italic" toolbar text, "Markdown is supported", "Comment Write Preview", "Add your comment here…" | github |
| **Skeletons / loading states** | "Loading…", "加载中", "Please wait" in <2 KB body | many SPAs before browser-eval delay completes |
| **Login / paywall walls** | "Sign in to X", "请登录", "This post is for paid subscribers", "Don't miss what's happening" | x.com (gated), feishu, substack paid |
| **Page-title duplicate** | Body re-emits the H1 from page chrome (creating two `# ` headings) | github (PR/issue title), substack, weixin |

#### 5e.iii. Cleanup ordering invariants

Order is load-bearing across all hosts. Generic regexes cannibalize specific ones if they run first. Five rules, derived from the bugs that bit each host listed:

1. **Specific before generic.** When a specific rule ("drop view-count blocks at `.../analytics`") and a generic rule ("unwrap any `[\n\nText\n\n](url)`") both match the same shape, the specific one runs FIRST. Otherwise the generic rule turns the specific shape into bare text and the specific rule has nothing left to match. *Symptom of violation:* bare numbers like `3.3万` floating between paragraphs (x.com, first iteration).
2. **Specific images before generic image-link drop.** Photo embeds (`.../photo/N`), figure captions, click-to-enlarge thumbnails, and link-card images must be unwrapped before any "drop standalone `[\n\n![](*)\n\n](*)`" rule. *Symptom:* missing inline images that should have been preserved (x.com photos, second iteration).
3. **Truncate rails / footers EARLY.** Trailing-sidebar cuts (`## 当前趋势` → end, `## Related stories` → end) run before line-level filters. The rail/footer often contains lines (`显示更多`, `订阅`, "Subscribe to") that a generic filter would also match, but cutting the section saves cycles and avoids over-deleting in the body. *Symptom of violation:* in-body legitimate "Subscribe" mentions get stripped (false positive on a paragraph in a content article).
4. **Identity / byline collapse AFTER unwraps, BEFORE separator insertion.** The byline-collapse regex needs the unwrappers to have already run so it sees `Name\n@handle\n[date](url)`, not still-wrapped `[\n\nName\n\n](/handle)`. The card-separator (`---`) insertion needs the byline already collapsed so it can anchor on the bold-name-then-handle shape. *Symptom of violation:* either no separators inserted, or separators inserted before raw unwrapped text (x.com, third iteration before reordering).
5. **Image localization is the LAST step before §2 frontmatter assembly.** Earlier pipeline stages can still rewrite image URLs (relative-resolve, click-to-enlarge unwrap, embedded photo unwrap, referer-protected re-fetch). Localize once, at the boundary, so `processImages` sees the final URL set. *Symptom of violation:* `![](https://...)` remote URLs surviving to final output (caught by the §1 `remote_imgs` block-ship gate).

#### 5e.iv. First-pass eye-read checklist

For every new host, scan the first generated sample for these defects before showing it to the user. Each item is something an existing host previously shipped wrong.

| Where to look | What to scan for |
|---|---|
| **Top 30 lines** | Nav bar bleed, language-picker chrome, "Skip to content" links, breadcrumbs, share-button rows, **duplicate H1** from page-title block, frontmatter `> 原文链接:` present and on its own line |
| **Tail 30 lines** | Subscribe footer, related-posts list, tag chain, author bio card, "More from this author", trending sidebar, copyright/year, social-share row, comment-count line |
| **One mid-document section** | **Multi-line link wrappers** (`[\n\n![](*)\n\n*\n\n](url)`) — these render but read as broken markdown; **paragraph-spaced bylines** (3+ blank-line gaps where one would render right); **bare relative URLs** (`](/path)` instead of `](https://host/path)`); orphan `**Label:**` lead-ins after a removed cell-run |
| **Code / tables / images** | Every code block fenced with a language tag (not `<table>`-rendered — Hexo `figure.highlight` defect); table cells flattened (no `<div>` / `<h*>` / `<br>` inside `td`); every `![](*)` resolves to a local file in `<slug>-images/`; title attributes preserved on rewritten refs |
| **Math / footnotes / currency** | `$NNN` not auto-italicized as math (escape to `\$NNN`); `\[1]` footnote refs unescaped to `[1]`; KaTeX triplets collapsed (HF blog: V1+V3 suffix-match); single-`_{...}` per formula (multi-subscript breaks lark-cli) |
| **Heading hierarchy** | Exactly one `# ` H1 (frontmatter title); no empty `## ` lines; no Chinese ordinal headings (`## 一、` → `## 1`); H2/H3 numbering consistent across siblings |
| **Whitespace** | No `\n{3,}` runs; no triple-newline around spliced blocks; no orphan blank lines around removed chrome; standalone images on their own lines |
| **Conversation hosts only** | Each speaker has a single byline line, NOT 3 paragraphs; `---` (or equivalent) separator visible between speakers; relative date links resolved to absolute |

If the sample fails any item: fix the cleanup, regenerate, scan again. Don't show the user a sample with known defects — every iteration has context cost. The checklist exists so the cost is paid once, by you, before the user sees it.

#### 5e.v. Where cleaner data may hide (source-of-truth detection)

For a new host, check these alternatives in order before settling for plain rendered-HTML extraction. Listed by frequency of yielding cleaner data on the verified hosts:

1. **REST / GraphQL API** of the host returning structured JSON we can convert ourselves. *Used by:* github (issue/PR/discussion/release APIs).
2. **Raw markdown mirror** in a public repo or CDN. *Used by:* huggingface blog (mirrored at `github.com/huggingface/blog`); github file/repo content via `raw.githubusercontent.com`.
3. **Inline hydration JSON** in `<script>` tags. Next.js / React SPAs often ship the page state as `self.__next_f.push([...])` or `__NEXT_DATA__`. *Used by:* deepwiki.com (mermaid sources live in hydration).
4. **DOM attribute data** for embedded widgets. *Used by:* wiki.litenext.digital deepwiki (`.mermaid[data-original-text]`).
5. **Linked downloads** (CSV, JSON, PDF). *Used by:* epoch.ai (`<a href="*.csv">` for the actual dataset).
6. **`<meta>` tags** for shape and metadata hints — `og:type`, `og:url`, `article:author`, `article:published_time`. Always cheap to read; useful for shape classification (5e.i).
7. **`<head>` `<title>`** as last-resort title fallback when body extraction misses the title.

If any of these returns cleaner data than the rendered HTML, the site module's fetcher should use *that* source. The site module owns the conversion either way — what changes is just which input it reads from.

## 6. Regression set

Before committing post-processor/adapter changes, re-export these AND check each against the contract. `block-ship` one-liner below each table row flags obvious regressions.

| URL | Contract | Status |
|---|---|---|
| `huggingface.co/blog/train_memory` | 19 KaTeX triplets + 5 single-var collapsed, `\cmd` not `\\cmd`, author callout, images local | good · ~14KB |
| `huggingface.co/blog/smollm3` | 23 anchor prefixes stripped, 23-author `> **Authors:**` callout, no KaTeX | good · ~26KB |
| `huggingface.co/blog/moe` | GitHub-raw fallback fires, ~30KB body, 12 images | good · ~30KB |
| `huggingface.co/spaces/mteb/leaderboard` | L2 skip, no `raw/` dir written | skipped (exit 0) |
| `github.com/huggingface/trl/pull/3521` | 3 speakers (OP + 2 comments), ≥1 table, ≥4 fences, zero activity, zero `@`-mentions | good · ~6KB |
| `github.com/openclaw/openclaw/issues/7827` | 4–5 speakers, split-header format, zero activity/avatars | good · ~8KB |
| `github.com/pytorch/torchtitan` | README raw fetch, ≥18 fences, 8 local badge images, no `<div>` | good · ~11KB |
| `github.com/pytorch/pytorch/releases/tag/v2.5.0` | Release API body, ≥18 fences, ≥10 table rows, `> Released by ... · date · tag` metadata | good · ~91KB |
| `github.com/ggml-org/llama.cpp/discussions/5138` | REST API body + 24 speakers (7 top + 17 `> replied on`) | good · ~9KB |
| `wiki.litenext.digital/wiki/slime?file=02-distributed-orchestration` | 9 mermaid code blocks via deepwiki splicer, 0 orphan `\n` labels outside fences (see "DeepWiki mermaid diagrams leaking as orphan labels" recipe) | good · ~29KB |
| `mp.weixin.qq.com/s/PcyKi5q8zT-tJ_9rzgKSqg` (Anthropic Skills) | Layer 4 raw-HTML, 30 fences, 0 doubled markers, 0 unbalanced bold runs, YAML body intact | good · ~6KB |
| `mp.weixin.qq.com/s/FcK3QmzudPZzqsz85odFlQ` (GPU container) | Layer 4 raw-HTML, 14 fences, 21 table rows, 1 SVG diagram preserved as `weixin-snap-gpu-container-images/weixin-svg-001.svg` (with inline styles), all multi-line code blocks intact | good · ~6KB + 20KB SVG |
| `mp.weixin.qq.com/s/44_UrbaQu2U1EAB9OrGNxQ` (Xiaomi interview) | Layer 4 raw-HTML, image-heavy interview, 15 images downloaded, `**作者丨何煦阳**` properly merged from adjacent strongs | good · ~12KB |
| `x.com/garrytan/status/2042497872114090069` | tools/sites/x-twitter/ stub: `# Tweet / X post` + `intentional-stub` flag — Twitter/X auth-gates content | stub · ~500B |

**Block-ship one-liner** (anything > 0 for remote_imgs/activity, or FM == 0, or feature < contract → DO NOT SHIP):

```bash
f=raw/raindrop/<host>/<slug>/content.md
echo "$f:" \
  "lines=$(wc -l < $f)" \
  "fences=$(grep -c '^```' $f)" \
  "tables=$(grep -c '^|' $f)" \
  "remote_imgs=$(grep -cE '!\[[^]]*]\(https?://' $f)" \
  "activity=$(grep -cE '(merged \[|mentioned this|added .+ commits?|deleted the|self-assigned|approved these|pushed a|\[@[A-Za-z0-9_-]+\]\(/)' $f)" \
  "FM=$(head -5 $f | grep -c 原文链接)"
```

## 6b. Test suite (the gate before commit)

Run `npm test` (cwd `tools/`) before every commit that touches an adapter, converter, or post-processor. The suite is the regression gate; do not bypass it.

```bash
cd tools && npm test           # runs node --import tsx --test __tests__/*.test.ts
```

**Five layers of test coverage** — each catches a different class of bug:

| Layer | File | What fails it |
|---|---|---|
| **Coverage gate** (NEW) | `__tests__/coverage-gate.test.ts` | A site module under `tools/sites/<X>/` is registered in `test-hooks-registry.ts` but missing fixture(s) under `__tests__/fixtures/converters/<X>/` OR a snapshot under `__tests__/snapshots/<host>/`. Surfaces incomplete migrations as failing tests with actionable next-step commands. |
| **Structural rules** (NEW) | `__tests__/structural-rules.ts` (applied by both fixture + snapshot tests) | Captured ground truth (expected.md / snapshot.md) contains a known defect shape: multi-line link wrappers, over-escaped emoji shortcodes, over-escaped image syntax, empty headings, triple newlines, quad-asterisk runs. Layers ON TOP of byte-equal — catches the case where a buggy converter's output got captured as ground truth. |
| Per-host snapshot tests | `__tests__/per-host-snapshot.test.ts` | (a) snapshot `.md` was hand-edited away from its sidecar `.invariants.json`; (b) hard-rule defect (h1 != 1, missing frontmatter, remote refs, etc.); (c) structural-rule violation; (d) local image ref unresolved on disk. |
| Converter-fixture tests | `__tests__/converter-fixtures.test.ts` | **byte-equal diff** between `convertX(frozen-input)` and the saved `expected.md`. ANY drift trips this. PLUS structural rules over the saved `expected.md` (catches buggy ground truth). |
| Pure-function fixture tests | `__tests__/post-process-fixtures.test.ts` | input markdown → assert exact output. Use `assertStructurallyClean(r.md, label)` helper as a backstop for substring matchers. |

**Canonical workflow: `approve.ts` for ground-truth capture / refresh.**

```bash
npx tsx tools/__tests__/approve.ts --site <site> --name <fixture-name> --url <url> [--slug <slug>] [--yes]
```

What it does, in order:
1. Fetches the URL via the site-module's test hook.
2. Runs the converter; runs structural rules over the output (refuses to write if any rule fires).
3. Prints eye-read sections (top 30 / mid 30 / tail 30) per CLAUDE.md §5e.iv.
4. Prints diff vs current ground truth (if exists).
5. Prompts y/n (skip with `--yes` for scripted use).
6. On y, writes fixture (3 files) + snapshot atomically, with rollback on partial failure.

This replaces the legacy multi-step ritual (`capture-fixtures.ts` + `snapshot-create.ts` + manual eye-reading). The legacy scripts remain as low-level primitives for scripting bulk operations, but `approve.ts` is the canonical "I confirmed the output is good" command.

**When converter-fixture tests fail:**

1. Read the byte-offset diff in the failure message.
2. Decide:
   - **Bug** in the new code → fix the code, do NOT regenerate the fixture.
   - **Intentional improvement** → regenerate via `approve.ts` (interactive, runs structural rules):
     ```bash
     npx tsx tools/__tests__/approve.ts --site <site> --name <name> --url <url>
     ```
     The diff vs the existing `expected.md` is shown before the prompt. Always read the diff before approving. Silent fixture regeneration bakes regressions in.
3. Never `--no-verify` past a fixture test failure.

**Adding a new site module to the test infrastructure** (one-file change):

Write `tools/sites/<X>/test-hooks.ts` exporting a `testHooks` declaration (see `tools/sites/_shared/test-hooks-types.ts` for the contract). Add an import to `tools/sites/test-hooks-registry.ts`. The coverage gate (`__tests__/coverage-gate.test.ts`) will then enforce that `<X>` has ≥1 fixture and ≥1 snapshot. Capture via `approve.ts`.

**Coverage target per converter: ≥3 fixtures.** A single fixture catches only the bugs its URL happens to exercise. Three diverse shapes give meaningful regression coverage. The coverage gate accepts ≥1 today (low floor for incremental migration); bump in `coverage-gate.test.ts` when all sites reach ≥3.

**Live-fetch upstream-drift detection** (operator-run, NOT in CI):

```bash
npx tsx tools/__tests__/check-drift.ts [--host <host>] [--site <name>] [--diff-only]
```

Re-fetches every snapshot URL (read from the `source_url` field in the sidecar) and diffs against the saved snapshot. Categorizes per-snapshot as `unchanged` / `trivial-diff` / `significant-diff`. Detects upstream site changes (DOM rearrangements, content updates) that fixture tests miss because they run on captured input. Pre-source_url snapshots are skipped with a message; backfill via `npx tsx tools/__tests__/snapshot-helpers.ts backfill-source-url <md-path> <url>`.

**Coverage target per converter: ≥3 fixtures.** A single fixture catches only the bugs its URL happens to exercise. Three diverse shapes give meaningful regression coverage.

**Assertion shape, not substring presence.** When testing conversion / formatting output, `assert.match(out, /Foo Bar/)` is almost always wrong — it confirms a token survives but says nothing about whether the token is rendered well. Anchor assertions to the rendered SHAPE: byline regex (`/^\*\*Name\*\* \[@handle\]\(.+\)$/m`), card-separator presence (`/\n---\n/`), absence of broken multi-line wrappers (`/\[\s*\n\s*!\[/` must NOT match). When the test would still pass on visibly-bad output, the assertion is too weak. Failed-the-eye-read but passed-the-test is a category of regression that the test suite must catch, because the eye-read step is the most-skipped step in the workflow.

**Path-resolution gotcha** (learned the hard way): test files MUST resolve fixture/snapshot paths via `fileURLToPath(import.meta.url)`, not via cwd-relative literals like `"tools/__tests__/snapshots"`. `npm test` runs with cwd=`tools/`, so a literal would resolve to non-existent `tools/tools/__tests__/...` — the suite degrades to a "no fixtures present" sentinel and silently no-ops every assertion. Caught when running tests reported "60 pass" then `npm test` reported "1 pass" for the same file. (See commit `4ca244e` for the fix.)

**Stability check before relying on a green run:** run `npm test` 3 times back-to-back; the count must be identical and `fail = 0` every time. Filesystem-cache jitter is normal in the duration_ms; test count must not vary.

## 7. Quality flags

`classifyQuality` emits to `source.json.quality_flags`:

| Flag | Meaning |
|---|---|
| `short-body` | Body < 500 chars (generic floor) |
| `below-host-expected-size` | Above 500 but below `HOST_MIN_BODY_SIZES[host].minChars`. URL-path aware (HF `/blog/*` gets 2KB; HF `/spaces/*` excluded) |
| `no-headings-in-body` | ≥ 2KB body with zero `#{1,6}` headings — likely sidebar, not article |
| `loading-skeleton` | `Loading…` / `加载中` / `Please wait` in a < 2KB body |
| `images-declared-but-none-downloaded` | Markdown has images but disk is empty (silent adapter failure) |
| `adapter-output-partial` | Adapter harvest had rename/stat errors |
| `xhs-download-silent-fail` | xhs adapter exited 0 but saved no images |
| `weixin-image-download-partial` | Layer-4 weixin pipeline: at least one image URL failed to curl-download |
| `auto-skipped-hf-space` | L2 pre-fetch skip |
| `deepwiki-mermaid-extraction-failed` / `deepwiki-mermaid-splice-incomplete` | Browser pass failed, or extracted N sources but placed < N (orphan labels remain) |
| `deepwiki-table-extraction-failed` / `deepwiki-table-splice-incomplete` | Browser pass failed, or some tables couldn't find their preceding heading anchor |

`intentional-stub` (set by stub-producing processors) is consumed by classifyQuality → suppresses size-based flags → never appears in final flags.

## 8. Code pointers

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
- **`tools/hirono/`** — `hirono` CLI for raindrop-driven bulk fetching:
  - `doctor.ts` — environment health check
  - `adapter-paths.ts` — opencli `~/.opencli/clis/` symlink helpers (used only by doctor)
  - `raindrop/` — `check`, `export`, `fetch-all`, `refresh-cache` subcommands
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

## Keeping this file fresh

Update AFTER landing a fix, not during investigation. Durable learnings only — don't log every incident, just the pattern that would generalize to new URLs. Remove struck-through / resolved entries once a session passes without triggering the old bug.
