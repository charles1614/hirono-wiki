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
  /**
   * Optional quality flags the processor wants to surface. Most processors
   * leave this empty. Stub-producing processors (HF Spaces, x.com auth-gate)
   * emit `intentional-stub` so classifyQuality knows to skip size-based
   * flags — the short body is deliberate, not a broken extraction.
   */
  extraFlags?: string[];
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
 * Strip discourse / GFM emoji image references: `![:name:](...twemoji...)`,
 * `![:name:](...emoji.slack-edge.com/...)`, etc. These are forum-style
 * decorative emoji markers that point at remote PNGs. They violate §3
 * ("Images: all local") and add no value once we read the post. Replace
 * with the bare `:name:` shortcode so the emotional cue survives as text.
 */
export const stripDecorativeEmojiImages: PostProcessor = {
  name: "strip-decorative-emoji-images",
  match: () => true,
  transform: (md, _originUrl) => {
    // ![:emoji_name:](https://.../twemoji|emoji|emoji.slack-edge/... "tooltip")
    // Also catches discourse's `![:name:](url ":name:")` with title.
    const re = /!\[:([a-z0-9_+-]+):\]\(https?:\/\/[^)\s]*\/(?:twemoji|emoji|emojis)\/[^)]*\)/gi;
    let count = 0;
    const cleaned = md.replace(re, (_m, name) => {
      count++;
      return `:${name}:`;
    });
    return {
      md: cleaned,
      newAbsoluteImageUrls: [],
      notes: count > 0 ? [`stripped ${count} decorative emoji image ref(s) → shortcodes`] : [],
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
  match: (_u, h) => h === "wiki.litenext.digital" || h === "deepwiki.com",
  transform: (md, _originUrl) => {
    const notes: string[] = [];

    // wiki.litenext.digital pattern: "### Files" ... "Edit\n"
    const filesIdx = md.indexOf("### Files");
    if (filesIdx >= 0) {
      const afterFiles = md.slice(filesIdx);
      const editMatch = afterFiles.match(/\nEdit\n/);
      if (editMatch && editMatch.index !== undefined) {
        const editEnd = filesIdx + editMatch.index + editMatch[0].length;
        const cleaned = md.slice(0, filesIdx) + md.slice(editEnd);
        notes.push(`deepwiki: stripped file-navigator chrome (${editEnd - filesIdx} chars)`);
        return {
          md: cleaned.replace(/\n{3,}/g, "\n\n").trimStart(),
          newAbsoluteImageUrls: [],
          notes,
        };
      }
    }

    // deepwiki.com pattern: nav + TOC links until a lone "Menu\n" line, then "# Article"
    // Strip from start of doc (after the preamble header) through the "Menu" line.
    const menuMatch = md.match(/\nMenu\n/);
    if (menuMatch && menuMatch.index !== undefined) {
      // Find first H1 after "Menu"
      const afterMenu = md.slice(menuMatch.index + menuMatch[0].length);
      const h1Match = afterMenu.match(/^#+\s+/m);
      if (h1Match && h1Match.index !== undefined) {
        // Preserve the preamble block (title + source line + ---) before the nav
        const preambleEnd = md.indexOf("\n---\n");
        const preamble = preambleEnd >= 0 ? md.slice(0, preambleEnd + 5) : "";
        const articleStart = menuMatch.index + menuMatch[0].length + h1Match.index;
        const strippedLeading = articleStart - (preambleEnd >= 0 ? preambleEnd + 5 : 0);
        let cleaned = preamble + "\n" + md.slice(articleStart);

        // Strip deepwiki.com's second-H1 "page title" block that sits
        // between the preamble and the first real H2. The shape is:
        //   # <Page Title>\n\nRelevant source files\n\n-   [link](...)\n\n## First real heading
        // We demote the H1 away entirely (the preamble H1 already carries
        // the canonical title) and also drop the "Relevant source files" line.
        const dupH1Re = /\n#\s+[^\n]+\n\nRelevant source files\n\n(?:-\s+\[[^\]]+\]\([^)]+\)[^\n]*\n\n)+(?=##\s)/;
        const before = cleaned.length;
        cleaned = cleaned.replace(dupH1Re, "\n");
        const dupBytes = before - cleaned.length;

        // Strip deepwiki.com trailing chrome. Appears at the very end:
        //   Dismiss / Refresh this wiki / Enter email to refresh /
        //   ### On this page + TOC list / Ask Devin about X / Fast
        // Cut from the earliest marker through end-of-doc.
        const trailAnchors = [
          /\nDismiss\s*\n/,
          /\n### On this page\s*\n/,
          /\nAsk Devin about [^\n]+\n/,
        ];
        let trailStart = cleaned.length;
        for (const re of trailAnchors) {
          const m = cleaned.match(re);
          if (m && m.index !== undefined && m.index < trailStart) trailStart = m.index;
        }
        let trailBytes = 0;
        if (trailStart < cleaned.length) {
          trailBytes = cleaned.length - trailStart;
          cleaned = cleaned.slice(0, trailStart).replace(/\s+$/, "") + "\n";
        }

        const parts: string[] = [`nav chrome (${strippedLeading} chars)`];
        if (dupBytes > 0) parts.push(`dup H1 block (${dupBytes} chars)`);
        if (trailBytes > 0) parts.push(`trailing chrome (${trailBytes} chars)`);
        notes.push(`deepwiki: stripped ${parts.join(", ")}`);
        return {
          md: cleaned.replace(/\n{3,}/g, "\n\n"),
          newAbsoluteImageUrls: [],
          notes,
        };
      }
    }

    return { md, newAbsoluteImageUrls: [], notes: [] };
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
  // Only run on URL shapes that actually have GitHub DOM chrome:
  //   - PR/issue/discussion pages (speaker structure, activity timeline,
  //     comment editor, sidebars)
  // Raw-markdown URLs (blob, tree, repo-main, releases) arrive via
  // `fetchGithubRawFile` / `fetchGithubReleaseFromApi` with clean markdown
  // that has NO GitHub chrome — running the aggressive dup-H1 strip on
  // these wipes real README content between frontmatter and the first
  // recognized heading (e.g. torchtitan's badges + Latest News section
  // between `---` and `## Overview` got eaten).
  match: (u, h) =>
    h === "github.com" &&
    /\/(?:pull|issues|discussions)\/\d+/.test(u),
  transform: (md, _originUrl) => {
    const notes: string[] = [];
    let out = md;

    // ─── Pass 1: block-level cleanups on the raw markdown ─────────────────

    // 1a. Strip the duplicate-H1 + chrome block that opencli emits after our
    // frontmatter fence. GitHub renders the issue/PR title as a page `<h1>`,
    // followed by a variable-length block of chrome before the actual body:
    //   # \[...\] <title> #NNNN       ← duplicate H1 (often with escaped brackets)
    //   [New issue](...)              ← may appear 0-2 times
    //   [[Title](#top)#NNNN]          ← self-link with `#top` anchor
    //   [![assignee](avatar)](/assignee)   ← assignee avatar (sometimes)
    //   [labelTooltip](labels-query-url)TooltipText[anotherLabelTooltip](...)... ← labels row
    //   [![@OP](avatar)](/OP)         ← OP avatar (sometimes duplicated)
    // Strip everything between the frontmatter fence and the first meaningful
    // heading (`## Description` / `## Summary`) or the OP identity line that
    // our OP-header collapser will handle separately.
    const beforeDupH1 = out.length;
    out = out.replace(
      /(\n---\n)[\s\S]*?(?=\n## (?:Description|Summary|Overview|Background|Motivation)\b|\n### \S+ commented on|\n\[!\[[^\]]*\]\([^)]+\)\]\([^)]+\)\s*\n+### \S+ commented on|\n\[[A-Za-z0-9_-]+\]\(\/[^)]+\)\s+announced in\s+\[|\n## \S+\n\n> (?:opened this|commented|replied) )/,
      "$1\n",
    );
    if (out.length < beforeDupH1) notes.push("github: stripped duplicate H1 + leading chrome block");

    // 1a.0.1. Strip ubiquitous CI-status-loading failure lines that GitHub
    // emits when the check-runs API is still loading or errored out. They
    // appear everywhere in PRs/releases as standalone paragraphs:
    //   Loading
    //   Loading status checks…
    //   ### Uh oh!
    //   There was an error while loading. Please reload this page.
    //   ## Sorry, something went wrong.
    // Each is a standalone line — match at line boundaries (multiline mode)
    // so leading/trailing blank lines don't confuse the matcher.
    let strippedLoading = 0;
    out = out.replace(
      /^[ \t]*(?:Loading|Loading status checks…|### Uh oh!|There was an error while loading\.(?: Please reload this page\.?)?|## Sorry, something went wrong\.?)[ \t]*$/gm,
      () => { strippedLoading++; return ""; },
    );
    if (strippedLoading > 0) notes.push(`github: stripped ${strippedLoading} CI/loading-error line(s)`);

    // 1a.0.2. Strip the "Verified" commit-signature block that GitHub emits
    // on signed commits in release pages and PR merge events. Pattern:
    //   Verified
    //   # Verified
    //   This commit was created on GitHub.com and signed with GitHub's **verified signature**.
    //   GPG key ID: <id>
    //   Verified
    //   [Learn about vigilant mode](...)
    const beforeVerified = out.length;
    // Each `Verified` / `# Verified` line is optional — release pages include
    // the "This commit was created on GitHub.com..." block without the
    // surrounding `Verified` badges, while PR merge events include all three.
    out = out.replace(
      /(?:\n+Verified\s*)?(?:\n+# Verified\s*)?\n+This commit was created on GitHub\.com[^\n]+\n+GPG key ID:[^\n]+(?:\n+Verified\s*)?\n+\[Learn about vigilant mode\]\([^)]+\)\.?/g,
      "",
    );
    if (out.length < beforeVerified) notes.push("github: stripped verified-signature block(s)");

    // 1a.0.3. Strip release-page "Compare / Choose a tag / Filter / No results"
    // chrome (appears between the release H1 and the actual release notes).
    const beforeReleaseTop = out.length;
    out = out.replace(
      /\n+Compare\s*\n+# Choose a tag to compare\s*\n+[\s\S]*?## No results found\s*\n+\[View all tags\]\([^)]+\)\s*\n/g,
      "\n",
    );
    if (out.length < beforeReleaseTop) notes.push("github: stripped release tag-chooser chrome");

    // 1a.0.4.0. Strip the multi-line Discussion-category link that wraps a
    // category icon + name: `[\n\n📣\n\nAnnouncements](/.../categories/...)`.
    out = out.replace(
      /\n+\[\s*\n+[^\n]+\s*\n+[A-Za-z][^\]]*\]\(\/[^)]+\/categories\/[^)]+\)/g,
      "",
    );

    // 1a.0.4.1. Discussion-specific: collapse the "announcer identity" block
    // that follows the duplicate H1. Pattern:
    //   # <title> #NNNN
    //   [NAME](/NAME) announced in [Category](url)
    //   [<title>](#top) #NNNN          ← self-link chrome
    //   [NAME](/NAME)                  ← stripped-avatar author link (dup)
    //   <date> · N comments · M replies
    //   [Return to top](#top)
    //   ## Replies: N comments · M replies
    // → Keep the announcement line only; strip the duplicate H1 and the
    //   duplicate author link.
    out = out.replace(
      /\n+# [^\n]+#\d+\s*\n+(\[[A-Za-z0-9_-]+\]\(\/[^)]+\)\s+announced in\s+\[[^\]]+\]\([^)]+\))/g,
      "\n\n$1",
    );
    // (duplicate-author dedup runs below AFTER avatar strip)

    // 1a.0.4. Strip the trailing reactions block on release pages. Pattern:
    //   Assets N
    //   [loading/error chrome already stripped above]
    //   - 👍
    //   - ... emoji list ...
    //   👍 N username1, username2, ... reacted with thumbs up emoji ...
    //   All reactions
    //   - 👍 N reactions
    //   - ... counts ...
    //   N people reacted
    // We cut from `Assets N` onwards when followed by reaction indicators.
    const beforeReactions = out.length;
    out = out.replace(
      /\n+Assets \d+\s*\n+[\s\S]*?\d+ people reacted\s*\n?/g,
      "\n",
    );
    if (out.length < beforeReactions) notes.push("github: stripped release reactions block");

    // 1a.2. Collapse the OP "opened this issue" identity triplet that appears
    // immediately under `## Description`, replacing the DOM-label heading +
    // avatar/name/date block with a single attribution line. Captures OP
    // username (from the `[NAME](github.com/NAME)` link) and date (from
    // `opened [on DATE](...)`) so the body is clearly attributed.
    //   [![@OP](avatar)](github.com/OP)
    //   [OP](github.com/OP)
    //   opened [on DATE](issue-url)
    //   (Contributor|Member|Owner)?           ← optional role
    //   Issue body actions                      ← kebab menu
    // → `### **<OP>** opened this on <DATE>`
    let collapsedOp = 0;
    out = out.replace(
      /## Description\s*\n+(?:\[!\[@?[^\]]*\]\([^)]+\)\]\([^)]+\)\s*\n+)+(?:\[([^\]]+)\]\([^)]+\)\s*\n+)?opened \[on ([^\]]+)\]\([^)]+\)\s*\n+(?:((?:Contributor|Member|Owner|Collaborator|First-time contributor))\s*\n+)?(?:Issue body actions\s*\n+)?/,
      (_m, name, date, role) => {
        collapsedOp++;
        const who = name || "OP";
        const meta = `opened this on ${date}${role ? ` · ${role}` : ""}`;
        return `## ${who}\n\n> ${meta}\n\n`;
      },
    );
    if (collapsedOp > 0) notes.push("github: collapsed OP identity block into attribution heading");

    // 1a.2.1. Demote all headings inside the OP's issue body by one level so
    // the body's natural `## Summary` / `## Motivation` / ... headings nest
    // under the `## **OP** opened ...` attribution we just inserted. The
    // body region is bounded by the attribution line (inclusive start) and
    // either `## Activity` (inclusive end) or the first `## **NAME**
    // commented ...` line — whichever comes first. We only demote `##` and
    // lower (H1 shouldn't appear; skip it to be safe).
    // OP header is now split across 2 lines: `## NAME\n\n> opened this [discussion]? on DATE`.
    // Match the `> opened this` line as the anchor; body region starts
    // after the blank line below it.
    const opAttrMatch = out.match(/^> opened this (?:discussion )?on [^\n]+$/m);
    if (opAttrMatch && opAttrMatch.index !== undefined) {
      const bodyStart = opAttrMatch.index + opAttrMatch[0].length;
      const after = out.slice(bodyStart);
      const activityIdx = after.search(/^## Activity\s*$/m);
      // The first comment/reply section starts with `## NAME\n\n> commented on ...`
      // or `## NAME\n\n> replied on ...`. Stop BEFORE that `## NAME` line so
      // the comment header doesn't get demoted alongside the OP body's
      // internal headings.
      const commentHeaderMatch = after.match(/\n## \S+\n\n> (?:commented|replied) on /);
      const commentIdx = commentHeaderMatch && commentHeaderMatch.index !== undefined
        ? commentHeaderMatch.index
        : -1;
      const cuts = [activityIdx, commentIdx].filter((i) => i >= 0);
      const bodyEnd = cuts.length > 0 ? bodyStart + Math.min(...cuts) : out.length;
      const head = out.slice(0, bodyStart);
      const body = out.slice(bodyStart, bodyEnd);
      const tail = out.slice(bodyEnd);
      const demoted = body.replace(/^(#{2,5}) /gm, "#$1 ");
      if (demoted !== body) {
        out = head + demoted + tail;
        notes.push("github: demoted OP-body heading levels to nest under attribution");
      }
    }

    // 1a.3. Collapse GitHub label links BEFORE the activity-event collapse —
    // labels appear INSIDE verb phrases ("added [enhancementNew feature or
    // request](...)New feature or request") and need to be clean tokens
    // before we stringify the event line.
    // DOM renders each label as `[<name><tooltip>](labels-query-url)<tooltip>`
    // with label-name + tooltip-text concatenated (no separator). Convert
    // to `` `name` `` with the link preserved.
    let collapsedLabels = 0;
    out = out.replace(
      /\[([a-z][a-z0-9_-]*)([A-Z][^\]]*?)\]\((\/[^)]+\/labels?\/[^)]+|\/[^)]+\/issues\?q=[^)]*label[^)]*)\)(?:\2)?/g,
      (_m, name, _tooltip, url) => { collapsedLabels++; return `[\`${name}\`](${url})`; },
    );
    if (collapsedLabels > 0) notes.push(`github: collapsed ${collapsedLabels} label link(s)`);

    // 1a.4. Activity-event collapser. For every `[![](avatar)NAME](/NAME)`
    // actor line followed by a verb phrase ending in `[on DATE](...)`,
    // collapse to a single `- **NAME** <verb-phrase> on DATE` bullet.
    // Uses `[\s\S]+?` (lazy) so multi-line verb phrases — like the
    // `added\n\n[label](...)\n\nand removed\n\n[label](...)` pattern — are
    // also captured, then whitespace-normalized.
    let collapsedEvents = 0;
    out = out.replace(
      /\n\[!\[[^\]]*\]\([^)]+\)([A-Za-z0-9_-]+)\]\(\/[^)]+\)\s*\n+([\s\S]+?)\s*\[on ([^\]]+)\]\([^)]+\)/g,
      (_m, actor, verb, date) => {
        collapsedEvents++;
        let cleanVerb = verb
          .trim()
          .replace(/\s*\n\s*/g, " ")
          .replace(/\s+/g, " ");
        return `\n- ${actor} ${cleanVerb} on ${date}`;
      },
    );
    // Inline variant: `[actor](/actor)\n\nclosed this as [completed](...)[on DATE](...)` —
    // no space between the `](...)` of the "completed" link and `[on DATE]`.
    out = out.replace(
      /\n\[!\[[^\]]*\]\([^)]+\)([A-Za-z0-9_-]+)\]\(\/[^)]+\)\s*\n+closed this as \[([^\]]+)\]\([^)]+\)\[on ([^\]]+)\]\([^)]+\)/g,
      (_m, actor, how, date) => { collapsedEvents++; return `\n- ${actor} closed this as ${how} on ${date}`; },
    );
    if (collapsedEvents > 0) notes.push(`github: collapsed ${collapsedEvents} activity-event block(s)`);

    // 1a.5. Strip pagination chrome inside the Activity feed. `[Next]` appears
    // at the top of a long timeline; the content is in-page, so it's pure
    // chrome, not a lost-data signal.
    out = out.replace(/\n\[Next\]\(\/[^)]+\?timeline_page=\d+\)\s*\n/g, "\n");

    // 1b. Collapse the GitHub-issue comment-header block. For each comment,
    // GitHub renders the author's identity 3 times:
    //   [![NAME](avatar)](github.com/NAME)       ← leading avatar link
    //   ### NAME commented on DATE                ← the useful line (keep)
    //   [![@NAME](avatar)](/NAME)                 ← duplicate avatar
    //   [NAME](/NAME)                             ← duplicate username
    //   [on DATE](comment-url)                    ← duplicate date
    //   Member|Contributor|Owner                  ← optional role
    //   More actions                              ← kebab menu
    // Collapse to just the `### NAME commented on DATE` + an appended `· Role`
    // if present.
    let collapsedComments = 0;
    out = out.replace(
      // Optional leading avatar line, then the `### NAME commented on DATE` line,
      // then the trailing avatar/username/date/role/More-actions block.
      /(?:\[!\[[^\]]*\]\([^)]+\)\]\([^)]+\)\s*\n+)?### (\S+) commented on ([^\n]+)\n+\[!\[@?[^\]]*\]\([^)]+\)\]\([^)]+\)\s*\n+\[[^\]]+\]\([^)]+\)\s*\n+\[on [^\]]+\]\([^)]+\)\s*\n+(?:(Member|Contributor|Owner|Collaborator|First-time contributor)\s*\n+)?(?:More actions\s*\n+)?/g,
      (_m, name, date, role) => {
        collapsedComments++;
        const meta = `commented on ${date}${role ? ` · ${role}` : ""}`;
        return `## ${name}\n\n> ${meta}\n\n`;
      },
    );
    if (collapsedComments > 0) {
      notes.push(`github: collapsed ${collapsedComments} comment-header block(s)`);
    }

    // 1c. Collapse the multi-line commit-reference block that appears in the
    // activity feed. GitHub renders:
    //   [
    //
    //   <commit title>
    //
    //   ](https://github.com/X/Y/commit/<full-sha>)
    //
    //   ...
    //
    //   [<short-sha>](https://github.com/X/Y/commit/<full-sha>)
    // Collapse to a single-line list entry.
    let collapsedCommits = 0;
    out = out.replace(
      /\[\s*\n+\s*([^\n]+?)\s*\n+\s*\]\((https:\/\/github\.com\/[^)]+\/commit\/([a-f0-9]{7,40})[^)]*)\)\s*\n+\.\.\.\s*\n+\[([a-f0-9]{7,40})\]\(\2\)/g,
      (_m, title, url, _full, short) => {
        collapsedCommits++;
        return `- [\`${short}\`](${url}) ${title}`;
      },
    );
    if (collapsedCommits > 0) {
      notes.push(`github: collapsed ${collapsedCommits} commit-reference block(s)`);
    }

    // 1d. Strip the "N remaining items / Load more" pagination chrome that
    // GitHub emits when a long activity timeline is partially collapsed
    // (content behind "Load more" was not fetched; surface as a flag so the
    // reader knows items are missing).
    const remainingMatch = out.match(/\n### (\d+) remaining items\s*\n+Load more\s*\n/);
    if (remainingMatch) {
      out = out.replace(/\n### \d+ remaining items\s*\n+Load more\s*\n/g, "\n");
      notes.push(
        `github: stripped pagination chrome (${remainingMatch[1]} items behind "Load more" not fetched)`,
      );
    }

    // 1d.1. PR commit-entry collapse. On PR pages, GitHub's timeline renders
    // each commit as a code-formatted title link followed (after CI-loading
    // chrome) by a separate short-SHA link to the same commit:
    //   `[<title>](/<org>/<repo>/pull/<n>/commits/<full-sha> "<title>")`
    //
    //   [chrome — now stripped by 1a.0.1]
    //
    //   `[<short-sha>](/<org>/<repo>/pull/<n>/commits/<full-sha>)`
    // Collapse to `- [\`<short>\`](<path>) <title>`.
    let collapsedPrCommits = 0;
    // Match single OR double backtick wrapper — commit titles containing
    // backticks (e.g. `` ``[`fixed` -> `wrapped`](...)`` ``) use double-tick wrap.
    out = out.replace(
      /(?:``|`)\[([^\]]+)\]\((\/[^")\s]+\/commits\/([a-f0-9]{7,40}))(?:\s+"[^"]*")?\)(?:``|`)[\s\S]*?(?:``|`)\[([a-f0-9]{7,40})\]\(\2\)(?:``|`)/g,
      (_m, title, path, _fullSha, shortSha) => {
        collapsedPrCommits++;
        return `- [\`${shortSha}\`](${path}) ${title}`;
      },
    );
    if (collapsedPrCommits > 0) notes.push(`github: collapsed ${collapsedPrCommits} PR commit entry(ies)`);

    // 1d.2. PR review-approval / review line collapse. Pattern:
    //   **[NAME](/NAME)** approved these changes [Jun 2, 2025](...)
    //   **[NAME](/NAME)** reviewed [Jun 2, 2025](...)
    //   **[NAME](/NAME)** requested changes [Jun 2, 2025](...)
    let collapsedReviews = 0;
    out = out.replace(
      /\*\*\[([A-Za-z0-9_-]+)\]\(\/[^)]+\)\*\*\s+(approved these changes|reviewed|requested changes)\s+\[([^\]]+)\]\([^)]+\)/g,
      (_m, actor, verb, date) => {
        collapsedReviews++;
        return `- ${actor} ${verb} on ${date}`;
      },
    );
    if (collapsedReviews > 0) notes.push(`github: collapsed ${collapsedReviews} review/approval line(s)`);

    // 1d.3. PR "requested review from" event. Example:
    //   [qgallouedec](/qgallouedec) requested review from [edbeeching](/edbeeching),
    //   [kashif](/kashif), [lewtun](/lewtun) and [shirinyamani](/shirinyamani)
    //   [June 2, 2025 14:27](#event-17924693793)
    let collapsedReqReviews = 0;
    out = out.replace(
      /\[([A-Za-z0-9_-]+)\]\(\/[^)]+\)\s+requested review from\s+([^\[]*(?:\[[A-Za-z0-9_-]+\]\(\/[^)]+\)[^\[]*)+)\[([A-Za-z]+ \d{1,2}, \d{4}[^\]]*)\]\(#event-[^)]+\)/g,
      (_m, actor, reviewersRaw, date) => {
        collapsedReqReviews++;
        const reviewers = [...reviewersRaw.matchAll(/\[([A-Za-z0-9_-]+)\]\(\/[^)]+\)/g)].map((m) => m[1]);
        return `- ${actor} requested review from ${reviewers.join(", ")} on ${date}`;
      },
    );
    if (collapsedReqReviews > 0) notes.push(`github: collapsed ${collapsedReqReviews} review-request line(s)`);

    // 1d.4. PR "mentioned this pull request" / "mentioned this" on timeline:
    //   [ACTOR](/ACTOR) mentioned this (pull request)? [DATE](#ref-...)
    //   [referenced title #nnn](url)
    // Collapse the actor+date line, keep the referenced-PR/issue link below.
    let collapsedMentioned = 0;
    out = out.replace(
      /\[([A-Za-z0-9_-]+)\]\(\/[^)]+\)\s+mentioned this(?:\s+pull request|\s+issue)?\s+\[([A-Za-z]+ \d{1,2}, \d{4})\]\(#[^)]+\)/g,
      (_m, actor, date) => {
        collapsedMentioned++;
        return `- ${actor} mentioned this on ${date}`;
      },
    );
    if (collapsedMentioned > 0) notes.push(`github: collapsed ${collapsedMentioned} mentioned-this line(s)`);

    // 1d.5. PR branch/title/assign events. Generic pattern:
    //   [ACTOR](/ACTOR) <verb-phrase> [DATE](#event-...)
    // where <verb-phrase> is one of: "changed the title ...", "deleted the X
    // branch", "restored the X branch", "self-assigned this", "added N commits",
    // "and others added N commits".
    let collapsedMeta = 0;
    out = out.replace(
      /\[([A-Za-z0-9_-]+)\]\(\/[^)]+\)(?:\s+and others)?\s+((?:changed the title|deleted the|restored the|self-assigned this|added \d+ commits?)[^\[]*?)\s*\[([^\]]+)\]\(#[^)]+\)/g,
      (_m, actor, verb, date) => {
        collapsedMeta++;
        return `- ${actor} ${verb.trim()} on ${date}`;
      },
    );
    if (collapsedMeta > 0) notes.push(`github: collapsed ${collapsedMeta} PR-meta-event line(s)`);

    // 1d.4.1. Strip inline "Hide details View details" prefix that GitHub
    // prepends to the merge-event line.
    out = out.replace(/^Hide details View details\s+/gm, "");

    // 1d.5.1. PR merge event — separate pattern because the verb embeds a
    // code-wrapped short-SHA commit link mid-sentence:
    //   (Hide details View details )?[ACTOR](/ACTOR) merged commit [`SHA`](url)
    //     into <branch> [DATE](#event-...)
    let collapsedMerges = 0;
    out = out.replace(
      /(?:Hide details View details\s+)?\[([A-Za-z0-9_-]+)\]\(\/[^)]+\)\s+merged commit\s+\[`([a-f0-9]{7,40})`\]\((\/[^)]+\/commit\/[a-f0-9]+)\)\s+into\s+(\S+)\s+\[([^\]]+)\]\([^)]+\)/g,
      (_m, actor, sha, url, branch, date) => {
        collapsedMerges++;
        return `- ${actor} merged [\`${sha}\`](${url}) into ${branch} on ${date}`;
      },
    );
    if (collapsedMerges > 0) notes.push(`github: collapsed ${collapsedMerges} PR merge event(s)`);

    // 1d.6. "X pushed a commit to Y/Z that referenced this pull request [DATE](...)"
    // followed by the commit's own `[title](commit-url)` + short-sha link.
    let collapsedPushed = 0;
    out = out.replace(
      /\[([A-Za-z0-9_-]+)\]\(\/[^)]+\)\s+pushed a commit to\s+\S+\s+that referenced this pull request\s+\[([^\]]+)\]\(#[^)]+\)/g,
      (_m, actor, date) => {
        collapsedPushed++;
        return `- ${actor} pushed a referencing commit on ${date}`;
      },
    );
    if (collapsedPushed > 0) notes.push(`github: collapsed ${collapsedPushed} pushed-commit event(s)`);

    // 1e. Alternative commit-reference collapse: GitHub sometimes renders
    // the commit-ref block with an inline `[title (](commit-url)[open…](pr-url)`
    // pattern when the commit message references a PR that was force-pushed
    // or truncated. The title is split across two adjacent links and shows
    // as `<title> (open…)` in the rendered DOM.
    //   [<title> (](commit-url)[open…](pr-url)
    //
    //   ...
    //
    //   [<short-sha>](commit-url)
    // → `- [\`<sha>\`](commit-url) <title> (ref [PR #<num>](pr-url))`
    let collapsedAltCommits = 0;
    out = out.replace(
      /\[([^\]]+?)\]\((https:\/\/github\.com\/[^)]+\/commit\/([a-f0-9]{7,40})[^)]*)\)\[[^\]]*\]\((https:\/\/github\.com\/[^)]+\/pull\/(\d+))\)\s*\n+\.\.\.\s*\n+\[([a-f0-9]{7,40})\]\(\2\)/g,
      (_m, title, commitUrl, _fullSha, prUrl, prNum, shortSha) => {
        collapsedAltCommits++;
        const cleanTitle = title.replace(/\s*\(\s*$/, "").trim();
        return `- [\`${shortSha}\`](${commitUrl}) ${cleanTitle} (ref [PR #${prNum}](${prUrl}))`;
      },
    );
    if (collapsedAltCommits > 0) notes.push(`github: collapsed ${collapsedAltCommits} alt-format commit-reference block(s)`);

    // 1f. Global avatar strip. After block-level collapses have consumed
    // the avatar patterns they recognized, any remaining `[![](avatar)TEXT](url)`
    // link has an icon we don't want. Pull out the image part, keep the
    // text and URL intact. Two variants seen in GitHub's DOM:
    //   [![](avatar)username](/username)    ← image alt empty, text after
    //   [![alt](avatar)](/username)         ← image alt filled, no text after
    //                                          (image-only link — replace with
    //                                          the alt text or drop entirely)
    let strippedAvatars = 0;
    // Variant 1: nested image inside link — matches the WHOLE
    // `[![alt](img)TEXT?](URL)` unit so we can inspect the outer URL and
    // decide what to keep:
    //   (a) GitHub user link  `[![@NAME](avatar)](/NAME)` or `[![](avatar)NAME](/NAME)`
    //       → URL is `/username` (relative, no `/apps/`); these are pure
    //       identity/decoration. If there's meaningful text AFTER the image,
    //       keep it (and the link); otherwise drop the whole unit so we don't
    //       leak `[@username](/username)` chrome onto the page.
    //   (b) Badge/external link  `[![arXiv](badge.svg)](https://arxiv.org)`
    //       → URL is http(s) to a third-party host; the alt text is the
    //       semantic label (arXiv, ICLR). Keep `[alt](url)` so the badge
    //       survives as a readable link.
    //   (c) Profile-like relative link with text after image (e.g.
    //       `[![](avatar)cmpatino](/cmpatino)` in an HF author listing) —
    //       keep the text, drop the image.
    out = out.replace(
      /\[!\[([^\]]*)\]\([^)]+\)([^\]]*)\]\(([^)]+)\)/g,
      (_m, alt, text, url) => {
        strippedAvatars++;
        const cleanText = text.trim();
        const cleanAlt = alt.trim();
        const isUserLink =
          /^\/[A-Za-z0-9_-]+(?:\/[^)]+)?$/.test(url) &&
          !url.startsWith("/apps/");
        if (cleanText) {
          // Text-after-image is authoritative (explicit username or label).
          return `[${cleanText}](${url})`;
        }
        if (isUserLink) {
          // No explicit text + relative /user link → pure avatar, strip.
          return "";
        }
        // External link with no text — use alt as label so badges survive.
        return cleanAlt ? `[${cleanAlt}](${url})` : "";
      },
    );
    // Variant 2: `![alt](avatar) [name](/name)` — avatar and user link are
    // SEPARATE markdown elements (no nesting). Drop the image, keep the user
    // link. Appears on release pages and in some timeline contexts.
    out = out.replace(
      /!\[[^\]]*\]\([^)]+\)\s+(\[[A-Za-z0-9_-]+\]\(\/[^)]+\))/g,
      (_m, userLink) => { strippedAvatars++; return userLink; },
    );
    // Variant 3: bare `[@username](/username)` links with no surrounding
    // content — these are avatar residuals where variant-1 already ran on a
    // previous pass, or where the user chose an `@`-prefixed alt. Strip
    // whether they're on their own line or inline.
    out = out.replace(/\[@[A-Za-z0-9_-]+\]\(\/[A-Za-z0-9_-]+\)/g, () => { strippedAvatars++; return ""; });
    if (strippedAvatars > 0) notes.push(`github: stripped ${strippedAvatars} avatar image(s)`);

    // 1f.2. After avatar strip, clean up the inline empty-anchor-link sequences
    // that result. GitHub participant avatar rows look like:
    //   [![](avatar1)](/user1)[![](avatar2)](/user2)[![](avatar3)](/user3)...
    // Variant-2 strips each one to "", but if multiple were on the same line
    // the now-stripped line may still carry surrounding whitespace or, if
    // variant-1 fired instead, concatenated `[](/user1)[](/user2)...` remain.
    // Strip these inline sequences. stripEmptyAnchorLinks only handles
    // whole-line patterns, so we do the inline cleanup here.
    const beforeInlineEmpty = out.length;
    out = out.replace(/(?:\[\s*\]\([^)]+\)\s*){2,}/g, "");
    out = out.replace(/^\s*\[\s*\]\([^)]+\)\s*$/gm, "");
    if (out.length < beforeInlineEmpty) notes.push("github: stripped inline empty-anchor participant list");

    // 1f.3. Discussion-specific post-avatar cleanup: the opener's name often
    // appears twice — once in the announcement line, and again on its own
    // as a trailing avatar link that's been stripped to a bare `[NAME](/NAME)`.
    // Remove the bare duplicate.
    out = out.replace(
      /(\[([A-Za-z0-9_-]+)\]\(\/\2\)\s+announced in\s+\[[^\]]+\]\([^)]+\))(?:\s*\n+\[[^\]]+\]\(#top\)[^\n]*)?\s*\n+\s*\[\2\]\(\/\2\)\s*\n/g,
      "$1\n",
    );

    // 1f.4. Strip leftover leading `[](/user)` empty-anchor on activity-event
    // lines. These are single-avatar residuals that variant-2 stripped to
    // `[](/user)` but the inline-empty-anchor strip (which required 2+) left
    // alone when only one appeared before the event bullet.
    out = out.replace(/^\s*\[\s*\]\([^)]+\)\s+(?=-\s+\S)/gm, "");

    // 1f.5. Strip ALL non-comment activity-timeline content. Per user
    // preference, PR/issue pages should contain only the OP body + human/bot
    // comments. Timeline events (mentioned this / added commit / approved /
    // reviewed / self-assigned / changed title / deleted branch / merged /
    // closed / locked / reopened / pushed referencing commit / label add+remove)
    // and their follow-up cross-reference links + commit-bullet lines are
    // stripped here.
    // Keyword-level verb list. Each entry is a simple keyword or short
    // phrase — we do NOT try to match the full shape (link/sha/url/date
    // suffixes) here. The regex below consumes rest-of-line via `[^\n]*`,
    // so once the verb keyword matches, everything after the actor + verb
    // on that line is discarded.
    const activityVerbs = [
      "mentioned this",
      "added",                 // "added N commits", "added a commit that references", "added [label]"
      "removed",
      "and removed",
      "self-assigned",
      "changed the title",
      "deleted the",
      "restored the",
      "approved these changes",
      "reviewed",
      "requested",             // "requested review from", "requested changes"
      "closed this as",
      "locked as",
      "merged",                // "merged [sha] into BRANCH on DATE"
      "pushed a",              // "pushed a commit", "pushed a referencing commit"
      "reopened this",
      "assigned",
      "unassigned",
    ].join("|");
    // Activity lines appear in multiple shapes depending on avatar-strip state:
    //   `- NAME verb ...`                                        (clean)
    //   ` - NAME verb ...`                                       (leading ws)
    //   `[@NAME](/NAME) - NAME verb ...`                         (avatar preserved as @-link)
    //   `[NAME](/NAME) - NAME verb ...`                          (avatar stripped to plain link)
    // Prefix must be EITHER `- ` OR a `[user](/user)` link — this guards
    // against matching prose inside comment bodies that happens to start
    // with `Name added...` or similar.
    const activityLineRe = new RegExp(
      `^\\s*(?:-\\s+|\\[@?[A-Za-z0-9_-]+\\]\\(\\/[A-Za-z0-9_-]+\\)\\s*-?\\s*)[A-Za-z0-9_-]+\\s+(?:${activityVerbs})\\b[^\\n]*$`,
      "gm",
    );
    let strippedActivity = 0;
    out = out.replace(activityLineRe, () => { strippedActivity++; return ""; });

    // Strip the commit-reference bullet that typically follows an "added a
    // commit that references this" event: `- [\`sha\`](url) title`.
    out = out.replace(
      /^\s*-?\s*\[`[a-f0-9]{7,40}`\]\([^)]+\)[^\n]*$/gm,
      () => { strippedActivity++; return ""; },
    );

    // Strip the backticked short-SHA follow-up bullet: `` `[shortsha](commit-url)` ``.
    out = out.replace(
      /^\s*`\[[a-f0-9]{7,40}\]\([^)]+\)`\s*$/gm,
      () => { strippedActivity++; return ""; },
    );

    // Strip the pathological backticked commit-reference line that GitHub
    // emits for merge commits / cross-repo commit refs. Shapes vary:
    //   `` `[title (](commit "tooltip") [link](url) [into ff…](commit)` ``
    //   `` `[📉 FFD packing (](commit "tooltip")[huggingface#3521](pr)[)](commit)` ``
    // The tooltip contains unbalanced parens (e.g. `"(#3521)"`) which break
    // a `[^)]+` URL matcher. Use a permissive pattern: any backticked line
    // that contains a `/commit/<sha>` URL is an activity-timeline artifact.
    out = out.replace(
      /^\s*`[^`\n]*\/commits?\/[a-f0-9]{7,40}[^`\n]*`\s*…?\s*$/gm,
      () => { strippedActivity++; return ""; },
    );
    // And the stray `…d\_pack` truncation-tail line that follows.
    out = out.replace(/^\s*…[A-Za-z0-9\\_-]+\s*$/gm, () => { strippedActivity++; return ""; });

    // Strip orphan cross-reference links that follow "mentioned this" events:
    // lines that are JUST `[Some PR title #NNN](/org/repo/pull/N)` or a bullet
    // containing only that link.
    out = out.replace(
      /^\s*-?\s*\[[^\]]*#\d+\]\(\/[^)]+\/(?:pull|issues)\/\d+\)\s*$/gm,
      () => { strippedActivity++; return ""; },
    );

    // Strip bare `[NAME](/NAME)` user-link lines (residual from stripped
    // avatars that had meaningful text kept). These appear in participant
    // rows, reviewer rows, and activity-actor prefixes that were left behind
    // when the rest of the line was stripped.
    out = out.replace(
      /^\s*\[[A-Za-z0-9_-]+\]\(\/[A-Za-z0-9_-]+\)\s*$/gm,
      () => { strippedActivity++; return ""; },
    );

    // Strip the `## Activity` section header (the content under it is gone).
    out = out.replace(/^## Activity\s*$/gm, "");

    if (strippedActivity > 0) {
      notes.push(`github: stripped ${strippedActivity} activity-timeline line(s) (keeping only OP + comments)`);
    }

    // 1g. Strip redundant GitHub DOM section labels that render as empty
    // H2 shells (they're DOM organizers, not user content).
    const emptyH2Patterns: RegExp[] = [
      /^## Description\s*$/,
    ];
    const beforeEmptyH2 = out.length;
    for (const re of emptyH2Patterns) {
      // Strip the heading only if it's immediately followed by another
      // heading (nothing substantive in between).
      out = out.replace(new RegExp(`${re.source}\\n+(?=#)`, "gm"), "");
    }
    if (out.length < beforeEmptyH2) notes.push("github: stripped empty DOM-label headings");

    // ─── Pass 2: line-level chrome filter ────────────────────────────────
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
      /^\[New issue\]\(\/[^)]+\/issues\/new\/choose\)\s*$/,
      /^Open$/,
      /^Closed$/,
      /^All commits$/,
      /^## Pull Request Toolbar$/,
      /^## Conversation\s*$/,  // PR tab label; activity events stand alone
      /^Copy file name to clipboard(Expand all lines:.*)?$/,
      /^Open in \[github\.dev\]\(https:\/\/github\.dev\/\)/,
      /^\[Open in github\.dev\]\([^)]+\)\s*(?:\[[^\]]+\]\([^)]+\)\s*)*$/,
      // Issue/PR comment-header remnants (in case the block-collapse didn't match)
      /^Issue body actions\s*$/,
      /^More actions\s*$/,
      /^Contributor\s*$/,
      /^Member\s*$/,
      /^Owner\s*$/,
      /^Collaborator\s*$/,
      /^First-time contributor\s*$/,
      /^Load more\s*$/,
      /^### \d+ remaining items?\s*$/,
      /^\[\[[^\]]+\]\(#top\)[^\n]*$/, // stray `[[Title](#top)#NNNN]` self-link
      /^\[[^\]]+\]\(#top\)\s*#\d+\s*$/, // stray `[Title](#top) #NNNN` self-link
      /^\[Return to top\]\(#top\)\s*$/,
      // PR / release / discussion chrome
      /^Verified\s*$/,
      /^Merged\s*$/,
      /^Approved\s*$/,
      /^Changes requested\s*$/,
      /^\d+ tasks?\s*$/,
      /^\d+ participants?\s*$/,
      /^Hide details View details\s*$/,
      /^\d+ checks? passed\s*$/,
      /^\d+ \/ \d+ checks? passed\s*$/,
      /^Compare\s*$/,
      /^Filter\s*$/,
      /^Loading\s*$/,
      /^Loading status checks…\s*$/,
      /^No results found\s*$/,
      /^\[View all tags\]\([^)]+\)\s*$/,
      /^\[View reviewed changes\]\([^)]+\)\s*$/,
      /^This was referenced [A-Z][a-z]+ \d{1,2}, \d{4}\s*$/,
      /^Comment thread \[[^\]]+\]\([^)]+\)[^[]*(?:Show resolved Hide resolved|Outdated Show resolved Hide resolved)\s*$/,
      // Release reactions (cleanup in case the block-level strip missed tail lines)
      /^All reactions\s*$/,
      /^\d+ people reacted\s*$/,
      /^\s*-\s*[👍👎😄🎉❤️🚀👀]\s*\d*(?: reactions?)?\s*$/u,
      // Comment-editor toolbar chrome (appears in PR/Discussion comment boxes)
      /^Comment Write Preview\s*$/,
      /^Heading\s*$/,
      /^Bold\s*$/,
      /^Italic\s*$/,
      /^Quote\s*$/,
      /^Code\s*$/,
      /^Link\s*$/,
      /^Numbered list\s*$/,
      /^Unordered list\s*$/,
      /^Task list\s*$/,
      /^Attach files\s*$/,
      /^Mention\s*$/,
      /^Reference\s*$/,
      /^Saved replies\s*$/,
      /^Slash commands\s*$/,
      /^Menu\s*$/,
      // Same toolbar labels but as list items (bulleted form seen on Discussions)
      /^-\s+Heading\s*$/,
      /^-\s+Bold\s*$/,
      /^-\s+Italic\s*$/,
      /^-\s+Quote\s*$/,
      /^-\s+Code\s*$/,
      /^-\s+Link\s*$/,
      /^-\s+Numbered list\s*$/,
      /^-\s+Unordered list\s*$/,
      /^-\s+Task list\s*$/,
      /^-\s+Attach files\s*$/,
      /^-\s+Mention\s*$/,
      /^-\s+Reference\s*$/,
      /^-\s+Saved replies\s*$/,
      /^-\s+Slash commands\s*$/,
      /^Add files Paste, drop, or click to add files\s*$/,
      /^Add your comment here\.\.\.\s*$/,
      /^Markdown is supported\s*$/,
      /^\[Markdown is supported\]\([^)]+\)\s*$/,
      /^We don['’]t support that file type\.?\s*$/,
      /^This file is empty\.?\s*$/,
      /^This file is hidden\.?\s*$/,
      /^Something went really wrong[^\n]*\s*$/,
      /^Try again(?: with[^\n]+)?\.?\s*$/,
      /^Attaching documents requires write permission to this repository\.?\s*$/,
      /^Select a reply\s*$/,
      /^# Select a reply\s*$/,
      /^\[Create a new saved reply\]\([^)]+\)\s*$/,
      /^There was an error creating your [A-Za-z]+\.\s*$/,
      /^#### An unexpected error has occurred\s*$/,
      /^\*\*ProTip!\*\* Add comments to specific lines under \[Files changed\]\([^)]+\)\.?\s*$/,
      /^Remember, contributions to this repository should follow[^\n]+$/,
      /^Reviewers whose approvals may not affect merge requirements\s*$/,
      /^\+\d+ more reviewers?\s*$/,
      /^### Reviewers\s*$/,
      // Discussion-specific
      /^Jan \d+, 20\d{2} · \d+ comments? · \d+ replies\s*$/,
      /^[A-Z][a-z]+ \d+, 20\d{2} · \d+ comments? · \d+ replies\s*$/,
      /^## Replies: \d+ comments? · \d+ replies\s*$/,
      /^Category\s*$/,
      /^Comment\s*$/,  // stray "Comment" button label (discussion + PR editors)
      /^📣\s*$/,        // bullhorn emoji standalone (discussion category icon)
      /^\s*\[\s*$/,    // stray `[` that opens a multi-line link to discussion category
      /^Announcements\]\(\/[^)]+\)\s*$/,  // the closer of `[ / emoji / text ](url)` split-link
      // Issue / PR sidebar chrome
      /^No branches or pull requests\s*$/,
      /^Notifications?\s*$/,
      /^Customize\s*$/,
      /^Subscribe\s*$/,
      /^You're not receiving notifications/i,
      /^You['’]re not receiving notifications/i,
      /^### Participants\s*$/,
      /^### Issue actions\s*$/,
      /^## Issue actions\s*$/,
      /^-\s*Give feedback\s*$/,
      /^Linked pull requests?\s*$/,
      /^Assignees?\s*$/,
      /^Labels?\s*$/,
      /^Projects?\s*$/,
      /^Milestone\s*$/,
      /^Development\s*$/,
      /^Lock conversation\s*$/,
      /^Pin issue\s*$/,
      /^Convert to discussion\s*$/,
      /^Transfer issue\s*$/,
      /^Delete issue\s*$/,
      /^\+\d+\s*$/,  // participant count overflow "+2"
      /^No projects\s*$/,
      /^No milestone\s*$/,
      /^None yet\s*$/,
      /^### Milestone\s*$/,
      /^### Relationships\s*$/,
      /^### Development\s*$/,
      /^### Notifications\s*$/,
    ];
    // Sidebar section headers that mark start of trailing chrome (GitHub issues/PRs/discussions).
    // These heading-level sidebar sections always appear after all actual content.
    const sidebarCutoffs: RegExp[] = [
      /^## Metadata\s*$/,          // GitHub trailing metadata block
      /^## Add a comment\s*$/,     // issue comment box chrome
      /^### Add a comment\s*$/,    // discussion comment-box marker — on
                                   //   discussions the replies appear BEFORE
                                   //   this line in the DOM, so cutting here
                                   //   is safe (preserves content above).
      /^#### Add a comment\s*$/,   // PR comment box chrome (always trails)
      /^## Merge info\s*$/,        // PR merge-info + editor chrome
      /^### Reviewers\s*$/,        // PR reviewers sidebar
      /^#### Events\s*$/,          // discussion events sidebar
      /^### Assignees?\s*$/,       // bottom sidebar always starts here
      /^### Participants\s*$/,
      /^## Participants\s*$/,
      /^### Projects?\s*$/,
      /^## Projects?\s*$/,
      /^### Fields\s*$/,
      /^### Labels?\s*$/,
      /^### Type\s*$/,
      /^### Relationships?\s*$/,
    ];
    const lines = out.split("\n");
    const kept: string[] = [];
    let stripped = 0;
    let truncated = false;
    for (const line of lines) {
      if (truncated) break;
      const trim = line.trim();
      if (sidebarCutoffs.some((re) => re.test(trim))) { truncated = true; break; }
      if (chromeLinePatterns.some((re) => re.test(trim))) {
        stripped++;
        continue;
      }
      kept.push(line);
    }
    let cleaned = kept.join("\n").replace(/\n{3,}/g, "\n\n");
    if (stripped > 0) notes.push(`github: stripped ${stripped} UI-chrome lines`);
    if (truncated) notes.push(`github: truncated at sidebar`);

    // 3. Final trailing-avatar cleanup: done last so we also catch avatars
    // that became newly-trailing after pass-2 line-strip collapsed the
    // lines below them. Strip up to 3 consecutive trailing avatar/user-link
    // lines (GitHub sometimes leaks multiple reactions / watchers avatars).
    const beforeTailTrim = cleaned.length;
    for (let i = 0; i < 3; i++) {
      const next = cleaned.replace(/\n+\[!\[[^\]]*\]\([^)]+\)\]\(\/[^)]+\)\s*\n*$/, "\n");
      if (next === cleaned) break;
      cleaned = next;
    }
    if (cleaned.length < beforeTailTrim) notes.push("github: stripped trailing stray avatar link(s)");

    return {
      md: cleaned.trimEnd() + "\n",
      newAbsoluteImageUrls: [],
      notes,
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
    h === "sebastianraschka.com" ||
    /(?:^|\.)substack\.com$/i.test(h),
  transform: (md, _originUrl) => {
    const notes: string[] = [];
    let out = md;

    // -- Step 0: strip "Discover more from X" newsletter CTA block --------
    // This block appears between the `---` separator and the article H1.
    // Pattern: "Discover more from [Name]\n\n...\n\nOver N subscribers\n\n..."
    out = out.replace(
      /\n(Discover more from [\s\S]+?Over \d[\d,]* subscribers?[\s\S]*?\n)(?=# |\n# )/g,
      "\n",
    );

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

    // -- Step 3: strip trailing paywall / subscribe widget + engagement ----
    const paywallMarkers = [
      /^## This post is for paid subscribers\s*$/m,
      /^## Continue reading\s*$/m,
      /^\[Subscribe\]\(https:\/\/[^)]+\/subscribe/m,
      // Likes facepile: "NN Likes∙" line with engagement counters
      /^\d{1,6}\s*Likes[∙·]\s*$/m,
    ];
    for (const re of paywallMarkers) {
      const m = re.exec(out);
      if (m && typeof m.index === "number") {
        // Walk back past avatar images AND past the subscribe/legal block.
        const before = out.slice(0, m.index);
        // Strip trailing avatar images
        let cleaned = before.replace(/\s*(?:!\[[^\]]*\]\([^)]+\)\s*)+$/i, "");
        // Strip trailing subscribe CTA blocks. Substack may have 1-3 CTAs
        // at the bottom. Strategy: walk backwards from end of cleaned, find
        // any `* * *` divider followed by subscribe-related content, and
        // truncate there. Repeat until no more subscribe-adjacent dividers.
        const subscribeIndicators = [
          /\bsubscribe\b/i,
          /\bsupport my work\b/i,
          /\breader.supported\b/i,
          /\bpaid subscriber/i,
        ];
        let prev = cleaned;
        for (let attempt = 0; attempt < 4; attempt++) {
          // Find all `* * *` occurrences
          const dividers: number[] = [];
          let searchFrom = 0;
          let idx: number;
          while ((idx = prev.indexOf("\n\n* * *\n", searchFrom)) >= 0) {
            dividers.push(idx);
            searchFrom = idx + 1;
          }
          let cut = -1;
          // Walk dividers from the end; if the block after a divider looks
          // subscribe-related AND is within 3000 chars of end, cut there.
          for (let d = dividers.length - 1; d >= 0; d--) {
            const afterDiv = prev.slice(dividers[d], Math.min(dividers[d] + 500, prev.length));
            if (subscribeIndicators.some((re) => re.test(afterDiv))) {
              cut = dividers[d];
              break;
            }
          }
          if (cut < 0) break;
          prev = prev.slice(0, cut);
        }
        cleaned = prev;
        out = cleaned.trimEnd() + "\n";
        notes.push(`substack: truncated at paywall/subscribe/engagement widget`);
        break;
      }
    }

    // -- Step 4: strip `PreviousNext` / `Previous`/`Next` nav if trailing --
    out = out.replace(/\n(?:PreviousNext|Previous\s+Next|Previous|Next)\s*$/g, "\n");

    // -- Step 4b: strip trailing engagement-counter block -------------------
    // Pattern: one or more bare integers + "Share" at end of doc, possibly
    // with blank lines between. e.g. "\n47\n\n55\n\nShare\n"
    out = out.replace(/(\n\s*\d+\s*)+\n\s*Share\s*$/g, "\n");

    // -- Step 5: strip inline "reader-supported / Subscribe" CTA blocks -----
    // Substack injects these mid-article and at the end. Strip wherever found.
    out = out.replace(
      /\n\n[A-Z][^.\n]+ is a reader-supported publication[^\n]*\n\nSubscribe\n?/g,
      "\n\n",
    );

    // -- Step 6: strip trailing `* * *` + author/subscribe CTA block --------
    // Run unconditionally: catches cases where paywall handler fired too early.
    out = out.replace(
      /\n\n\* \* \*\n\n([\s\S]{0,3000})$/,
      (match, block) => {
        if (/\bsubscribe\b|\bpersonal passion\b|\breader.supported\b|\bsupport my work\b/i.test(block)) {
          return "\n";
        }
        return match;
      },
    );

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
  match: (_u, h) => h === "wiki.litenext.digital" || h === "deepwiki.com",
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
// arxiv.org: note when URL is a raw PDF (binary, not useful as markdown)
// ---------------------------------------------------------------------------

export const arxivPdfNote: PostProcessor = {
  name: "arxiv-pdf-note",
  match: (u, h) => h === "arxiv.org" && /\/pdf\//.test(u),
  transform: (md, originUrl) => {
    const absUrl = originUrl.replace(/\/pdf\//, "/abs/").replace(/\.pdf$/, "");
    // If the PDF fetch produced no real content (Chrome's PDF viewer
    // sometimes yields empty/near-empty markdown), emit a proper stub
    // pointing at the abstract page instead of a ~100-char note-only file.
    // Threshold 1500 chars: an actual paper extract is many KB.
    if (md.length < 1500) {
      const stub = [
        `# arXiv Paper (PDF-only fetch)`,
        ``,
        `> **Source:** ${originUrl}`,
        `> **Status:** pdf-extraction-incomplete — Chrome's PDF viewer produced little or no extractable text.`,
        `> **Abstract:** ${absUrl}`,
        ``,
        `*This entry is a metadata stub. Refetch the abstract URL above for paper metadata + HTML body.*`,
        ``,
      ].join("\n");
      return {
        md: stub,
        newAbsoluteImageUrls: [],
        notes: [`arxiv: PDF fetch empty — produced stub pointing at ${absUrl}`],
        extraFlags: ["intentional-stub"],
      };
    }
    const note = `\n> **Note:** This was fetched from a PDF URL. For structured metadata see the [abstract page](${absUrl}).\n`;
    return {
      md: md.trimEnd() + "\n" + note,
      newAbsoluteImageUrls: [],
      notes: [`arxiv: added PDF-URL note (abstract: ${absUrl})`],
    };
  },
};

// ---------------------------------------------------------------------------
// sebastianraschka.com: personal blog — strip nav / footer chrome
// ---------------------------------------------------------------------------

export const sebastianraschkaBlogCleanup: PostProcessor = {
  name: "sebastianraschka-blog-cleanup",
  match: (_u, h) => h === "sebastianraschka.com",
  transform: (md, _originUrl) => {
    const lines = md.split("\n");
    const chromePatterns: RegExp[] = [
      /^Subscribe to my newsletter/i,
      /^Sign up to receive/i,
      /^Follow me on/i,
      /^Twitter\s*[\|·]/i,
      /^GitHub\s*[\|·]/i,
      /^\[Twitter\]/i,
      /^\[GitHub\]/i,
      /^←\s*(Back|Previous)/i,
      /^→\s*(Next|Forward)/i,
      /^Tags?:/i,
      /^Share:/i,
      /^Posted (in|on)\b/i,
      /^Filed under\b/i,
      /^© \d{4}/,
    ];
    const kept: string[] = [];
    let stripped = 0;
    for (const line of lines) {
      const t = line.trim();
      if (chromePatterns.some((re) => re.test(t))) { stripped++; continue; }
      kept.push(line);
    }
    return {
      md: kept.join("\n").replace(/\n{3,}/g, "\n\n"),
      newAbsoluteImageUrls: [],
      notes: stripped > 0 ? [`sebastianraschka: stripped ${stripped} chrome lines`] : [],
    };
  },
};

// ---------------------------------------------------------------------------
// HuggingFace blog: strip KaTeX triple-render, engagement chrome, anchor prefixes
// ---------------------------------------------------------------------------
//
// HuggingFace's blog rendering injects a lot of junk that the generic article
// cleanup can't handle:
//   1. KaTeX renders each formula THREE times inline:
//      `<text-fallback> <LaTeX-source> <alt-text-fallback>`
//      where <LaTeX-source> contains `\\[a-zA-Z]+` commands (two literal
//      backslashes + letters — see file hex dump) and the fallbacks use
//      unicode math chars. We detect the triplet and collapse to `$<LaTeX>$`.
//   2. Every heading has an anchor-link prefix: `## [](#anchor-slug)Title`.
//   3. A duplicate H1 (after the main H1) also carries the anchor prefix.
//   4. Top-of-article engagement: `Upvote / NNN / avatar list / +NNN`.
//   5. Author block with awkward `[Name\n\nhandle\n\nFollow](/profile)` shape.
//   6. Nav links `[Back to Articles]`, `[Update on GitHub]`.
//   7. Trailing `More Articles from our Blog` section + related-post cards.

export const huggingfaceBlogReformat: PostProcessor = {
  name: "huggingface-blog-reformat",
  match: (_u, h) => h === "huggingface.co",
  transform: (md, originUrl) => {
    const notes: string[] = [];
    let out = md;

    // 0. Detect HF blog 404 page ("# 404\n\nThis blog post does not exist")
    //    and short-circuit with a proper stub.
    if (/^# 404\s*$/m.test(md) && /This blog post does not exist/.test(md)) {
      const stub = [
        `# HuggingFace Blog Post (not found)`,
        ``,
        `> **Source:** ${originUrl}`,
        `> **Status:** page-removed — HuggingFace returned 404 for this blog slug.`,
        ``,
        `*This entry is a metadata stub. The post may have been renamed, unpublished, or never existed.*`,
        ``,
      ].join("\n");
      return {
        md: stub,
        newAbsoluteImageUrls: [],
        notes: [`hf: 404 page detected — produced stub`],
        extraFlags: ["intentional-stub"],
      };
    }

    // 1. Strip `[Back to Articles](/blog)` nav link
    const beforeBack = out.length;
    out = out.replace(/^\[Back to Articles\]\([^)]+\)\s*\n/m, "");
    if (out.length < beforeBack) notes.push("hf: stripped Back-to-Articles nav");

    // 2. Strip anchor-prefix from ALL headings: `## [](#slug)Title` → `## Title`
    const anchorRe = /^(#+\s+)\[\]\(#[^)]+\)\s*(.+)$/gm;
    let anchorCount = 0;
    out = out.replace(anchorRe, (_m, hash, title) => {
      anchorCount++;
      return `${hash}${title}`;
    });
    if (anchorCount > 0) notes.push(`hf: stripped ${anchorCount} heading anchor prefix(es)`);

    // 3. Strip the post-frontmatter header block: duplicate H1 + "Published ..."
    //    + "[Update on GitHub](...)" lines. These appear after the `---` fence
    //    that separates our generated frontmatter from the fetched body.
    const beforeHeader = out.length;
    out = out.replace(
      /(\n---\n)\s*# [^\n]+\n+(?:Published [^\n]+\n+)?(?:\[Update on GitHub\]\([^)]+\)\s*\n)?/,
      "$1\n",
    );
    if (out.length < beforeHeader) notes.push("hf: stripped duplicate-H1 + Published + Update-on-GitHub header");

    // 4. Strip top engagement block:  ` Upvote\n\nNNN\n\n- [avatar](/user) ... - +NNN\n`
    out = out.replace(
      /\n\s*Upvote\s*\n+\d+\s*\n+(?:-\s*\[!\[\]\([^)]+\)\]\([^)]+(?:\s+"[^"]*")?\)\s*\n+)+(?:-\s*\+\d+\s*\n+)?/g,
      "\n",
    );

    // 5. Reformat author blocks (handles multi-author posts). Each block:
    //   [![Name's avatar](img)](/user)
    //   [Name
    //   user
    //   Follow
    //   ](/user)
    // Multi-author pages have N of these back-to-back; we collapse all into a
    // single line: `> **Authors:** [A](/a) (@a), [B](/b) (@b), ...`
    const authorBlockRe =
      /\[!\[([^\]]*?)(?:'s avatar)?\]\([^)]+\)\]\(\/([^)]+)\)\s*\n+\[([^\n]+)\n+([^\n]+)\n+Follow\s*\n+\]\(\/[^)]+\)/g;
    const authors: Array<{ name: string; handle: string }> = [];
    let scanMatch: RegExpExecArray | null;
    while ((scanMatch = authorBlockRe.exec(out)) !== null) {
      authors.push({ name: scanMatch[3].trim(), handle: scanMatch[4].trim() });
    }
    if (authors.length > 0) {
      let idx = 0;
      out = out.replace(authorBlockRe, () => {
        idx++;
        if (idx > 1) return ""; // drop subsequent blocks
        const label = authors.length === 1 ? "Author" : "Authors";
        const rendered = authors
          .map((a) => `[${a.name}](/${a.handle}) (@${a.handle})`)
          .join(", ");
        return `> **${label}:** ${rendered}`;
      });
      notes.push(`hf: reformatted ${authors.length} author block(s)`);
    }

    // 5b. Normalize HuggingFace datasets image URLs that use backslash-escaped
    // parens (`image%20\(17\).png`). The generic image-URL extractor's regex
    // `[^)\s]+` stops at the first `)`, truncating the URL mid-path and failing
    // to download. Converting `\(` / `\)` to the URL-encoded form `%28` / `%29`
    // yields a paren-free URL that extractImageUrls + curl can both handle.
    // Surfaced URLs are returned via `newAbsoluteImageUrls` so the
    // post-processor image-download pass picks them up.
    const normalizedImageUrls: string[] = [];
    out = out.replace(
      // Match `![alt](url)` where url may contain `\(` / `\)` escape sequences.
      /!\[([^\]]*)\]\(((?:[^)\\]|\\[()])+)\)/g,
      (match, alt, url) => {
        if (!/\\[()]/.test(url)) return match;
        const cleanUrl = url.replace(/\\\(/g, "%28").replace(/\\\)/g, "%29");
        if (/^https?:\/\//i.test(cleanUrl)) normalizedImageUrls.push(cleanUrl);
        return `![${alt}](${cleanUrl})`;
      },
    );
    if (normalizedImageUrls.length > 0) {
      notes.push(
        `hf: normalized ${normalizedImageUrls.length} image URL(s) with escaped parens`,
      );
    }

    // 6. Fix triple-rendered KaTeX math formulas
    out = collapseHfTripleMath(out, notes);

    // 6b. Collapse triple-rendered SINGLE-VARIABLE math: `N N N` → `$N$`.
    // Single variables have no `\\[a-z]+` command, so the main triplet collapser
    // can't see them. HuggingFace still renders `$N$` three times for the text
    // fallback / LaTeX source / alt-text fallback — all identical.
    const beforeVarCollapse = out.length;
    out = out.replace(/\b([A-Za-z])\s+\1\s+\1\b/g, "$$$1$$");
    if (out.length < beforeVarCollapse) {
      notes.push("hf: collapsed single-variable triplets (e.g. `N N N` → `$N$`)");
    }

    // 7. Truncate at "More Articles from our Blog" trailing section OR at
    //    the JS-rendered footer headings `## {Models|Datasets|Papers|
    //    Collections} mentioned in this article N` (content is lazy-loaded
    //    by JS and web-read only captures the empty heading shells).
    const trailingMarkers = [
      /\n\s*More Articles from our Blog\s*\n/,
      /\n\s*##\s+(?:Models|Datasets|Papers|Collections|Spaces)\s+mentioned in this article\b/,
    ];
    let earliestCut = -1;
    for (const re of trailingMarkers) {
      const m = out.search(re);
      if (m >= 0 && (earliestCut < 0 || m < earliestCut)) earliestCut = m;
    }
    if (earliestCut >= 0) {
      out = out.slice(0, earliestCut);
      notes.push("hf: truncated at trailing section (More-Articles / mentioned-in-article shells)");
    }

    return {
      md: out.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n",
      newAbsoluteImageUrls: normalizedImageUrls,
      notes,
    };
  },
};

// Collapse HuggingFace's triple-rendered KaTeX pattern: `V1 LATEX V3` → `$LATEX$`
//
// Structure of HuggingFace inline math:
//   <text-fallback> <LaTeX-source> <alt-text-fallback>
// where V2 uses `\\[a-zA-Z]+` commands (e.g. `\\text{Model Memory}`, `\\times`)
// and V1/V3 use unicode math (`×`, `⟹`, `\=`) as compact token glue.
//
// Algorithm (character-level):
//   1. Find each LaTeX expression — contiguous runs of `\\[a-zA-Z]+` (and their
//      brace groups), plus interstitial math fill (single-letter vars, digits,
//      operators, spacing). Merge adjacent runs separated only by math fill.
//   2. Expand the span's left/right through immediately-adjacent "single math
//      atoms" (a single letter, digit, or operator surrounded by whitespace)
//      because those belong to the LaTeX expression (e.g. `N` and `P` in
//      `N \\times P`) rather than to V1/V3 (which use compound tokens).
//   3. Compute V3 = content after V2 up to sentence boundary (`. ` / `.$` / `\n`).
//   4. Compute V1 candidate — content between the previous sentence boundary
//      and V2. Then find the longest suffix of V1 whose whitespace-normalized
//      form matches a prefix (or equals) the normalized V3. That suffix IS V1.
//      Everything before it is prose — keep it.
//   5. If V1 ≈ V3 (trigram overlap ≥ 70%), collapse `proseprefix V1 V2 V3` to
//      `proseprefix $V2$`. Otherwise leave the line unchanged.
const HF_LATEX_CMD = /\\\\[a-zA-Z]+/;

function collapseHfTripleMath(text: string, notes: string[]): string {
  let collapsed = 0;

  const lines = text.split("\n");
  const out = lines.map((line) => {
    if (!HF_LATEX_CMD.test(line)) return line;
    const fixed = fixLineTripleMath(line);
    if (fixed !== line) collapsed++;
    return fixed;
  });

  if (collapsed > 0) notes.push(`hf: collapsed ${collapsed} triple-rendered math line(s)`);
  return out.join("\n");
}

// A LaTeX command match, possibly followed by a brace group.
const LATEX_CMD_WITH_BRACES =
  /\\\\[a-zA-Z]+(?:\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})?/g;

function fixLineTripleMath(line: string): string {
  // 1. Find LaTeX cmd spans.
  const latexSpans: Array<{ start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  const cmdRe = new RegExp(LATEX_CMD_WITH_BRACES.source, "g");
  while ((m = cmdRe.exec(line)) !== null) {
    latexSpans.push({ start: m.index, end: m.index + m[0].length });
  }
  if (latexSpans.length === 0) return line;

  // 2. Merge adjacent LaTeX spans whose gap is "math fill" (no multi-letter word).
  //    Math fill: whitespace, single letters, digits, operators, unicode math,
  //    single-char backslash escapes (`\=`, `\,`), braces.
  const mergedSpans: Array<{ start: number; end: number }> = [{ ...latexSpans[0] }];
  for (let i = 1; i < latexSpans.length; i++) {
    const last = mergedSpans[mergedSpans.length - 1];
    const gap = line.slice(last.end, latexSpans[i].start);
    if (/[A-Za-z]{2,}/.test(gap)) {
      mergedSpans.push({ ...latexSpans[i] });
    } else {
      last.end = latexSpans[i].end;
    }
  }

  // 3. For each merged span, expand through adjacent math atoms (multi-char
  //    tokens like `10{,}000`, `10^{-4}`, `4.6894` that are part of V2 —
  //    digits, braces, operators, short vars, no multi-letter words, no
  //    unicode math binders `× ⟹ ·` that bind V1/V3 compound tokens).
  const isV2Atom = (tok: string): boolean => {
    if (tok.length === 0) return false;
    if (/[A-Za-z]{2,}/.test(tok)) return false;       // multi-letter word → V1/V3 prose
    if (/[×⟹⋯≥≤·]/.test(tok)) return false;           // unicode math binder → V1/V3 compound
    return /^[=+\-*/<>()\[\]{},.0-9A-Za-z\\^_]+$/.test(tok);
  };
  for (const span of mergedSpans) {
    // Left-expand
    while (true) {
      const before = line.slice(0, span.start);
      const match = before.match(/(?:^|\s)(\S+)(\s+)$/);
      if (!match || match.index === undefined) break;
      if (!isV2Atom(match[1])) break;
      const atomOffset = match[0].indexOf(match[1]);
      span.start = match.index + atomOffset;
    }
    // Right-expand
    while (true) {
      const after = line.slice(span.end);
      const match = after.match(/^(\s+)(\S+?)(?=\s|$|[,;])/);
      if (!match) break;
      if (!isV2Atom(match[2])) break;
      span.end += match[1].length + match[2].length;
    }
    // Consume trailing closing brackets attached to span.end (no whitespace
    // between) — handles expressions like `\\max(\\text{A}, \\text{B}))` where
    // the trailing `}})` isn't part of any individual LaTeX cmd but belongs
    // to the outer expression.
    while (span.end < line.length && /[)}\]]/.test(line[span.end])) {
      span.end++;
    }
  }

  // Normalize for comparison: strip whitespace, invisible unicode, trailing period.
  const normalize = (s: string) =>
    s
      .replace(/\s+/g, "")
      .replace(/[\u2060-\u206F\u180B-\u180E\uFEFF\u200B-\u200D]+/g, "") // invisibles
      .replace(/[。.]$/, "");

  // 4. Process spans right-to-left so earlier indices stay valid.
  let result = line;
  for (let idx = mergedSpans.length - 1; idx >= 0; idx--) {
    const span = mergedSpans[idx];
    const v2Raw = result.slice(span.start, span.end).trim();
    if (!HF_LATEX_CMD.test(v2Raw)) continue;
    // Convert raw `\\cmd` (two literal backslashes, HuggingFace's markdown-
    // escaped form) to proper `\cmd` (single backslash) for KaTeX/MathJax.
    // In LaTeX, `\\` is a newline — not a command escape — so leaving it as
    // `\\text` would break rendering. `\,` / `\=` etc. (single backslash +
    // non-letter) are already correct and are not affected by the regex.
    const v2 = v2Raw.replace(/\\\\/g, "\\");

    // V3: after span, consume V2→V3 separator (leading `. `, `, `, `: `, or plain ws).
    const tail = result.slice(span.end);
    const sepMatch = tail.match(/^([.,;:]?\s*)/);
    const sepLen = sepMatch ? sepMatch[0].length : 0;
    const v3Region = tail.slice(sepLen);
    // V3 extends until `. ` / `.$` / `, ` / `$` (already-collapsed math) / `\n`
    // / end-of-line. Stopping at `, ` prevents swallowing prose that follows
    // a triplet mid-line (`A×B×L×P, estimated using ...`); stopping at `$`
    // prevents a second (already-collapsed) formula being absorbed into V3.
    const v3EndMatch = v3Region.match(/^([^\n]*?)(\.(?=\s|$)|,(?=\s)|\$|\n|$)/);
    if (!v3EndMatch) continue;
    const v3 = v3EndMatch[1];
    const v3ConsumedLen = sepLen + v3EndMatch[1].length;
    const v3Terminator = v3EndMatch[2] === "\n" ? "\n" : "";

    const v3Norm = normalize(v3);
    if (v3Norm.length < 3) continue;

    // V1: the head before span.start. v1Region = head with trailing ws stripped.
    // We do NOT clip at `. ` / `: ` / `\n` — the suffix-match naturally stops at
    // the prose-math boundary (prose chars break the suffix-match).
    const head = result.slice(0, span.start);
    const v1Region = head.replace(/\s+$/, "");

    // Walk back char-by-char through v1Region to find the longest suffix
    // whose normalized form equals a suffix of v3Norm.
    let bestJ = v1Region.length;
    let bestNormLen = 0;
    for (let j = v1Region.length - 1; j >= 0; j--) {
      const candidate = normalize(v1Region.slice(j));
      if (candidate.length === 0) continue;
      if (v3Norm.endsWith(candidate)) {
        bestJ = j;
        bestNormLen = candidate.length;
      } else {
        break;
      }
    }

    const v3IsMathLike = /[0-9×⟹≥≤·∞∑∏∫√=+\-]/.test(v3Norm) && v3Norm.length >= 3;
    if (!v3IsMathLike) continue;
    if (bestNormLen < Math.max(3, Math.floor(v3Norm.length * 0.6))) continue;

    // Advance bestJ past any leading whitespace in v1Region.slice(bestJ) so
    // prosePrefix retains the leading indentation / spacing.
    while (bestJ < v1Region.length && /\s/.test(v1Region[bestJ])) bestJ++;

    const prosePrefix = head.slice(0, bestJ);
    const afterV3 = result.slice(span.end + v3ConsumedLen);

    // Leading separator before `$`: if prosePrefix ends in whitespace or is
    // empty, no extra separator; otherwise prepend one space.
    const sep = prosePrefix.length === 0 || /\s$/.test(prosePrefix) ? "" : " ";
    result = `${prosePrefix}${sep}$${v2}$${v3Terminator}${afterV3}`;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Generic article cleanup — Groups 6 (English + Chinese tech blogs)
// ---------------------------------------------------------------------------

const ARTICLE_CLEANUP_HOSTS = new Set([
  "intuitionlabs.ai",
  "sspai.com",
  "nvidianews.nvidia.com",
  "qwen.ai",
  "lmsys.org",
  "epoch.ai",
  "developer.nvidia.com",
  "blog.google",
  "aleksagordic.com",
  "www.aleksagordic.com",
  "huggingface.co",
  "blog.csdn.net",
  "01.me",
  "docs.nvidia.com",
  "sohu.com",
  "www.sohu.com",
]);

export const articleCleanup: PostProcessor = {
  name: "article-cleanup",
  match: (_u, h) => ARTICLE_CLEANUP_HOSTS.has(h),
  transform: (md, _originUrl) => {
    const lines = md.split("\n");
    const notes: string[] = [];

    // Common chrome line patterns across article/blog sites
    const chromeLinePatterns: RegExp[] = [
      // Nav / breadcrumbs
      /^(Home|首页)\s*[›»>|]\s*/i,
      /^(Blog|博客|Articles?|文章|News|新闻|Research|Docs?|Documentation)\s*[›»>|]/i,
      // Share / social
      /^Share\s*:?\s*$/i,
      /^分享\s*:?\s*$/,
      /^(Tweet|转发|点赞|收藏)\s*$/i,
      /^\[(Twitter|X|LinkedIn|Facebook|HackerNews|Reddit)\]/i,
      // Subscribe / newsletter CTA
      /^Subscribe\s*$/i,
      /^订阅\s*$/,
      /^(Sign up|注册).{0,40}(newsletter|邮件|通知)/i,
      // Comment section headers
      /^(Comments?|评论)\s*\(\d*\)\s*$/i,
      /^\d+\s*(Comments?|评论)\s*$/i,
      // Related / recommended
      /^(Related|推荐|相关|More from|更多)\s*(Posts?|Articles?|Reading|文章)?\s*:?\s*$/i,
      // Pagination chrome
      /^(Previous|Next|Prev)\s*(Post|Article|Page)?\s*$/i,
      /^-\s*\[(Prev|Next|Previous|Archive)\]\(/i,
      /^(上一篇|下一篇|上一页|下一页)\s*$/,
      // Date / author lines that appear standalone as UI chrome (not inline with content)
      /^(Published|Updated|Modified|Last updated|发布于|更新于)\s*[：:]/i,
      // CSDN-specific
      /^博主\s*/,
      /^关注\s*$/,
      /^举报\s*(本文章)?\s*$/,
      /^(扫码分享|扫码)\s*$/,
      /^版权声明\s*[：:]/,
      // HuggingFace spaces chrome
      /^Running on/i,
      /^This Space is (running|powered)/i,
      // Sohu
      /^搜狐号\s*[：:]/,
      /^内容(合作|举报|投诉)/,
      /^\*{0,2}关于\S{1,8}\*{0,2}\s*$/,  // sohu "关于一博" author section header
      /返回搜狐，查看更多/,
      // Google blog chrome
      /^POSTED IN:\s*$/i,
      // Copyright / footer
      /^© \d{4}/,
      /^All rights reserved\s*\.?\s*$/i,
      /^Privacy Policy\s*[|·]\s*Terms/i,
      /^隐私政策\s*[|·]\s*(条款|服务)/,
    ];

    const kept: string[] = [];
    let stripped = 0;

    // Also truncate at common trailing-chrome anchors
    const trailingCutoffs: RegExp[] = [
      /^## (Comments?|评论区|Related Posts?|You may also like|推荐阅读)/i,
      /^# (Footer|Navigation|Menu)\b/i,
      /^### Related Posts?\s*$/i,
      /为本文章充电$/,  // sspai engagement section
      /^讨论\s*$/, // sspai comment section
      /^© 本文著作权归作者所有/,  // sspai copyright
      /^Tap or paste here to upload/i,  // HuggingFace comment box
      /^Upload images.*dragging in the text input/i,  // HuggingFace comment box v2
      /^EditPreview\s*$/i,  // HuggingFace markdown editor tabs
      /^### Community\s*$/,  // HuggingFace community/comments section
      /^评分：\d/,  // sohu article rating section

    ];

    let truncated = false;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!truncated && trailingCutoffs.some((re) => re.test(t))) {
        truncated = true;
        notes.push(`article-cleanup: truncated at trailing chrome ("${t.slice(0, 40)}")`);
        break;
      }
      if (chromeLinePatterns.some((re) => re.test(t))) { stripped++; continue; }
      kept.push(lines[i]);
    }
    if (stripped > 0) notes.push(`article-cleanup: stripped ${stripped} chrome lines`);

    let result = kept.join("\n").replace(/\n{3,}/g, "\n\n");
    // Strip stray closing link fragments left by truncated multi-line links: `\n](url)`
    result = result.replace(/\n+\]\([^)]*\)\s*$/, "\n");

    return {
      md: result,
      newAbsoluteImageUrls: [],
      notes,
    };
  },
};

