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
 * Extract `![](ref)` and `<img src="ref">` references from md. Returns the
 * union of relative-looking references (start with `/` or `./` or bare
 * filename) that could be resolved against an origin.
 */
export function extractRelativeImageRefs(md: string): string[] {
  const refs = new Set<string>();
  let inFence = false;
  for (const line of md.split("\n")) {
    if (/^```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    for (const m of line.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      if (!/^https?:\/\//i.test(m[1])) refs.add(m[1]);
    }
    for (const m of line.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
      if (!/^https?:\/\//i.test(m[1])) refs.add(m[1]);
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
  deepwikiStripNav,
  githubStripUIChrome,
  anthropicStripSvgExplosion,
  resolveRelativeImageUrls,
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
