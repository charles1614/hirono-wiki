# CLAUDE.md

Quality rules and fix recipes for raw-content fetchers (`tools/fetch-raw.ts`, `tools/hirono/shared/post-process.ts`). Scan the checklists, match symptoms to fixes, don't re-derive from scratch.

## Before shipping anything — read this first

Fidelity before cleanliness, always. I've shipped "clean-looking" outputs that were missing 30+ lines of content every time I skipped this order.

**Five failure modes I keep hitting**:

1. **Validating against my mental model, not source truth.** A 1,645-line prose output can be missing all 28 code blocks; fence count = "looks right", feature count against source = "broken". Always diff against source.
2. **Greps that match what I wanted to strip, not what's in the file.** If my cleanup regex says `^- NAME verb` but the file has `[@user](/user) - NAME verb`, my "0 activity lines" report is a lie. Validate with `grep -vE 'known-good-only' <file>` to surface what slipped through.
3. **Post-processing is subtractive.** If opencli dropped whole structural categories, no regex recovers them — use an extraction fallback (API / raw / git mirror), not another cleanup pass.
4. **Declaring victory on the manifest, not the output.** `source.json` notes "spliced 3/3 mermaid + 3/3 tables" and I call it done — but never opened the `.md` file. Mechanism-level success ("splicer ran") ≠ output-level success ("markdown reads well"). Every claim of "pass" must be grounded in the final file, read end-to-end. Deepwiki splicer shipped with duplicate cell-runs below every spliced table; the manifest said 3/3; the user had to point it out.
5. **Cleanup creates its own artifacts.** Removing a cell-run leaves the `**Label:**` bold lead-in orphaned. Stripping a nav block leaves stray blank lines. Splicing a table leaves a double-blank gap after the heading. Every removal/insertion needs a boundary-check on the paragraph immediately before and after.

## 1. Fidelity check (ALWAYS run first)

Count features in output, compare to source. Any category zero in output but non-zero in source → extraction failure, needs a fallback.

```bash
f=raw/2026/<slug>/content.md
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
- **Raw files are user-visible too.** `raw/<slug>/content.md` is not an internal cache — it's opened for inspection. Don't defer chrome removal to a downstream post-processor; do it in the adapter (e.g. `fetchWebReadViaAdapter` calls `deepwikiStripNav.transform` before splicing) so the raw file is clean at the moment it's written. Post-processors that also run later must be idempotent so double-application is safe.
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

## 5. New-URL protocol

When a URL type you haven't seen shows up:

1. **Fidelity probe**: fetch 1–2 sample URLs via opencli, run the fidelity check against source truth (raw / API / HTML).
2. **If fidelity fails** → look for a source-truth endpoint (REST API / raw content / git mirror). Build a fallback adapter modeled on `fetchGithubRawFile` / `augmentGithubPrIssueWithApi` / `fetchGithubReleaseFromApi`.
3. **If fidelity passes** → run `grep -vE 'known-good-pattern' <file>` to surface unexpected chrome. Add to `chromeLinePatterns` / `sidebarCutoffs` as needed.
4. **Show user the first 1–2 outputs before bulk-processing.** Don't guess the quality bar — preferences (what's content vs chrome, formatting choices) aren't knowable from markdown alone. Iterate.
5. **When a preference generalizes, add it here.** Site-specific patterns go in the recipe for that host. Cross-site preferences (like "no bold in headings") go in §3.

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

**Block-ship one-liner** (anything > 0 for remote_imgs/activity, or FM == 0, or feature < contract → DO NOT SHIP):

```bash
f=raw/2026/<slug>/content.md
echo "$f:" \
  "lines=$(wc -l < $f)" \
  "fences=$(grep -c '^```' $f)" \
  "tables=$(grep -c '^|' $f)" \
  "remote_imgs=$(grep -cE '!\[[^]]*]\(https?://' $f)" \
  "activity=$(grep -cE '(merged \[|mentioned this|added .+ commits?|deleted the|self-assigned|approved these|pushed a|\[@[A-Za-z0-9_-]+\]\(/)' $f)" \
  "FM=$(head -5 $f | grep -c 原文链接)"
```

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
| `auto-skipped-hf-space` | L2 pre-fetch skip |
| `deepwiki-mermaid-extraction-failed` / `deepwiki-mermaid-splice-incomplete` | Browser pass failed, or extracted N sources but placed < N (orphan labels remain) |
| `deepwiki-table-extraction-failed` / `deepwiki-table-splice-incomplete` | Browser pass failed, or some tables couldn't find their preceding heading anchor |

`intentional-stub` (set by stub-producing processors) is consumed by classifyQuality → suppresses size-based flags → never appears in final flags.

## 8. Code pointers

- **`tools/fetch-raw.ts`**:
  - `AUTO_SKIP_RULES` — URL refuse-list (currently HF Spaces, L2 skip)
  - `HOST_MIN_BODY_SIZES` — per-host+URL-path size bands
  - `classifyQuality` — flag assembly; consumes `intentional-stub`
  - `fetchWebReadViaAdapter` — opencli wrapper + fallback ladder (60s retry → HF blog GitHub-raw → GitHub release API → GitHub file/repo raw → GitHub PR/issue/discussion REST API augmentation)
  - Fallback adapters: `fetchHuggingFaceBlogFromGithub`, `fetchGithubReleaseFromApi`, `fetchGithubRawFile`, `augmentGithubPrIssueWithApi` (handles all 3 conversation kinds)
- **`tools/hirono/shared/post-process.ts`**:
  - `PROCESSORS` — ordered pipeline
  - `githubStripUIChrome` — match narrow to `/(pull|issues|discussions)/\d+`; internal ordering matters (§4 "Post-processor ordering")
  - `huggingfaceBlogReformat` — KaTeX + anchor prefix + multi-author + image URL normalization + trailing-footer truncation
  - `substackReformat` — paywall + CTAs + click-to-enlarge unwrap
  - `articleCleanup` — generic blog/article trailing-chrome + related-post strip
  - `applyPostProcessors` — aggregates `extraFlags` including `intentional-stub`

## Keeping this file fresh

Update AFTER landing a fix, not during investigation. Durable learnings only — don't log every incident, just the pattern that would generalize to new URLs. Remove struck-through / resolved entries once a session passes without triggering the old bug.
