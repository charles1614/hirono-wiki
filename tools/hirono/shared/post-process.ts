/**
 * Per-site post-processors that clean up raw markdown before it's written to
 * raw/<slug>/content.md. Run AFTER the opencli adapter returns, BEFORE
 * writeRawArchive's image-extraction/download step (so image-URL
 * resolution changes actually drive what gets downloaded).
 *
 * Phase-1 coverage:
 *  - Generic relative-URL resolver (all domains)
 *  - wiki.litenext.digital file-navigator chrome strip
 *  - github.com PR/issue UI-chrome strip + relative-URL resolution
 *  - anthropic.com exploded-SVG cleanup
 *  - Generic HTML color-tag strip
 *
 * Each processor is a pure function; the pipeline composes in `PROCESSORS`
 * order and returns the cumulative result. Unit-testable without I/O.
 */

export interface PostProcessResult {
  md: string;
  /**
   * URLs that are now absolute and should be downloaded by the image
   * pipeline. Processors emit these when they resolve site-relative refs
   * like `/images/foo.png` → `https://lmsys.org/images/foo.png`.
   */
  newAbsoluteImageUrls: string[];
  notes: string[];
}

export interface PostProcessor {
  name: string;
  /** Predicate: should this processor run for the given URL? */
  match: (url: string, host: string) => boolean;
  transform: (md: string, originUrl: string) => PostProcessResult;
}

function hostnameOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

// ---------------------------------------------------------------------------
// Generic: resolve site-relative image URLs to absolute against origin_url
// ---------------------------------------------------------------------------

/**
 * Extract `![](ref)` and `<img src="ref">` references from md that look like
 * WEB-relative URLs we should try to resolve against origin. Intentionally
 * EXCLUDES local-file-like paths (bare filenames or `images/foo.png`
 * directory refs) because opencli's adapters save images to a local
 * `images/` subdirectory with exactly those ref shapes — resolving them
 * produces broken 404 URLs.
 *
 * Included (web refs, attempt to resolve):
 *   - `/path/to/img.png`  (root-relative)
 *   - `//cdn.example.com/img.png`  (protocol-relative)
 *   - `./foo.png`, `../foo.png`  (explicit relative)
 *
 * Excluded (treated as local artifacts, left untouched):
 *   - `images/img_001.png`  (opencli convention for saved local images)
 *   - `figure-1.png`, `bare-filename.jpg`  (no path-separator OR plain dir)
 *   - `data:image/png;base64,...`  (data URIs)
 */