// ---------------------------------------------------------------------------
// linux.do (Discourse): reformat thread into OP + replies structure
// ---------------------------------------------------------------------------

export const linuxDoReformat: PostProcessor = {
  name: "linux-do-reformat",
  match: (_u, h) => h === "linux.do",
  transform: (md, _originUrl) => {
    const lines = md.split("\n");
    const notes: string[] = [];

    // Strip Discourse UI chrome lines
    const discourseChrome: RegExp[] = [
      /^(Home|首页|Categories|Latest|Top|New|Unread)\s*$/i,
      /^(Log In|Sign Up|登录|注册)\s*$/i,
      /^(Reply|回复|Like|点赞|Share|分享|Bookmark|Flag|More)\s*$/i,
      /^\d+\s*(Likes?|Replies?|Views?|回复|浏览)\s*$/i,
      /^(Jump to|Skip to)\s+/i,
      /^Created\s+\d/i,
      /^Last reply\s+/i,
      /^Suggested Topics?\s*$/i,
      /^Back to top\s*$/i,
      /^(←|→|‹|›)\s*(Back|Forward|Previous|Next)/i,
    ];

    const kept: string[] = [];
    let stripped = 0;
    for (const line of lines) {
      const t = line.trim();
      if (discourseChrome.some((re) => re.test(t))) { stripped++; continue; }
      kept.push(line);
    }
    if (stripped > 0) notes.push(`linux.do: stripped ${stripped} Discourse chrome lines`);

    let joined = kept.join("\n");

    // Strip trailing engagement block: "1.5k views N likes N links N users" + avatar list
    joined = joined.replace(
      /\n+\d[\d.,]*[km]?\s+views[\s\S]*$/i,
      "\n",
    );

    // Collapse runs of blank lines
    const cleaned = joined.replace(/\n{3,}/g, "\n\n");
    return { md: cleaned, newAbsoluteImageUrls: [], notes };
  },
};

