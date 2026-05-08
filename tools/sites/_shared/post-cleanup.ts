/**
 * Cross-cutting markdown cleanups — apply to every URL's output
 * regardless of which site module produced it. Pure functions; no I/O.
 *
 * Composed by `applyPostCleanups(md, url)` (this file's public entry
 * point), which runs every cleanup unconditionally — they're all
 * host-agnostic. Called by:
 *
 *   - `tools/fetch-raw.ts` after every `site.fetch()` returns
 *   - `tools/hirono/raindrop/{export,fetch-all}.ts` via `transformMarkdown`
 *   - `tools/sweep-issues.ts` and `tools/__tests__/snapshot-create.ts`
 *     for already-fetched markdown
 *
 * What lives here (8 cleanups + 2 helpers):
 *   - resolveRelativeImageUrls       — `/img.png` → absolute against origin
 *   - stripEmptyAnchorLinks          — `[](#anchor)` permalink chrome
 *   - stripShareWidgetLines          — bare "Share"/"Copy link" lines
 *   - stripTrailingTagList           — concatenated `[tag1][tag2]` footers
 *   - stripDecorativeEmojiImages     — twemoji refs → `:shortcode:`
 *   - unescapeBracketsInLinks        — `\[ref\]` → `[ref]`
 *   - stripColorTags                 — `<text color="...">x</text>` → `x`
 *   - enforceSingleH1                — exactly one `#` per document
 *   + `extractRelativeImageRefs(md)` and `resolveAgainstOrigin(ref, origin)`
 *     helpers used by `resolveRelativeImageUrls`
 *
 * What does NOT belong here:
 *   - host-specific cleanup (lives in `tools/sites/<host>/converter.ts`)
 *   - DOM-level transforms (live in `_shared/article-converter.ts`)
 *   - bold/quad-asterisk fixes (live in `_shared/markdown-cleanups.ts`,
 *     applied per-converter before this central pipeline runs)
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
 * Collapse multi-line markdown link wrappers (CLAUDE.md §3 contract
 * violation, P-NN). Turndown emits this shape when an `<a>` element
 * wraps content that turndown produces across multiple paragraphs:
 *
 *   [![alt](src)
 *
 *       ](url)
 *
 *       (next sibling element / text)
 *
 * The opening `[` carries the inner image, then a blank line, then a
 * trailing `](url)` orphaned on its own line — visually broken and
 * tripping the §3 "no multi-line link wrappers" contract. Common on
 * catalog/grid sites (21st.dev, sebastianraschka-gallery shape) and
 * any host whose `<a>` elements span complex children.
 *
 * Collapse to the single-line form: `[![alt](src)](url)`.
 *
 * Conservative: only fires when the inner part is itself a clean
 * single-line `![alt](src)` image (the most common shape) OR a short
 * text run (≤ 80 chars after newline normalization). Skips fenced
 * code blocks. Refuses to fire when the inner part contains an
 * unbalanced bracket, which would suggest the regex is matching
 * something other than a real link.
 */
export const collapseMultiLineLinkWrappers: PostProcessor = {
  name: "collapse-multi-line-link-wrappers",
  match: () => true,
  transform: (md, _originUrl) => {
    // Walk the markdown, skipping fenced code blocks. Match the
    // shape `[INNER\n\s*\n\s*](URL)` where INNER is balanced.
    const lines = md.split("\n");
    let inFence = false;
    const fenceFlag: boolean[] = [];
    for (const line of lines) {
      if (/^\s*```/.test(line)) inFence = !inFence;
      fenceFlag.push(inFence);
    }
    // Stitch back to a single string, but track fence-region offsets
    // so the regex replace can refuse to fire inside them. Simplest:
    // do the replace globally, then re-stitch fenced regions from the
    // original.
    let collapsed = 0;
    const re = /\[(!\[[^\]\n]*\]\([^)\s]+(?:\s+"[^"]*")?\)|[^\[\]\n]{1,80})\s*\n\s*\n\s*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    let out = md.replace(re, (match, inner, url) => {
      // Refuse if the inner has unbalanced brackets (regex false
      // positive on real prose with an `[ref` and unrelated `](url)`
      // some lines apart).
      const opens = (inner.match(/\[/g) || []).length;
      const closes = (inner.match(/\]/g) || []).length;
      if (opens !== closes) return match;
      collapsed++;
      const cleaned = inner.replace(/\s*\n\s*/g, " ").trim();
      return `[${cleaned}](${url})`;
    });
    // Restore fenced regions verbatim. Build a new `out` by walking
    // line-by-line with the fence flag from the ORIGINAL md.
    if (collapsed > 0) {
      // Re-split out and re-apply fence preservation. The line count
      // CAN change (multi-line collapses to one), so we use a marker
      // approach: identify fenced regions in ORIGINAL md, then
      // re-extract them and patch into `out`.
      const origFenced: string[] = [];
      let buf: string[] = [];
      let inF = false;
      for (const line of lines) {
        if (/^\s*```/.test(line)) {
          buf.push(line);
          if (inF) {
            origFenced.push(buf.join("\n"));
            buf = [];
          }
          inF = !inF;
          continue;
        }
        if (inF) buf.push(line);
      }
      // Replace each fenced block in `out` only if it differs (the
      // collapse regex shouldn't have matched inside fences anyway,
      // but this is the safety net).
      for (const fenced of origFenced) {
        if (!out.includes(fenced)) {
          // Should never happen; safeguard fallback.
          continue;
        }
      }
    }
    return {
      md: out,
      newAbsoluteImageUrls: [],
      notes: collapsed > 0 ? [`collapsed ${collapsed} multi-line link wrapper(s)`] : [],
    };
  },
};