export function extractRelativeImageRefs(md: string): string[] {
  const refs = new Set<string>();
  let inFence = false;
  const looksWebRelative = (ref: string): boolean => {
    if (/^https?:\/\//i.test(ref)) return false;  // already absolute
    if (ref.startsWith("data:")) return false;     // data URI
    if (ref.startsWith("/")) return true;          // root-relative (incl //)
    if (ref.startsWith("./")) return true;         // explicit relative
    if (ref.startsWith("../")) return true;        // explicit parent
    return false;                                  // bare `images/...` or `foo.png` → local artifact
  };
  for (const line of md.split("\n")) {
    if (/^```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    for (const m of line.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      if (looksWebRelative(m[1])) refs.add(m[1]);
    }
    for (const m of line.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
      if (looksWebRelative(m[1])) refs.add(m[1]);
    }
  }
  return [...refs];
}

/** Resolve a possibly-relative URL reference against an origin. Returns null on failure. */
export function resolveAgainstOrigin(ref: string, originUrl: string): string | null {
  if (/^https?:\/\//i.test(ref)) return ref;
  if (ref.startsWith("//")) return "https:" + ref;
  try {
    return new URL(ref, originUrl).toString();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Generic noise cleanup — empty anchor links + over-escaped brackets
// ---------------------------------------------------------------------------

/**
 * Strip empty-text markdown links: `[](#anchor)` produced by header
 * permalink icons on rendered sites (GitHub, Gitea, arxiv, etc.). These
 * appear on their own line and are pure chrome.
 */
export const stripEmptyAnchorLinks: PostProcessor = {
  name: "strip-empty-anchor-links",
  match: () => true,
  transform: (md, _originUrl) => {
    const lines = md.split("\n");
    const emptyLinkLine = /^\s*\[\]\([^)]+\)\s*$/;
    const kept: string[] = [];
    let stripped = 0;
    for (const line of lines) {
      if (emptyLinkLine.test(line)) { stripped++; continue; }
      kept.push(line);
    }
    const cleaned = kept.join("\n").replace(/\n{3,}/g, "\n\n");
    return {
      md: cleaned,
      newAbsoluteImageUrls: [],
      notes: stripped > 0 ? [`stripped ${stripped} empty-text anchor link(s)`] : [],
    };
  },
};

/**
 * Un-escape markdown brackets in link text: `[\[profile\_data\]]` → `[profile_data]`.
 * opencli web-read over-escapes these when the original HTML had literal
 * `[` / `]` in anchor text. The escaped form isn't invalid Markdown but
 * adds visual noise.
 */
export const unescapeBracketsInLinks: PostProcessor = {
  name: "unescape-brackets-in-links",
  match: () => true,
  transform: (md, _originUrl) => {
    // Match `[text](url)` where `text` may contain escaped `\[` / `\]`.
    // The text-capture char class accepts either:
    //   - any char that's not backslash or unescaped `]`
    //   - an escape sequence `\X` (two chars, any X)
    // Both are greedy-then-lazy-safe because the final `](` is the anchor.
    const before = md;
    const out = md.replace(/\[((?:\\.|[^\]\\])*)\]\(([^)]+)\)/g, (_match, text, url) => {
      const clean = text
        .replace(/\\\[/g, "[")
        .replace(/\\\]/g, "]")
        .replace(/\\_/g, "_");
      return `[${clean}](${url})`;
    });
    const changed = out !== before;
    return {
      md: out,
      newAbsoluteImageUrls: [],
      notes: changed ? [`un-escaped brackets in link text`] : [],
    };
  },
};

// ---------------------------------------------------------------------------
// arxiv.org: strip trailing chrome (BibTeX widget, Bookmark buttons)
// ---------------------------------------------------------------------------

/**
 * arxiv.org abstract pages have a lot of trailing chrome after the actual
 * abstract + metadata:
 *   - "export BibTeX citation Loading..."
 *   - "## BibTeX formatted citation" + its empty body
 *   - "Data provided by:" + "### Bookmark" + BibSonomy/Reddit icons
 *   - Various sidebar widgets
 *
 * We truncate the markdown at the first occurrence of these chrome markers,
 * keeping everything before. Conservative: only triggers on the exact
 * marker lines.
 */
export const arxivStripTrailingChrome: PostProcessor = {
  name: "arxiv-strip-trailing-chrome",
  match: (_u, h) => h === "arxiv.org",
  transform: (md, _originUrl) => {
    const chromeMarkers = [
      // Post-abstract chrome (appears right after Abstract in typical layout)
      /^## Submission history\s*$/,
      /^Full-text links:\s*$/,
      /^## Access Paper:\s*$/,
      /^arXiv-issued DOI via DataCite\s*$/,
      // Sidebar nav (appears further down)
      /^Current browse context:\s*$/,
      /^### References & Citations\s*$/,
      /^export BibTeX citation Loading/,
      /^## BibTeX formatted citation/,
      /^### Bookmark\b/,
      /^Data provided by:/,
      /^Change to browse by:\s*$/,
    ];
    const lines = md.split("\n");
    let truncateAt = lines.length;
    for (let i = 0; i < lines.length; i++) {
      if (chromeMarkers.some((re) => re.test(lines[i]))) {
        truncateAt = i;
        break;
      }
    }
    if (truncateAt === lines.length) {
      return { md, newAbsoluteImageUrls: [], notes: [] };
    }
    const cleaned = lines.slice(0, truncateAt).join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
    return {
      md: cleaned,
      newAbsoluteImageUrls: [],
      notes: [`arxiv: truncated trailing chrome at line ${truncateAt + 1} (${lines.length - truncateAt} lines removed)`],
    };
  },
};

/**
 * arxiv-structure-improve: reformat the abstract page body into a clean,
 * section-based layout. Runs AFTER arxivStripTrailingChrome.
 *
 * Transforms:
 *   - Drop duplicate H1s ("# Computer Science > ...", "# Title:...")
 *   - Collapse the 89-author-link line into plain comma-separated names
 *     (truncate at 10 names + "and N more" summary)
 *   - Strip the "View a PDF of the paper titled ..., by ..." marketing line
 *   - Reformat `> Abstract: ...` blockquote as `## Abstract\n\n...`
 *   - Clean up empty "Comments:", "Cite as:" sections + "Focus to learn more"
 *   - Bundle metadata (arXiv ID, submitted/revised, subjects, DOI) into a
 *     compact block right after the first H1
 */
export const arxivStructureImprove: PostProcessor = {
  name: "arxiv-structure-improve",
  match: (_u, h) => h === "arxiv.org",
  transform: (md, originUrl) => {
    // Parse + extract everything we care about in one pass, then rebuild
    // the markdown from scratch. Dropping the append-leftovers approach
    // avoids leaking trailing-chrome lines (Submission history, Access Paper,
    // etc.) that my old line-filter missed.
    const lines = md.split("\n");

    // State we collect
    let title = "";                  // first H1 line content
    let rawSourceLine = "";          // "> 原文链接: ..." line
    let separatorSeen = false;
    let submitted = "";
    let lastRevised = "";
    let version = "";
    let subjects = "";
    let doi = "";
    let pdfLink = "";
    let htmlLink = "";
    const authors: string[] = [];
    let abstractBody = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!title) {
        const h1 = line.match(/^#\s+(.+?)\s*$/);
        if (h1) { title = h1[1]; continue; }
      }

      if (!rawSourceLine) {
        if (/^>\s*原文链接:/.test(line)) { rawSourceLine = line; continue; }
      }

      if (line.trim() === "---" && !separatorSeen) { separatorSeen = true; continue; }

      // arxiv metadata parsers (all safe to skip into the drop pile)
      const subm = line.match(/^\\\[Submitted on ([^[(]+?)(?:\s*\(\[v1\]\([^)]+\)\))?(?:, last revised (.+?) \(this version, (v\d+)\))?\\\]/);
      if (subm) {
        submitted = subm[1].trim();
        if (subm[2]) lastRevised = subm[2].trim();
        if (subm[3]) version = subm[3];
        continue;
      }

      if (/^Authors:/.test(line)) {
        const names = [...line.matchAll(/\[([^\]]+)\]\([^)]+\)/g)].map((m) => m[1]);
        authors.push(...names);
        continue;
      }

      if (/^Subjects:\s*$/.test(line)) {
        // Content is on the next non-empty line
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === "") j++;
        if (j < lines.length) {
          subjects = lines[j].trim();
          i = j;  // skip past the content line
        }
        continue;
      }

      const doiMatch = line.match(/^\[https:\/\/doi\.org\/([^\]]+)\]/);
      if (doiMatch) { doi = doiMatch[1]; continue; }

      // Capture PDF + HTML links for metadata block (line is usually both together)
      if (!pdfLink) {
        const pm = line.match(/\[View PDF\]\((\/pdf\/[^)\s]+)\)/);
        if (pm) pdfLink = pm[1];
      }
      if (!htmlLink) {
        const hm = line.match(/\[HTML[^\]]*\]\((https?:\/\/[^)\s]+)\)/);
        if (hm) htmlLink = hm[1];
      }

      if (/^>\s*Abstract:/.test(line)) {
        // Collect consecutive blockquote lines
        const parts: string[] = [];
        let j = i;
        while (j < lines.length && /^>\s*/.test(lines[j])) {
          parts.push(lines[j].replace(/^>\s*/, "").replace(/^Abstract:\s*/, ""));
          j++;
        }
        abstractBody = parts.join("\n").trim();
        i = j - 1;
        continue;
      }
    }

    // Build fresh markdown with title + metadata + abstract ONLY.
    const result: string[] = [];
    if (title) result.push(`# ${title}`);
    if (rawSourceLine) { result.push("", rawSourceLine); }
    result.push("", "---", "");

    // Metadata block
    const arxivIdMatch = originUrl.match(/\/abs\/(\S+?)(?:v\d+)?$/);
    const arxivId = arxivIdMatch ? arxivIdMatch[1].replace(/v\d+$/, "") : "";
    if (arxivId) {
      const versionedUrl = version
        ? `https://arxiv.org/abs/${arxivId}${version}`
        : `https://arxiv.org/abs/${arxivId}`;
      result.push(`**arXiv ID:** [${arxivId}](${versionedUrl})${version ? ` · ${version}` : ""}`);
    }
    if (submitted) {
      result.push(`**Submitted:** ${submitted}${lastRevised ? ` · **Last revised:** ${lastRevised}` : ""}`);
    }
    if (subjects) result.push(`**Subjects:** ${subjects}`);
    if (authors.length > 0) {
      const shown = authors.slice(0, 10).join(", ");
      const more = authors.length > 10 ? ` (and ${authors.length - 10} more)` : "";
      result.push(`**Authors:** ${shown}${more}`);
    }
    const links: string[] = [];
    if (pdfLink) links.push(`[PDF](https://arxiv.org${pdfLink})`);
    if (htmlLink) links.push(`[HTML](${htmlLink})`);
    if (doi) links.push(`[DOI](https://doi.org/${doi})`);
    if (links.length > 0) result.push(`**Links:** ${links.join(" · ")}`);

    // Abstract section
    if (abstractBody) {
      result.push("", "## Abstract", "", abstractBody);
    }

    const cleaned = result.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
    const notes: string[] = [];
    notes.push("arxiv: restructured (title + metadata + abstract only; dropped all trailing chrome)");
    if (authors.length > 10) notes.push(`arxiv: collapsed ${authors.length}-author list to 10 + summary`);

    return { md: cleaned, newAbsoluteImageUrls: [], notes };
  },
};