// ---------------------------------------------------------------------------
// reddit.com: clean thread output, handle share-URL redirect note
// ---------------------------------------------------------------------------

export const redditReformat: PostProcessor = {
  name: "reddit-reformat",
  match: (_u, h) => h === "reddit.com" || h === "www.reddit.com",
  transform: (md, originUrl) => {
    const notes: string[] = [];

    // Detect deleted/removed posts AND rate-limited/unloadable fetches.
    // Shapes:
    //   `# [deleted by user] : r/<sub>`          (title-level deletion)
    //   `[removed]` as the body                  (mod-removed)
    //   `[deleted]` as the body                  (user-deleted)
    //   Short body + "Check Claude service status" or similar rate-limit chrome
    const rateLimitHints = [
      "Check Claude service status",
      "you've been blocked",
      "reddit is now live",
    ];
    const looksDeleted =
      /^#\s+\[deleted by user\]/m.test(md) ||
      /\n\s*\[removed\]\s*\n/.test(md) ||
      (md.length < 500 && /\[deleted\]/.test(md));
    const looksUnfetched =
      md.length < 800 && rateLimitHints.some((h) => md.includes(h));
    if (looksDeleted || looksUnfetched) {
      const statusLine = looksDeleted
        ? `page-removed — the post was deleted by its author or removed by moderators.`
        : `fetch-blocked — Reddit did not return post content (rate-limit or anti-bot gate).`;
      const stub = [
        `# Reddit post (${looksDeleted ? "deleted or removed" : "unreachable"})`,
        ``,
        `> **Source:** ${originUrl}`,
        `> **Status:** ${statusLine}`,
        ``,
        `*This entry is a metadata stub. ${looksDeleted ? "The original content is no longer available." : "Retry from a signed-in session or use old.reddit.com."}*`,
        ``,
      ].join("\n");
      return {
        md: stub,
        newAbsoluteImageUrls: [],
        notes: [`reddit: ${looksDeleted ? "deleted/removed" : "rate-limited"} — produced stub`],
        extraFlags: ["intentional-stub"],
      };
    }

    const lines = md.split("\n");

    // Reddit /s/ short URLs redirect to actual post — note the original URL
    if (/\/s\/[A-Za-z0-9]+/.test(originUrl)) {
      notes.push(`reddit: fetched via share short-URL (${originUrl}); content is the redirected thread`);
    }

    const redditChrome: RegExp[] = [
      /^(Log In|Sign Up|Sign in|Create Account)\s*$/i,
      /^(Join|Leave|Subscribe|Unsubscribe)\s*(community|subreddit)?\s*$/i,
      /^(Posted by|Submitted by|u\/)\s*/i,
      /^\d+\s*(upvotes?|points?|comments?|shares?)\s*$/i,
      /^(Share|Save|Hide|Report|Crosspost|Award)\s*$/i,
      /^(Reddit Premium|Coins|Help|About|Careers|Press|Blog|Rules|Moderators?)\s*$/i,
      /^(View all comments|Sort by|Best|Top|New|Controversial)\s*:?\s*$/i,
      /^(← Back|Go to|See more)\s*/i,
      /^(Get the Reddit app|Scan this QR code)/i,
      /^(Community info|r\/\w+)\s*$/i,
      /^More posts from\s+/i,
      /^(Promoted|Sponsored)\s*$/i,
    ];

    const kept: string[] = [];
    let stripped = 0;
    for (const line of lines) {
      const t = line.trim();
      if (redditChrome.some((re) => re.test(t))) { stripped++; continue; }
      kept.push(line);
    }
    if (stripped > 0) notes.push(`reddit: stripped ${stripped} UI-chrome lines`);

    return {
      md: kept.join("\n").replace(/\n{3,}/g, "\n\n"),
      newAbsoluteImageUrls: [],
      notes,
    };
  },
};