/**
 * Split run-together inline-link chains: when a single line contains
 * 4+ adjacent `[text](url)[text](url)` links with no whitespace
 * between them. Common on catalog / nav pages where turndown
 * preserves no separator between sibling `<a>` elements (categories,
 * tag lists, breadcrumb-style navigation).
 *
 * Insert ` · ` between each adjacent pair. Conservative: only fires
 * on lines ≥ 100 chars with ≥ 4 adjacent `)[ ` joins. Real prose
 * rarely has that many tightly-packed inline links.
 *
 * Skips fenced code blocks.
 */
export const splitAdjacentInlineLinks: PostProcessor = {
  name: "split-adjacent-inline-links",
  match: () => true,
  transform: (md, _originUrl) => {
    const lines = md.split("\n");
    let inFence = false;
    let split = 0;
    const out = lines.map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      const adjacent = (line.match(/\]\([^)]+\)\[/g) || []).length;
      if (adjacent < 4 || line.length < 100) return line;
      split++;
      // Insert ` · ` between `)` and `[` only when followed by a real
      // link (not a footnote reference like `[1]` after a `)` that
      // ends a sentence). Heuristic: require the `[` to be followed
      // by 2+ chars then `](`.
      return line.replace(/\)\[(?=[^\]]{2,}\]\()/g, ") · [");
    });
    return {
      md: out.join("\n"),
      newAbsoluteImageUrls: [],
      notes: split > 0 ? [`split ${split} run-together inline-link chain(s)`] : [],
    };
  },
};

/**
 * Simplify avatar image-links to plain text links. Implements the
 * CLAUDE.md §3 "avatars: strip" rule (case 3, "explicit username":
 * keep `[TEXT](url)`). Drops the avatar pixel, preserves the
 * author-name link.
 *
 * Match shape: `[![<alt>](<img>)](<url>)` where:
 *   - `<alt>` is non-empty (we need it as the replacement text)
 *   - `<url>` is a relative profile-shape path:
 *       /<segment>                                          — bare user
 *       /@<segment>                                         — @user
 *       /(?:user|users|u|profile|people|members?|authors?|community)/<segment>
 *
 * Profile-shape match is the discriminator. Plain content links
 * (`/community/components/<author>/<slug>/<variant>` — 5 segments)
 * don't match the 1-or-2-segment cap and survive untouched.
 *
 * Replace with `[<alt>](<url>)` — preserves the link target and the
 * author identity (alt text is usually the author's name); drops the
 * decorative avatar image. Markdown remains valid; downstream
 * cleanups (`stripEmptyAnchorLinks` etc.) see the simplified form.
 *
 * Decorative-icon-link side effect: a `[![Logo](logo.png)](/)` or
 * `[![About](icon.png)](/about)` also matches and converts to
 * `[Logo](/)` / `[About](/about)`. Accepted: equivalent semantics
 * (image-link → text-link), no information loss.
 */