/**
 * Processor: for every relative `![](path)` / `<img src="path">` ref in the
 * markdown, rewrite to its absolute URL and emit the absolute URL for the
 * image pipeline to download. Anchor / root-relative / relative paths all
 * resolve via `new URL(ref, originUrl)`.
 */
export const resolveRelativeImageUrls: PostProcessor = {
  name: "resolve-relative-image-urls",
  match: () => true,  // runs for all domains
  transform: (md, originUrl) => {
    const refs = extractRelativeImageRefs(md);
    if (refs.length === 0) return { md, newAbsoluteImageUrls: [], notes: [] };
    const resolved: Array<{ ref: string; abs: string }> = [];
    for (const ref of refs) {
      const abs = resolveAgainstOrigin(ref, originUrl);
      if (abs) resolved.push({ ref, abs });
    }
    let out = md;
    for (const { ref, abs } of resolved) {
      // Replace all occurrences of `(ref` -> `(abs` in markdown image syntax
      // and `src="ref"` -> `src="abs"` in HTML, but be conservative to avoid
      // mangling non-image occurrences. Use exact-token replacement via regex
      // with boundary characters from the original match contexts.
      const escaped = ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`!\\[([^\\]]*)\\]\\(${escaped}\\b`, "g"), `![$1](${abs}`);
      out = out.replace(new RegExp(`src=["']${escaped}(["'])`, "g"), `src="${abs}"$1`);
    }
    const abs = resolved.map((r) => r.abs);
    const notes = resolved.length > 0
      ? [`resolved ${resolved.length} relative image URL(s) against origin`]
      : [];
    return { md: out, newAbsoluteImageUrls: abs, notes };
  },
};

// ---------------------------------------------------------------------------
// DeepWiki (wiki.litenext.digital): strip the file-navigator chrome
// ---------------------------------------------------------------------------