// ---------------------------------------------------------------------------
// x.com (Twitter): auth-gated stub
// ---------------------------------------------------------------------------

export const xMetadataStub: PostProcessor = {
  name: "x-metadata-stub",
  match: (_u, h) => h === "x.com" || h === "twitter.com",
  transform: (md, originUrl) => {
    // If web-read got real content (unlikely but possible for embeds), keep it.
    // Real content heuristic: more than 500 chars and doesn't look like login wall.
    const authGatedHints = [
      "Sign in to X", "Log in to Twitter", "Sign up for X",
      "Don't miss what's happening", "New to X?",
    ];
    const isGated = md.length < 800 || authGatedHints.some((h) => md.includes(h));
    if (!isGated) return { md, newAbsoluteImageUrls: [], notes: [] };

    // Produce a metadata-only stub
    const stub = [
      `# Tweet / X post`,
      ``,
      `> **Source:** ${originUrl}`,
      `> **Status:** auth-gated — Twitter/X requires login to fetch tweet content.`,
      `> The full tweet is available at the original URL above.`,
      ``,
      `*This entry is a metadata stub. Content could not be extracted without authentication.*`,
      ``,
    ].join("\n");

    return {
      md: stub,
      newAbsoluteImageUrls: [],
      notes: [`x.com: auth-gated — produced metadata stub`],
      extraFlags: ["intentional-stub"],
    };
  },
};

