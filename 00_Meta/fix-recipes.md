---
created: 2026-05-12
updated: 2026-05-12
type: meta
---

# Fix recipes

Extracted from `CLAUDE.md` §4 during the 2026-05-12 file-size trim
(CLAUDE.md exceeded the 40k-char performance threshold). When `CLAUDE.md`
§1's fidelity check flags a bug whose shape matches a recipe below,
apply — don't ask. Recipes are organized by symptom; click through
to the §-anchor that matches what you're seeing.

These are documented-symptom-to-commit fixes. The pause to ask is only
warranted when the fix is novel, destructive, or scope-unclear — not
when the recipe is right here.


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
`tools/sites/weixin/converter.ts`. The recipes below are
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