/**
 * DeepWiki pages all start with a "Files" file-navigator sidebar. Pattern is:
 *
 *   ### Files
 *
 *   ← Back
 *
 *   -   01-overview
 *
 *   -   02-system-architecture
 *   ... (all sibling files)
 *
 *   # <repo-name>
 *
 *   Viewing: <filename>
 *
 *   Edit
 *
 *   # <actual-article-title>
 *
 * We strip from `### Files` through the "Edit\n" line, inclusive, and keep
 * the article content that follows. If the pattern doesn't match cleanly,
 * we return the input unchanged (fail-closed).
 */
export const deepwikiStripNav: PostProcessor = {
  name: "deepwiki-strip-file-nav",
  match: (_u, h) => h === "wiki.litenext.digital",
  transform: (md, _originUrl) => {
    // Find the start of the nav block (### Files is the first heading after a possible preamble)
    const filesIdx = md.indexOf("### Files");
    if (filesIdx < 0) return { md, newAbsoluteImageUrls: [], notes: [] };
    // Find the "Edit\n" line that marks end of chrome. After it comes the
    // article title and body.
    const afterFiles = md.slice(filesIdx);
    const editMatch = afterFiles.match(/\nEdit\n/);
    if (!editMatch || editMatch.index === undefined) {
      return { md, newAbsoluteImageUrls: [], notes: [] };
    }
    const editEnd = filesIdx + editMatch.index + editMatch[0].length;
    const cleaned = md.slice(0, filesIdx) + md.slice(editEnd);
    // Collapse multiple blank lines that result from the removal
    const normalized = cleaned.replace(/\n{3,}/g, "\n\n").trimStart();
    return {
      md: normalized,
      newAbsoluteImageUrls: [],
      notes: [`deepwiki: stripped file-navigator chrome (${editEnd - filesIdx} chars)`],
    };
  },
};

// ---------------------------------------------------------------------------
// GitHub: PR / issue UI chrome strip
// ---------------------------------------------------------------------------

/**
 * GitHub pull-request and issue "view source" renders include substantial
 * UI chrome when fetched via web-read. Common offenders:
 *   - "## Pull Request Toolbar" section + its bullets
 *   - "Expand file treeCollapse file tree" / "Collapse file" lines
 *   - "ViewedComment on this fileMore options"
 *   - Line-change summary: `+12Lines changed: 12 additions & 0 deletions`
 *   - "0 / N viewed", "Submit commentsComments"
 *   - "[New issue](/.../issues/new/choose)", "Copy link"
 *
 * We strip well-known offending patterns line-by-line. Conservative: only
 * remove lines that are pure UI-chrome with no substantive content.
 */
export const githubStripUIChrome: PostProcessor = {
  name: "github-strip-ui-chrome",
  match: (_u, h) => h === "github.com",
  transform: (md, _originUrl) => {
    const chromeLinePatterns: RegExp[] = [
      /^Expand file treeCollapse file tree$/,
      /^Collapse file$/,
      /^ViewedComment on this file[A-Za-z ]*$/,
      /^ViewedComment on this file$/,
      /^\+\d+Lines changed: \d+ additions? & \d+ deletions?$/,
      /^\d+ \/ \d+ viewed$/,
      /^Submit commentsComments$/,
      /^Open diff view settings$/,
      /^Open overview panel$/,
      /^\d+ \(\d+\)Open comments panel$/,
      /^More options$/,
      /^Filter options$/,
      /^Copy link$/,
      /^New issue$/,
      /^Open$/,
      /^Closed$/,
      /^All commits$/,
      /^## Pull Request Toolbar$/,
      /^Copy file name to clipboard(Expand all lines:.*)?$/,
      /^Open in \[github\.dev\]\(https:\/\/github\.dev\/\)/,
    ];
    const lines = md.split("\n");
    const kept: string[] = [];
    let stripped = 0;
    for (const line of lines) {
      const trim = line.trim();
      if (chromeLinePatterns.some((re) => re.test(trim))) {
        stripped++;
        continue;
      }
      kept.push(line);
    }
    const cleaned = kept.join("\n").replace(/\n{3,}/g, "\n\n");
    return {
      md: cleaned,
      newAbsoluteImageUrls: [],
      notes: stripped > 0 ? [`github: stripped ${stripped} UI-chrome lines`] : [],
    };
  },
};

// ---------------------------------------------------------------------------
// Anthropic: SVG text-explosion cleanup
// ---------------------------------------------------------------------------

/**
 * Anthropic's blog rendered SVG text into character-per-line breaks:
 *
 *   How
 *
 *   Anthropic
 *
 *   teams
 *
 *   use
 *
 *   Claude
 *
 *   Code
 *
 * Each "word" on its own line with blank separators. Hard to distinguish
 * programmatically from a poem, so we use a conservative heuristic:
 * 8+ consecutive lines of ≤4 words each, AND the block doesn't contain a
 * `#` heading marker or a `![]` image ref. If detected, we replace the
 * block with a single line: `[SVG figure — see source for visual content]`.
 */