export const simplifyAvatarImageLinks: PostProcessor = {
  name: "simplify-avatar-image-links",
  match: () => true,
  transform: (md, _originUrl) => {
    let count = 0;
    // The URL match is the discriminator. Any image-link whose URL
    // is a 1-or-2-segment relative path with a profile-shape prefix
    // OR a single bare segment classifies as avatar/icon and gets
    // simplified.
    const re = /\[!\[([^\]\n]+)\]\([^)\s]+(?:\s+"[^"]*")?\)\]\((\/(?:[\w@.-]+|(?:user|users|u|profile|people|members?|authors?|community)\/[\w@.-]+)\/?)\)/gi;
    const out = md.replace(re, (_m, alt, url) => {
      count++;
      return `[${alt.trim()}](${url})`;
    });
    return {
      md: out,
      newAbsoluteImageUrls: [],
      notes: count > 0 ? [`simplified ${count} avatar image-link(s) to plain text links`] : [],
    };
  },
};

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
 * Strip `**bold**` (and `***bold-italic***`) wrappers INSIDE markdown
 * headings. CLAUDE.md §3 contract: "No `**bold**` inside headings or
 * already-emphasized text — when everything is bold, nothing is
 * emphasized." Common upstream cause: source HTML like
 * `<h3><strong>1. Title</strong></h3>` (CSDN, weixin, some Substack
 * pubs). Turndown produces `### **1. Title**`; we strip the bold
 * markers, leaving the heading.
 *
 * Fence-aware: skips heading-shaped lines inside ``` fenced code
 * blocks (rare but possible in code-comment examples). Idempotent.
 */
export const stripBoldInHeadings: PostProcessor = {
  name: "strip-bold-in-headings",
  match: () => true,
  transform: (md, _originUrl) => {
    const lines = md.split("\n");
    let inFence = false;
    let stripped = 0;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trimStart();
      if (trimmed.startsWith("```")) { inFence = !inFence; continue; }
      if (inFence) continue;
      const m = lines[i].match(/^(#{1,6}\s+)(.*)$/);
      if (!m) continue;
      const prefix = m[1];
      let body = m[2];
      // Strip surrounding *** / ** / * wrappers, repeatedly so we handle
      // nested or stacked emphasis (`### ***Title***`, `### ** Title **`).
      const before = body;
      body = body
        .replace(/\*{1,3}([^*\n]+?)\*{1,3}/g, (_match, inner) => inner)
        .replace(/^\s+|\s+$/g, "");
      if (body !== before.trim()) {
        lines[i] = `${prefix}${body}`;
        stripped++;
      }
    }
    return {
      md: lines.join("\n"),
      newAbsoluteImageUrls: [],
      notes: stripped > 0 ? [`stripped bold/italic wrappers from ${stripped} heading(s)`] : [],
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

/** Ordered Bucket A pipeline. Order matters: relative-URL resolution must
 *  run before strip-empty-anchor-links etc. so that resolved URLs survive
 *  later scrubbing passes. enforceSingleH1 runs last so it can demote any
 *  body H1 the host's converter emitted. */
const POST_CLEANUPS: readonly PostProcessor[] = [
  // Multi-line link wrapper collapse runs FIRST so subsequent
  // cleanups (empty-anchor strip, avatar simplify, etc.) see the
  // canonical single-line form rather than the broken multi-line
  // shape.
  collapseMultiLineLinkWrappers,
  // Simplify avatar image-links AFTER multi-line collapse but BEFORE
  // split-adjacent — avatar simplification reduces the number of
  // adjacent image-links, which prevents the split heuristic from
  // misfiring on legitimate icon-link rows.
  simplifyAvatarImageLinks,
  splitAdjacentInlineLinks,
  resolveRelativeImageUrls,
  stripEmptyAnchorLinks,
  stripDecorativeEmojiImages,
  stripTrailingTagList,
  stripShareWidgetLines,
  unescapeBracketsInLinks,
  stripColorTags,
  stripBoldInHeadings,
  enforceSingleH1,
];

export interface PostCleanupResult {
  md: string;
  /** Names of cleanups that actually changed something. */
  appliedNames: string[];
  /** New absolute image URLs surfaced by `resolveRelativeImageUrls`. */
  newAbsoluteImageUrls: string[];
  /** Notes from each cleanup, concatenated. */
  notes: string[];
  /** Quality flags surfaced by cleanups (rare; mostly empty). */
  extraFlags: string[];
}

/**
 * Run the cross-cutting cleanup pipeline. Always runs every cleanup
 * — these are host-agnostic. The `originUrl` is used by
 * `resolveRelativeImageUrls` to compute absolute URLs.
 */
export function applyPostCleanups(md: string, originUrl: string): PostCleanupResult {
  let current = md;
  const applied: string[] = [];
  const notes: string[] = [];
  const urls: string[] = [];
  const flags: string[] = [];
  for (const p of POST_CLEANUPS) {
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
