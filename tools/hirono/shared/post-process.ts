/**
 * Cross-cutting post-processors — host-agnostic markdown cleanups that
 * run on every URL's output regardless of source. Pure functions; no
 * I/O. Imported by `tools/sites/_shared/post-cleanup.ts` which composes
 * them into `applyPostCleanups(md, url)`, the public entry point.
 *
 * What lives here (8 processors):
 *   - resolveRelativeImageUrls  — `/img.png` → absolute against origin
 *   - stripEmptyAnchorLinks     — `[](#anchor)` permalink chrome
 *   - stripShareWidgetLines     — Twitter / LinkedIn / Share rows
 *   - stripTrailingTagList      — concatenated `[tag1][tag2]` footers
 *   - stripDecorativeEmojiImages — twemoji refs → `:shortcode:`
 *   - unescapeBracketsInLinks   — `\[ref\]` → `[ref]`
 *   - stripColorTags            — `<text color="...">x</text>` → `x`
 *   - enforceSingleH1           — exactly one `#` per document
 *
 * What does NOT live here:
 *   - host-scoped cleanup (lives in each site module's converter
 *     under `tools/sites/<host>/`)
 *   - DOM-level transforms (live in `_shared/article-converter.ts`
 *     and host-specific converters)
 *
 * Routing-by-host post-processing was retired with the legacy fetcher
 * architecture. See `docs/fetcher-architecture.md` for the unified
 * design.
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
 * Strip standalone share-widget chrome lines: bare single-word UI labels
 * like `Share`, `Copy link`, `Subscribe`, `Comment`, `Like` appearing as
 * their own paragraph in the body. These are widget labels that bled into
 * the markdown when the source page rendered share buttons.
 *
 * Only fires when:
 *   - line is the EXACT chrome label (no other text)
 *   - line is in the body (after `\n---\n`, not in preamble)
 *   - line is not inside a code fence
 */
export const stripShareWidgetLines: PostProcessor = {
  name: "strip-share-widget-lines",
  match: () => true,
  transform: (md, _originUrl) => {
    const sepIdx = md.indexOf("\n---\n");
    if (sepIdx < 0) return { md, newAbsoluteImageUrls: [], notes: [] };
    const preamble = md.slice(0, sepIdx + 5);
    const body = md.slice(sepIdx + 5);
    const chromeLabels = new Set([
      "Share", "Copy link", "Subscribe", "Comment", "Like",
      "Save", "More", "Follow", "订阅", "分享", "复制链接", "评论",
      "Discuss on Hacker News",  // when bare without a link
    ]);
    const lines = body.split("\n");
    let inFence = false;
    let stripped = 0;
    const kept: string[] = [];
    for (const l of lines) {
      if (/^```/.test(l.trim())) inFence = !inFence;
      if (!inFence && chromeLabels.has(l.trim())) {
        stripped++;
        continue;
      }
      kept.push(l);
    }
    if (stripped === 0) return { md, newAbsoluteImageUrls: [], notes: [] };
    const cleaned = kept.join("\n").replace(/\n{3,}/g, "\n\n");
    return {
      md: preamble + cleaned,
      newAbsoluteImageUrls: [],
      notes: [`stripped ${stripped} share-widget chrome line(s)`],
    };
  },
};

/**
 * Strip trailing tag-list chrome: a single line consisting ONLY of
 * consecutive `[Name](/tag/slug/)` link tokens with no separators, typical
 * of blog footers (blog.cloudflare.com, magazine.sebastianraschka.com, etc.).
 * Conservative — only strips when the ENTIRE line matches (no prose, no
 * punctuation between links) AND it's within the last 8 lines of the doc.
 */
export const stripTrailingTagList: PostProcessor = {
  name: "strip-trailing-tag-list",
  match: () => true,
  transform: (md, _originUrl) => {
    const lines = md.split("\n");
    let stripped = 0;
    // Walk from end backwards, allowing trailing blanks
    let i = lines.length - 1;
    while (i >= 0 && lines[i].trim() === "") i--;
    // Now i points at last non-blank line; repeat for tag-list lines
    while (i >= 0 && i >= lines.length - 8) {
      const trimmed = lines[i].trim();
      // Must be at least 2 tag links, only tag links, no separators
      if (/^(?:\[[^\]\n]+\]\(\/tag\/[^)\n]+\)){2,}$/.test(trimmed)) {
        lines.splice(i, 1);
        stripped++;
        i--;
        while (i >= 0 && lines[i].trim() === "") { lines.splice(i, 1); i--; }
      } else {
        break;
      }
    }
    if (stripped === 0) return { md, newAbsoluteImageUrls: [], notes: [] };
    return {
      md: lines.join("\n"),
      newAbsoluteImageUrls: [],
      notes: [`stripped ${stripped} trailing tag-list chrome line(s)`],
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