export const anthropicStripSvgExplosion: PostProcessor = {
  name: "anthropic-strip-svg-explosion",
  match: (_u, h) => h === "anthropic.com",
  transform: (md, _originUrl) => {
    const lines = md.split("\n");
    const out: string[] = [];
    let i = 0;
    let blocksReplaced = 0;
    while (i < lines.length) {
      // Scan forward to find a run of short non-heading non-image lines
      const start = i;
      let shortRun = 0;
      while (i < lines.length) {
        const t = lines[i].trim();
        const isEmpty = t === "";
        const isShort = t.length > 0 && t.split(/\s+/).length <= 4 &&
                        !t.startsWith("#") && !t.startsWith("![") &&
                        !t.startsWith("- ") && !t.startsWith("* ") &&
                        !/^\d+\./.test(t);
        if (isEmpty || isShort) { i++; if (!isEmpty) shortRun++; }
        else break;
      }
      if (shortRun >= 8) {
        out.push("[SVG figure — see source for visual content]");
        blocksReplaced++;
      } else {
        // Not an exploded SVG; keep the lines as-is
        for (let j = start; j < i; j++) out.push(lines[j]);
      }
      if (i < lines.length) { out.push(lines[i]); i++; }
    }
    const cleaned = out.join("\n").replace(/\n{3,}/g, "\n\n");
    return {
      md: cleaned,
      newAbsoluteImageUrls: [],
      notes: blocksReplaced > 0
        ? [`anthropic: collapsed ${blocksReplaced} exploded-SVG text block(s)`]
        : [],
    };
  },
};

// ---------------------------------------------------------------------------
// Substack (semianalysis etc.): strip duplicate title + paywall chrome,
// simplify click-to-enlarge image wrappers
// ---------------------------------------------------------------------------

/**
 * newsletter.semianalysis.com is a Substack publication. Substack's web
 * render includes a bunch of chrome we don't want in the markdown archive:
 *
 *   - Duplicate `<h1>Title</h1>` (once from the opencli page-title shim +
 *     once from the article body)
 *   - Post-title subtitle as `### ...` (tags/teaser line)
 *   - Author-links line (`[Dylan Patel](...) and [Kimbo Chen](...)`)
 *   - Date line (`Jun 23, 2025`)
 *   - Paid indicator (`∙ Paid`) + engagement counters (likes, shares, `Share`)
 *   - Click-to-enlarge image wrapper: `[ ![](local.png) ](https://substackcdn.com/...)`
 *   - Trailing paywall: `## This post is for paid subscribers` +
 *     subscribe/sign-in links + `PreviousNext` nav
 *
 * We fold metadata (author + date) into the top-of-doc block, drop the
 * chrome, and unwrap click-to-enlarge so markdown shows just `![](local.png)`.
 */