// ---------------------------------------------------------------------------
// Feishu internal wikis: detect auth-gate, note lark-hirono as alternative
// ---------------------------------------------------------------------------

export const feishuWikiCleaner: PostProcessor = {
  name: "feishu-wiki-cleaner",
  match: (_u, h) => /\.feishu\.cn$/i.test(h),
  transform: (md, originUrl) => {
    const notes: string[] = [];

    // Detect login wall
    const loginHints = ["请登录", "Login", "Sign in", "立即登录", "账号密码"];
    const isGated = md.length < 1000 || loginHints.some((h) => md.includes(h));
    if (isGated) {
      const stub = [
        `# Feishu Wiki Page`,
        ``,
        `> **Source:** ${originUrl}`,
        `> **Status:** auth-gated — this is a private Feishu wiki page.`,
        `> Fetch with: \`lark-hirono fetch --doc <node-token>\``,
        ``,
        `*Node token is the last path segment of the wiki URL.*`,
        ``,
      ].join("\n");
      return {
        md: stub,
        newAbsoluteImageUrls: [],
        notes: [`feishu: auth-gated — produced stub with lark-hirono fetch instructions`],
        extraFlags: ["intentional-stub"],
      };
    }

    // Public feishu content: strip common chrome
    const chromePatterns: RegExp[] = [
      /^飞书\s*$/,
      /^(登录|注册|下载)\s*$/,
      /^(首页|文档|云盘|消息)\s*$/,
      /^Last modified:\s+/i,
      /^Modified\s+\w+\s+\d+,?\s+\d{4}\s*$/i,
      /^Share\s*$/i,
      /^header-v2\s*$/i,
    ];
    let out = md;
    // Strip trailing comments/word-count block
    out = out.replace(
      /\n+Comments\s*\(\d+\)[\s\S]*$/i,
      "\n",
    );
    // Strip invisible/formatting unicode characters
    out = out.replace(/[\u200B\u200C\u200D\uFEFF\u2060\u00AD\u034F\u202C\u202D\u202A\u202B\u2028\u2029]+/g, "");
    // Strip "Unable to print" code-block placeholder
    out = out.replace(/\n\nUnable to print\n\n/g, "\n\n");

    const lines = out.split("\n");
    const kept = lines.filter((l) => !chromePatterns.some((re) => re.test(l.trim())));
    const stripped = lines.length - kept.length;
    if (stripped > 0) notes.push(`feishu: stripped ${stripped} UI-chrome lines`);
    if (stripped > 0 || out.length < md.length) notes.push(`feishu: cleaned public wiki chrome`);

    return {
      md: kept.join("\n").replace(/\n{3,}/g, "\n\n"),
      newAbsoluteImageUrls: [],
      notes,
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
// ---------------------------------------------------------------------------
// blog.google: strip social-share block + fragmented byline
// ---------------------------------------------------------------------------

export const blogGoogleCleanup: PostProcessor = {
  name: "blog-google-cleanup",
  match: (_u, h) => h === "blog.google",
  transform: (md, _originUrl) => {
    const notes: string[] = [];
    let out = md;

    // Strip the social-share block:
    //   [\nx.com\n](twitter.com/intent/tweet?...)[...](facebook)[...](linkedin)[...](mailto:...)
    //   Copy link
    // The links are glued together with no separating newlines.
    const shareBlockRe =
      /\[\s*\n*\s*x\.com\s*\n*\s*\]\([^)]+\)\[\s*\n*\s*Facebook\s*\n*\s*\]\([^)]+\)\[\s*\n*\s*LinkedIn\s*\n*\s*\]\([^)]+\)\[\s*\n*\s*Mail\s*\n*\s*\]\([^)]+\)\s*\n+Copy link\s*\n*/gs;
    const shareMatches = out.match(shareBlockRe);
    if (shareMatches) {
      out = out.replace(shareBlockRe, "");
      notes.push(`blog.google: stripped ${shareMatches.length} social-share block(s)`);
    }

    // Strip author avatar block:
    //   [![Name](images/img_NNN.webp)
    //
    //   Name
    //
    //   Role description](https://blog.google/authors/slug/)
    const authorBlockRe =
      /\n+\s*\[!\[[^\]]+\]\(images\/[^)]+\)\s*\n+[^\n]+\n+[^\n]+\]\(https?:\/\/blog\.google\/authors\/[^)]+\)\s*\n*/g;
    const authorMatches = out.match(authorBlockRe);
    if (authorMatches) {
      out = out.replace(authorBlockRe, "\n\n");
      notes.push(`blog.google: stripped ${authorMatches.length} author avatar block(s)`);
    }

    // Collapse fragmented byline. opencli emits each span as a separate
    // paragraph: "Oct 28, 2021\n\n·\n\n5 min read\n". The `·` separator
    // and read-time are noise (we already have 发布时间 in preamble);
    // the date is redundant too. Strip the whole trio.
    const bylineRe =
      /\n+(?:[A-Z][a-z]{2,8} \d{1,2}, \d{4})\s*\n+·\s*\n+\d+\s*min read\s*\n+/;
    if (bylineRe.test(out)) {
      out = out.replace(bylineRe, "\n\n");
      notes.push("blog.google: collapsed fragmented date/read-time byline");
    }

    return { md: out, newAbsoluteImageUrls: [], notes };
  },
};