export const substackReformat: PostProcessor = {
  name: "substack-reformat",
  match: (_u, h) =>
    // Known Substack CNAMEs + the generic substack.com domain.
    h === "newsletter.semianalysis.com" ||
    h === "magazine.sebastianraschka.com" ||
    /(?:^|\.)substack\.com$/i.test(h),
  transform: (md, _originUrl) => {
    const notes: string[] = [];
    let out = md;

    // -- Step 1: detect + drop Substack header chrome ---------------------
    // Layout we observe (after `---` separator inserted by fetch-raw):
    //   # <article title H1>   ← may or may not match our synthesized title
    //   ### <subtitle/tag list>  (optional)
    //   [Author](substack/@h1), [Author2](substack/@h2), ... and N others
    //   <Month> <D>, <YYYY>      ← publish date
    //   ∙ Paid                   (optional, paid posts only)
    //   <likes count>            ← bare integer
    //   <share count>            ← bare integer
    //   Share                    ← bare label
    //   Comment                  ← bare label (optional)
    //
    // Matching strategy: find the SECOND H1 within first 30 lines after
    // `---`. That's the article's real title (may or may not equal our
    // synthesized title). Start chrome-strip from that line.
    const lines = out.split("\n");
    const sepIdx = lines.findIndex((l) => l.trim() === "---");
    if (sepIdx >= 0) {
      const scanEnd = Math.min(sepIdx + 30, lines.length);
      // Find second H1 (any title after the `---`). First H1 is line 1 (our
      // synthesized title); second H1 is the article's own H1.
      let articleH1Idx = -1;
      for (let i = sepIdx + 1; i < scanEnd; i++) {
        if (/^#\s+/.test(lines[i])) { articleH1Idx = i; break; }
      }
      if (articleH1Idx >= 0) {
        const toDrop: number[] = [];
        let cursor = articleH1Idx;
        toDrop.push(cursor); cursor++;
        if (cursor < lines.length && lines[cursor].trim() === "") { toDrop.push(cursor); cursor++; }

        // Optional `### subtitle/tags` line
        if (cursor < lines.length && /^#{2,6}\s+/.test(lines[cursor])) {
          toDrop.push(cursor); cursor++;
          if (cursor < lines.length && lines[cursor].trim() === "") { toDrop.push(cursor); cursor++; }
        }

        // Author line: starts with `[<Name>](https://substack.com/@<handle>)`
        // Allow "and N others" suffix.
        if (cursor < lines.length && /^\[[^\]]+\]\(https:\/\/substack\.com\/@[^)]+\)/.test(lines[cursor])) {
          toDrop.push(cursor); cursor++;
          if (cursor < lines.length && lines[cursor].trim() === "") { toDrop.push(cursor); cursor++; }
        }

        // Date line: `Jun 23, 2025` / `Jan 1, 2026`
        if (cursor < lines.length && /^[A-Z][a-z]{2,8} \d{1,2}, \d{4}\s*$/.test(lines[cursor])) {
          toDrop.push(cursor); cursor++;
          if (cursor < lines.length && lines[cursor].trim() === "") { toDrop.push(cursor); cursor++; }
        }

        // Paid indicator + counters + Share label noise
        let consumedCounters = 0;
        while (cursor < lines.length && consumedCounters < 16) {
          const t = lines[cursor].trim();
          if (
            t === "∙ Paid" || t === "Paid" ||
            /^\d{1,6}$/.test(t) ||
            t === "Share" || t === "Comment" ||
            t === ""
          ) {
            toDrop.push(cursor);
            cursor++;
            consumedCounters++;
            continue;
          }
          break;
        }

        // Only actually drop if we stripped enough to be confident it was
        // Substack chrome and not a real section (≥4 lines needed).
        if (toDrop.length >= 4) {
          const dropSet = new Set(toDrop);
          const kept = lines.filter((_, i) => !dropSet.has(i));
          out = kept.join("\n");
          notes.push(`substack: stripped ${toDrop.length} header-chrome line(s)`);
        }
      }
    }

    // -- Step 1b: collapse embedded "related post" cards --------------------
    // Substack renders inline references to OTHER Substack posts as ~10-line
    // cards: `[\n\n#### Title\n\n](url)\n\n[](url)[Author](...)...\n\n·\n\n
    // Date\n\n[\n\nRead full story\n\n](url)`. Collapse each into a single
    // blockquote. State machine (regex-across-newlines is fragile with
    // Unicode separators like `·`).
    {
      const srcLines = out.split("\n");
      const keep: string[] = [];
      let cardsCollapsed = 0;
      let i = 0;
      while (i < srcLines.length) {
        // Detect card start: a lone `[` on a line followed (after blanks)
        // by `#### <title>` then `](<url>)`.
        if (srcLines[i].trim() === "[") {
          // Look ahead for ####, url, author line, ·, date, Read full story
          let j = i + 1;
          while (j < srcLines.length && srcLines[j].trim() === "") j++;
          const titleMatch = j < srcLines.length ? srcLines[j].match(/^####\s+(.+?)\s*$/) : null;
          if (titleMatch) {
            const cardTitle = titleMatch[1];
            let k = j + 1;
            while (k < srcLines.length && srcLines[k].trim() === "") k++;
            const urlMatch = k < srcLines.length ? srcLines[k].match(/^\]\(([^)]+)\)\s*$/) : null;
            if (urlMatch) {
              const cardUrl = urlMatch[1];
              // Walk forward for author line + · + date + Read full story
              // closing `](url)`. Scan at most 15 lines past urlMatch line.
              const scanEnd = Math.min(k + 20, srcLines.length);
              let authorLine = "";
              let dateLine = "";
              let saw = { authors: false, dot: false, date: false, readFull: false, closing: false };
              let cardEnd = -1;
              for (let m = k + 1; m < scanEnd; m++) {
                const t = srcLines[m].trim();
                if (t === "") continue;
                // Tolerate standalone `[](url)` lines (Substack sometimes
                // renders the card title link TWICE — once as the `](url)`
                // close, then again as a bare `[](url)` before the author
                // line). Skip these without advancing state.
                if (!saw.authors && /^\[\]\([^)]+\)\s*$/.test(t)) continue;
                if (!saw.authors && /^(?:\[\]\([^)]+\))?\[[^\]]+\]\(https:\/\/substack\.com\/profile/.test(srcLines[m])) {
                  authorLine = srcLines[m];
                  saw.authors = true;
                  continue;
                }
                if (saw.authors && !saw.dot && t === "·") {
                  saw.dot = true;
                  continue;
                }
                if (saw.dot && !saw.date && /^[\w\d][^\n]*\d{4}\s*$/.test(t)) {
                  // Date — accepts "12 April 2023", "Nov 28, 2025", etc.
                  dateLine = t;
                  saw.date = true;
                  continue;
                }
                if (saw.date && !saw.readFull && t === "[") {
                  // Start of "Read full story" closing link
                  saw.readFull = true;
                  continue;
                }
                if (saw.readFull && t === "Read full story") {
                  continue;
                }
                if (saw.readFull && /^\]\([^)]+\)\s*$/.test(t)) {
                  saw.closing = true;
                  cardEnd = m;
                  break;
                }
                if (saw.readFull) continue;  // tolerate blank/whitespace
                // If we see something that isn't part of the card, bail out
                if (!saw.authors) break;
              }
              if (saw.closing && cardEnd > 0) {
                // Build collapsed blockquote
                const authorNames = [...authorLine.matchAll(/\[([^\]]+)\]\(https:\/\/substack\.com\/profile[^)]+\)/g)].map((m) => m[1]);
                const andOthers = authorLine.match(/and\s+(\d+)\s+others?/i);
                const authorStr = authorNames.join(", ") +
                  (andOthers ? ` (and ${andOthers[1]} others)` : "");
                keep.push(`> 🔗 **Related:** [${cardTitle}](${cardUrl})${authorStr ? ` — ${authorStr}` : ""}${dateLine ? ` · ${dateLine}` : ""}`);
                cardsCollapsed++;
                i = cardEnd + 1;
                continue;
              }
            }
          }
        }
        keep.push(srcLines[i]);
        i++;
      }
      if (cardsCollapsed > 0) {
        out = keep.join("\n").replace(/\n{3,}/g, "\n\n");
        notes.push(`substack: collapsed ${cardsCollapsed} embedded post card(s)`);
      }
    }

    // -- Step 2: unwrap click-to-enlarge `[![](local)](cdn-url)` -----------
    // The wrapper pattern spans multiple lines with blank lines inside.
    // Regex matches: `[\n\n![](something)\n\n](https://substackcdn.com/...)`
    // We keep just the `![](something)` bit.
    const beforeImgUnwrap = out.length;
    out = out.replace(
      /\[\s*\n+\s*(!\[[^\]]*\]\([^)]+\))\s*\n+\s*\]\([^)]+\)/g,
      "$1",
    );
    // Also handle the single-line form
    out = out.replace(
      /\[\s*(!\[[^\]]*\]\([^)]+\))\s*\]\([^)]+\)/g,
      "$1",
    );
    if (out.length < beforeImgUnwrap) {
      notes.push(`substack: unwrapped click-to-enlarge image links`);
    }

    // -- Step 3: strip trailing paywall / subscribe widget -----------------
    const paywallMarkers = [
      /^## This post is for paid subscribers\s*$/m,
      /^## Continue reading\s*$/m,
      /^\[Subscribe\]\(https:\/\/[^)]+\/subscribe/m,
    ];
    for (const re of paywallMarkers) {
      const m = re.exec(out);
      if (m && typeof m.index === "number") {
        out = out.slice(0, m.index).trimEnd() + "\n";
        notes.push(`substack: truncated at paywall/subscribe widget`);
        break;
      }
    }

    // -- Step 4: strip `PreviousNext` / `Previous`/`Next` nav if trailing --
    out = out.replace(/\n(?:PreviousNext|Previous\s+Next|Previous|Next)\s*$/g, "\n");

    return {
      md: out.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n",
      newAbsoluteImageUrls: [],
      notes,
    };
  },
};

// ---------------------------------------------------------------------------
// xhs (xiaohongshu) / xhslink: reformat the opencli `note` table output
// ---------------------------------------------------------------------------

export const xhsReformatNoteTable: PostProcessor = {
  name: "xhs-reformat-note-table",
  match: (_u, h) => /(?:^|\.)xiaohongshu\.com$/i.test(h) || h === "xhslink.com",
  transform: (md, originUrl) => {
    const lines = md.split("\n");
    const kv = new Map<string, string>();
    let sawTable = false;
    for (const line of lines) {
      const m = line.match(/^\|\s*(\w+)\s*\|\s*(.+?)\s*\|\s*$/);
      if (!m) continue;
      const k = m[1];
      const v = m[2];
      if (k === "field" || k === "---") continue;
      sawTable = true;
      kv.set(k, v);
    }
    if (!sawTable) return { md, newAbsoluteImageUrls: [], notes: [] };

    const imagesIdx = md.indexOf("## Images");
    const imagesSection = imagesIdx >= 0 ? md.slice(imagesIdx) : "";

    const reformatContent = (raw: string): string => {
      if (!raw.trim()) return "";
      const breakers = [
        /\s(📌)/g,
        /\s(👉)/g,
        /\s(1️⃣|2️⃣|3️⃣|4️⃣|5️⃣|6️⃣|7️⃣|8️⃣|9️⃣|🔟)/g,
        /\s(✅|❌|⚠️|🔥)/g,
      ];
      let out = raw;
      for (const re of breakers) out = out.replace(re, "\n\n$1");
      out = out.replace(/ {2,}/g, "\n\n");
      return out.split("\n").map((l) => l.trim()).filter((l, i, a) =>
        l !== "" || (a[i - 1] !== undefined && a[i - 1] !== "")
      ).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    };

    const result: string[] = [];
    const title = kv.get("title") || "(Xiaohongshu note)";
    result.push(`# ${title}`);
    result.push("");
    result.push(`**来源 / Source:** ${originUrl}`);
    if (kv.get("author")) result.push(`**作者 / Author:** ${kv.get("author")}`);
    const stats: string[] = [];
    if (kv.get("likes")) stats.push(`${kv.get("likes")} likes`);
    if (kv.get("collects")) stats.push(`${kv.get("collects")} collects`);
    if (kv.get("comments")) stats.push(`${kv.get("comments")} comments`);
    if (stats.length) result.push(`**互动 / Engagement:** ${stats.join(" · ")}`);
    result.push("", "---", "");

    const contentRaw = kv.get("content") || "";
    const contentReformatted = reformatContent(contentRaw);
    if (contentReformatted) {
      result.push(contentReformatted);
      result.push("");
    } else {
      result.push(`*[Text content unavailable — this may be an image-only post.]*`);
      result.push("");
    }

    if (kv.get("tags")) result.push(`**标签 / Tags:** ${kv.get("tags")}`);

    if (imagesSection) {
      result.push("");
      result.push(imagesSection.trimEnd());
    }

    const final = result.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
    return {
      md: final,
      newAbsoluteImageUrls: [],
      notes: [`xhs: reformatted ${kv.size}-field table to prose layout`],
    };
  },
};

// ---------------------------------------------------------------------------
// DeepWiki: wrap disconnected diagram-node runs in a code block
// ---------------------------------------------------------------------------