/**
 * Generic: demote every body H1 (after the frontmatter `---` separator) to
 * H2. CLAUDE.md §2 contract: exactly one `# ` in the document — the
 * frontmatter title. Most source pages emit their section titles as H1
 * (substack section divisions, HF blog sections, intuitionlabs sections,
 * GitHub gist sections, etc.), which violates the contract.
 *
 * After demotion, drop a consecutive pair of identical `## ` lines if any
 * (substack often echoes the article title right after `---`).
 *
 * This runs LAST in the chain so site-specific processors have first
 * chance to strip/restructure their H1s.
 */
export const enforceSingleH1: PostProcessor = {
  name: "enforce-single-h1",
  match: () => true,
  transform: (md, _originUrl) => {
    const sepIdx = md.indexOf("\n---\n");
    if (sepIdx < 0) return { md, newAbsoluteImageUrls: [], notes: [] };
    const bodyStart = sepIdx + 5;
    let preamble = md.slice(0, bodyStart);
    let body = md.slice(bodyStart);

    // Normalize preamble: anything between the `# Title` line and the first
    // `> ` blockquote (or `---` if no blockquote) is orphan content — e.g.
    // multi-line tweet titles whose newlines broke out of the H1, or trailing
    // page-title suffixes like `" / X`. Strip it.
    let preambleNormalized = false;
    const preLines = preamble.split("\n");
    if (preLines.length > 0 && /^# /.test(preLines[0])) {
      let firstMetaIdx = -1;
      let sepLineIdx = -1;
      for (let i = 1; i < preLines.length; i++) {
        if (firstMetaIdx < 0 && /^> /.test(preLines[i])) firstMetaIdx = i;
        if (preLines[i] === "---") { sepLineIdx = i; break; }
      }
      const endBoundary = firstMetaIdx > 0 ? firstMetaIdx : sepLineIdx;
      if (endBoundary > 1) {
        let hasOrphan = false;
        for (let i = 1; i < endBoundary; i++) {
          if (preLines[i].trim().length > 0) { hasOrphan = true; break; }
        }
        if (hasOrphan) {
          const tail = preLines.slice(endBoundary);
          preamble = [preLines[0], "", ...tail].join("\n");
          if (!preamble.endsWith("---\n")) preamble = preamble + "\n";
          preambleNormalized = true;
        }
      }
    }

    // If the preamble's `# Title` is a TRUNCATED PREFIX of the first body H1
    // (same words, body version extends further), replace the preamble
    // title with the full body version and drop the body H1 — common on
    // slugified-title fetches (blog.google etc.) where the slug chopped
    // the real title mid-word. Only fires when the body H1 starts with
    // the exact preamble title followed by a word boundary.
    const preH1Match = preamble.match(/^# (.+)$/m);
    const bodyH1Match = body.match(/^# (.+)$/m);
    let titleFixed = false;
    if (preH1Match && bodyH1Match) {
      const preTitle = preH1Match[1].trim();
      const bodyTitle = bodyH1Match[1].trim();
      if (
        preTitle.length < bodyTitle.length &&
        bodyTitle.startsWith(preTitle) &&
        /[\s\-\p{P}]/u.test(bodyTitle.charAt(preTitle.length))
      ) {
        preamble = preamble.replace(/^# .+$/m, `# ${bodyTitle}`);
        body = body.replace(/^# .+\n+/m, "");
        titleFixed = true;
      }
    }
    // Demote every remaining body H1 to H2, fence-aware.
    const lines = body.split("\n");
    let inFence = false;
    let demoted = 0;
    for (let i = 0; i < lines.length; i++) {
      if (/^```/.test(lines[i].trim())) inFence = !inFence;
      if (inFence) continue;
      if (/^# /.test(lines[i])) {
        lines[i] = "#" + lines[i];
        demoted++;
      }
    }
    if (!preambleNormalized && !titleFixed && demoted === 0) {
      return { md, newAbsoluteImageUrls: [], notes: [] };
    }
    let newBody = lines.join("\n");
    // Dedupe a consecutive-identical H2 pair (common after substack title
    // echo demotion: `## Title\n\n## Title`).
    newBody = newBody.replace(
      /(^## [^\n]+\n)\n*\1/gm,
      "$1",
    );
    const notes: string[] = [];
    if (preambleNormalized) notes.push("enforce-single-h1: stripped orphan content between title and metadata");
    if (titleFixed) notes.push("enforce-single-h1: replaced truncated preamble title with full body H1");
    if (demoted > 0) notes.push(`enforce-single-h1: demoted ${demoted} body H1(s) to H2`);
    return {
      md: preamble + newBody,
      newAbsoluteImageUrls: [],
      notes,
    };
  },
};

export const PROCESSORS: PostProcessor[] = [
  // Site-specific content strips FIRST (while we still have site structure
  // to work with).
  deepwikiStripNav,
  githubStripUIChrome,
  anthropicStripSvgExplosion,
  arxivStripTrailingChrome,
  arxivStructureImprove,
  arxivPdfNote,
  // substack (semianalysis, magazine.sebastianraschka): strip dup H1 + paywall + unwrap
  substackReformat,
  // sebastianraschka.com is also Substack; substackReformat handles it
  // xhs: table → prose reformat (runs before URL resolver so resolver
  // doesn't touch the rewritten content)
  xhsReformatNoteTable,
  // deepwiki: wrap diagram-node runs (runs AFTER deepwikiStripNav so the
  // file-navigator chrome is already gone before we look for diagram runs)
  deepwikiWrapDiagramNodes,
  // Forum cleanups
  linuxDoReformat,
  redditReformat,
  // Auth-gated stubs (run before URL resolver — stub has no image refs)
  xMetadataStub,
  feishuWikiCleaner,
  // HuggingFace blog: fix KaTeX triple-math + engagement chrome (before articleCleanup)
  huggingfaceBlogReformat,
  // Generic article/blog sites cleanup
  blogGoogleCleanup,
  articleCleanup,
  // Then generic URL resolution (acts on whatever markdown survived).
  resolveRelativeImageUrls,
  // Then generic cosmetic cleanups (order matters: strip noise before
  // unescaping, otherwise we'd unescape things we'd immediately strip).
  stripEmptyAnchorLinks,
  stripDecorativeEmojiImages,
  unescapeBracketsInLinks,
  stripColorTags,
  // LAST: enforce §2 contract (single H1). Demotes every body H1 to H2
  // after site-specific processors have had their shot at the top.
  enforceSingleH1,
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
  extraFlags: string[];
} {
  const host = hostnameOf(originUrl);
  let current = md;
  const applied: string[] = [];
  const notes: string[] = [];
  const urls: string[] = [];
  const flags: string[] = [];
  for (const p of processors) {
    if (!p.match(originUrl, host)) continue;
    const r = p.transform(current, originUrl);
    const hasFlags = (r.extraFlags?.length ?? 0) > 0;
    if (r.md !== current || r.notes.length > 0 || r.newAbsoluteImageUrls.length > 0 || hasFlags) {
      applied.push(p.name);
    }
    current = r.md;
    notes.push(...r.notes);
    urls.push(...r.newAbsoluteImageUrls);
    if (r.extraFlags) flags.push(...r.extraFlags);
  }
  return { md: current, appliedNames: applied, newAbsoluteImageUrls: urls, notes, extraFlags: flags };
}