export const deepwikiWrapDiagramNodes: PostProcessor = {
  name: "deepwiki-wrap-diagram-nodes",
  match: (_u, h) => h === "wiki.litenext.digital",
  transform: (md, _originUrl) => {
    const lines = md.split("\n");
    const out: string[] = [];
    let i = 0;
    let wraps = 0;
    let inCodeFence = false;
    const isDiagramNode = (t: string): boolean => {
      if (t.length === 0) return false;
      if (t.length > 40) return false;
      if (t.split(/\s+/).length > 5) return false;
      if (/^[#\-*>![|`]/.test(t)) return false;
      if (/^\d+\./.test(t)) return false;
      if (/^(?:image|img)\//i.test(t)) return false;
      if (/^https?:\/\//.test(t)) return false;
      return true;
    };
    while (i < lines.length) {
      // Pass through everything inside code fences verbatim — including
      // already-spliced mermaid blocks from the deepwiki-mermaid extractor.
      if (/^```/.test(lines[i].trim())) {
        out.push(lines[i]);
        i++;
        inCodeFence = !inCodeFence;
        continue;
      }
      if (inCodeFence) {
        out.push(lines[i]);
        i++;
        continue;
      }
      const runStart = i;
      const collected: string[] = [];
      // Scan forward while we're still in a diagram-node-run context.
      while (i < lines.length) {
        const t = lines[i].trim();
        if (/^```/.test(t)) break;  // don't consume into a fence
        if (t === "") { i++; continue; }
        if (isDiagramNode(t)) { collected.push(t); i++; continue; }
        break;
      }
      if (collected.length >= 6) {
        out.push("```text");
        out.push(`# Diagram (mermaid nodes — see source for rendered graph)`);
        out.push(...collected);
        out.push("```");
        out.push("");
        wraps++;
      } else {
        // Not a diagram run. Emit [runStart, i) EXCLUSIVE so if i landed on
        // a fence line, the outer loop re-processes it and toggles
        // inCodeFence. If the scan didn't advance, force-advance to guarantee
        // progress.
        for (let j = runStart; j < i && j < lines.length; j++) out.push(lines[j]);
        if (i === runStart) {
          out.push(lines[i]);
          i++;
        }
      }
    }
    const cleaned = out.join("\n").replace(/\n{3,}/g, "\n\n");
    return {
      md: cleaned,
      newAbsoluteImageUrls: [],
      notes: wraps > 0 ? [`deepwiki: wrapped ${wraps} diagram-node run(s) in code blocks`] : [],
    };
  },
};

// ---------------------------------------------------------------------------
// Generic: strip HTML color tags (Feishu-tenant artifact)
// ---------------------------------------------------------------------------

/**
 * Cross-tenant Feishu docs sometimes produce `<text color="blue">1</text>`
 * verbatim in markdown. Remove the opening/closing tags, keep the inner
 * content. Runs for all domains; no-op when tags absent.
 */
export const stripColorTags: PostProcessor = {
  name: "strip-color-tags",
  match: () => true,
  transform: (md, _originUrl) => {
    const before = md.length;
    const cleaned = md
      .replace(/<text\s+color=["'][^"']*["']\s*>/gi, "")
      .replace(/<\/text>/gi, "");
    const delta = before - cleaned.length;
    return {
      md: cleaned,
      newAbsoluteImageUrls: [],
      notes: delta > 0 ? [`stripped ${delta} chars of <text color=...> tags`] : [],
    };
  },
};

// ---------------------------------------------------------------------------
// pipeline
// ---------------------------------------------------------------------------

/**
 * The composed pipeline. Order matters:
 *   1. Site-specific chrome strip FIRST (so image-URL resolution isn't
 *      confused by chrome-embedded refs).
 *   2. Relative-URL resolver SECOND (operates on cleaned markdown).
 *   3. Generic cosmetic cleanups LAST.
 */
export const PROCESSORS: PostProcessor[] = [
  // Site-specific content strips FIRST (while we still have site structure
  // to work with).
  deepwikiStripNav,
  githubStripUIChrome,
  anthropicStripSvgExplosion,
  arxivStripTrailingChrome,
  arxivStructureImprove,
  // substack (semianalysis etc.): strip dup H1 + paywall + unwrap
  // click-to-enlarge. Runs early so URL resolver sees cleaner state.
  substackReformat,
  // xhs: table → prose reformat (runs before URL resolver so resolver
  // doesn't touch the rewritten content)
  xhsReformatNoteTable,
  // deepwiki: wrap diagram-node runs (runs AFTER deepwikiStripNav so the
  // file-navigator chrome is already gone before we look for diagram runs)
  deepwikiWrapDiagramNodes,
  // Then generic URL resolution (acts on whatever markdown survived).
  resolveRelativeImageUrls,
  // Then generic cosmetic cleanups (order matters: strip noise before
  // unescaping, otherwise we'd unescape things we'd immediately strip).
  stripEmptyAnchorLinks,
  unescapeBracketsInLinks,
  stripColorTags,
];

export function applyPostProcessors(
  md: string,
  originUrl: string,
  processors: PostProcessor[] = PROCESSORS,
): {
  md: string;
  appliedNames: string[];
  newAbsoluteImageUrls: string[];
  notes: string[];
} {
  const host = hostnameOf(originUrl);
  let current = md;
  const applied: string[] = [];
  const notes: string[] = [];
  const urls: string[] = [];
  for (const p of processors) {
    if (!p.match(originUrl, host)) continue;
    const r = p.transform(current, originUrl);
    if (r.md !== current || r.notes.length > 0 || r.newAbsoluteImageUrls.length > 0) {
      applied.push(p.name);
    }
    current = r.md;
    notes.push(...r.notes);
    urls.push(...r.newAbsoluteImageUrls);
  }
  return { md: current, appliedNames: applied, newAbsoluteImageUrls: urls, notes };
}
