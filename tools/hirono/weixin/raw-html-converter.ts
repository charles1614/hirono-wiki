/**
 * Convert raw weixin article HTML (the `#js_content` outerHTML extracted
 * via opencli's headless browser) into clean markdown that satisfies the §2
 * frontmatter contract.
 *
 * Replaces the previous opencli-weixin-adapter pipeline whose Markdown
 * conversion was opaque + lossy:
 *   - doubled list markers (`-   • text`, `1.  1. text`)
 *   - inline `<code>` lost from table cells
 *   - inline `<svg>` flow diagrams flattened to one-paragraph-per-label
 *     garbage runs
 *   - `<pre>` blocks flattened to a single-line backtick span
 *
 * With raw HTML + turndown + custom rules, all four are handled
 * deterministically inside our own converter.
 *
 * The converter is PURE: no I/O, no network. It identifies the images that
 * need downloading and returns them to the caller, who decides where they go
 * on disk. This keeps the unit testable and side-effect free.
 */

import { JSDOM } from "jsdom";
import TurndownService from "turndown";
// @ts-expect-error  no types published for this package
import { gfm } from "@joplin/turndown-plugin-gfm";

export interface WeixinMetadata {
  /** Activity name from `<h1 id="activity-name">`. */
  title: string;
  /** Public account name from `<a id="js_name">`. */
  author: string;
  /** Publish-time string from `<em id="publish_time">` etc. */
  publishTime: string;
}

export interface WeixinImageDownload {
  /** Absolute URL of the source image (data-src preferred over src). */
  remoteUrl: string;
  /** Filename to save it as inside slugDir, e.g. "weixin-img-001.jpeg". */
  localFilename: string;
}

export interface ConvertResult {
  /** Final markdown including §2 frontmatter and trailing body. */
  markdown: string;
  /** Images the caller must download (and place into slugDir under the listed names). */
  imagesToDownload: WeixinImageDownload[];
  /** Inline SVGs the caller must write to disk under the listed names. */
  svgFiles: WeixinSvgFile[];
  /** Metadata extracted from the page (echoed back for caller convenience). */
  metadata: WeixinMetadata;
  /** Diagnostics: counts of structures we processed (for adapterNotes). */
  stats: {
    images: number;
    tables: number;
    codeFences: number;
    svgFiles: number;
    svgDropped: number;
    listMarkersCleaned: number;
  };
}

/**
 * Walk an element's descendant tree and build text content, preserving
 * line breaks across the three structural shapes mdnice uses inside `<pre>`:
 *
 *   - text-node `\n`s (default — preserved as-is)
 *   - `<br>` elements (default textContent silently collapses these)
 *   - `<p>`/`<div>`/`<section>` block siblings, each carrying one line
 *     of code (mdnice's "fancy" code-card style, where every line is its
 *     own paragraph for syntax-color spans)
 *
 * Output: a single string with line breaks at each `<br>` AND between
 * each pair of block-level elements.
 */
function textWithLineBreaks(el: Element): string {
  const BLOCK_TAGS = new Set(["P", "DIV", "SECTION"]);
  let out = "";
  const walk = (n: Node) => {
    if (n.nodeType === 3 /* TEXT_NODE */) {
      out += n.textContent || "";
      return;
    }
    if (n.nodeType !== 1 /* ELEMENT_NODE */) return;
    const e = n as Element;
    if (e.tagName === "BR") { out += "\n"; return; }
    const isBlock = BLOCK_TAGS.has(e.tagName);
    if (isBlock && out.length > 0 && !out.endsWith("\n")) out += "\n";
    for (const c of e.childNodes) walk(c);
    if (isBlock && !out.endsWith("\n")) out += "\n";
  };
  for (const c of el.childNodes) walk(c);
  return out;
}

/**
 * Unwrap every `<span>` outside of `<pre>`/`<code>` by replacing it with
 * its children. mdnice uses spans purely as style carriers (no markdown
 * meaning), and they sit BETWEEN otherwise-mergeable emphasis runs. After
 * this pass, `<strong>A</strong><span><strong>B</strong></span>` becomes
 * `<strong>A</strong><strong>B</strong>` — so normalizeEmphasis can merge.
 *
 * Inside `<pre>`/`<code>` we keep spans because textWithLineBreaks may
 * use the structure (e.g. detecting `<br>` inside spans). Skip those.
 */
function unwrapInertSpans(root: Element): void {
  // Multi-pass — unwrapping a span can expose more spans to unwrap.
  for (let pass = 0; pass < 5; pass++) {
    const spans = root.querySelectorAll("span");
    let unwrapped = 0;
    for (const sp of Array.from(spans)) {
      // Skip spans inside <pre>/<code>.
      let inCode = false;
      let p: Element | null = sp.parentElement;
      while (p) {
        if (p.tagName === "PRE" || p.tagName === "CODE") { inCode = true; break; }
        p = p.parentElement;
      }
      if (inCode) continue;
      const parent = sp.parentNode;
      if (!parent) continue;
      while (sp.firstChild) parent.insertBefore(sp.firstChild, sp);
      sp.remove();
      unwrapped++;
    }
    if (unwrapped === 0) break;
  }
}

/**
 * Normalize emphasis-tag chains the WeChat editor produces:
 *
 *   1. Adjacent same-type siblings: `<strong>A</strong><strong>B</strong>`
 *      get merged into `<strong>AB</strong>`. Without this, turndown emits
 *      `**A****B**` — and any post-processing that collapses `\*{4,}` to
 *      `**` produces the malformed `**A**B**` (unbalanced 5 asterisks).
 *
 *   2. Self-nesting: `<strong><b>X</b></strong>` and similar collapse to a
 *      single `<strong>X</strong>` so we get `**X**` instead of `****X****`.
 *
 * Applied to STRONG, B, EM, I in document order, looping until stable.
 */
function normalizeEmphasis(doc: Document, root: Element): number {
  const TYPE_MAP: Record<string, string> = {
    STRONG: "STRONG", B: "STRONG",
    EM: "EM", I: "EM",
  };
  let changes = 0;
  // First pass: unwrap self-nested emphasis. Loop until stable — three or
  // more levels of nesting take that many passes to fully flatten.
  for (let pass = 0; pass < 8; pass++) {
    let passChanges = 0;
    for (const tag of ["STRONG", "B", "EM", "I"]) {
      for (const el of Array.from(root.querySelectorAll(tag.toLowerCase()))) {
        const elType = TYPE_MAP[el.tagName];
        if (!elType) continue;
        const childEls = Array.from(el.children);
        if (childEls.length === 1 && TYPE_MAP[childEls[0].tagName] === elType) {
          const inner = childEls[0];
          while (inner.firstChild) el.appendChild(inner.firstChild);
          inner.remove();
          passChanges++;
        }
      }
    }
    changes += passChanges;
    if (passChanges === 0) break;
  }
  // Second pass: merge adjacent same-type siblings. Walk all parents that
  // have multiple emphasis children; coalesce in-place.
  const parents = new Set<Element>();
  for (const el of Array.from(root.querySelectorAll("strong, b, em, i"))) {
    if (el.parentElement) parents.add(el.parentElement);
  }
  for (const p of parents) {
    let cur: Element | null = p.firstElementChild;
    while (cur) {
      const curType = TYPE_MAP[cur.tagName];
      const next = cur.nextElementSibling;
      if (next && curType && TYPE_MAP[next.tagName] === curType) {
        // Check there's no non-whitespace text node between them.
        let between = cur.nextSibling;
        let hasText = false;
        while (between && between !== next) {
          if (between.nodeType === 3 && (between.textContent || "").trim().length > 0) {
            hasText = true;
            break;
          }
          between = between.nextSibling;
        }
        if (!hasText) {
          // Move next's children into cur, drop intermediate whitespace + next.
          let n: ChildNode | null = cur.nextSibling;
          while (n && n !== next) {
            const nx: ChildNode | null = n.nextSibling;
            n.remove();
            n = nx;
          }
          while (next.firstChild) cur.appendChild(next.firstChild);
          next.remove();
          changes++;
          continue; // re-check cur with its new neighbor
        }
      }
      cur = next;
    }
  }
  return changes;
}

/**
 * Strip mdnice's pre-rendered list-marker prefix from each `<li>`.
 *
 * WeChat's editor (mdnice) injects the visual bullet/number AS A TEXT NODE
 * inside each `<li>` so the rendered article shows "1. text" even with
 * default browser list styling disabled. When turndown then walks the DOM
 * it adds its own markdown bullet on top, producing `1. 1. text` or `- • text`.
 *
 * We strip the inner duplicate by inspecting the first text-bearing
 * descendant of each `<li>` and trimming a leading bullet/number prefix.
 */
function stripListMarkerPrefixes(doc: Document): number {
  const lis = doc.querySelectorAll("li");
  let cleaned = 0;
  // Match: bullet glyphs OR `digit(s)<dot|chinese-comma|paren> <space>`
  const PREFIX = /^([•·●◦‧▪◆■▶►]|[0-9]+[.、）)])\s+/;
  for (const li of lis) {
    // Find the first text node within the <li>, descending into any wrappers
    // (mdnice often wraps the marker in <span><span>1.</span></span>).
    const walker = doc.createTreeWalker(li, /* SHOW_TEXT */ 4);
    let node = walker.nextNode() as Text | null;
    while (node && node.textContent?.trim() === "") {
      node = walker.nextNode() as Text | null;
    }
    if (!node) continue;
    const text = node.textContent || "";
    const m = text.match(PREFIX);
    if (!m) continue;
    node.textContent = text.slice(m[0].length);
    cleaned++;
  }
  return cleaned;
}

/**
 * Normalize image elements:
 *   - Prefer `data-src` over `src` (WeChat lazy-loading)
 *   - Pick file extension from `wx_fmt=<ext>` param, falling back to URL extension or `jpg`
 *   - Replace each `<img>` with a placeholder carrying a stable local filename
 *   - Return the (remoteUrl, localFilename) list for the caller to download
 */
function normalizeImages(doc: Document, root: Element): WeixinImageDownload[] {
  const imgs = root.querySelectorAll("img");
  const out: WeixinImageDownload[] = [];
  let counter = 0;
  for (const img of imgs) {
    // Skip placeholders we created in processSvgs — they already point to a
    // local file and would otherwise be filtered out as "tracking pixels".
    if (img.hasAttribute("data-local-svg")) continue;
    const src = img.getAttribute("data-src") || img.getAttribute("src") || "";
    if (!/^https?:\/\//i.test(src)) {
      // Drop tracking pixels / inline data URIs / non-resolvable refs.
      img.remove();
      continue;
    }
    counter++;
    let ext = "jpg";
    const fmt = src.match(/[?&]wx_fmt=(\w+)/i);
    if (fmt) ext = fmt[1].toLowerCase();
    else if (/\.png(\?|$)/i.test(src)) ext = "png";
    else if (/\.gif(\?|$)/i.test(src)) ext = "gif";
    else if (/\.webp(\?|$)/i.test(src)) ext = "webp";
    else if (/\.svg(\?|$)/i.test(src)) ext = "svg";
    if (ext === "jpeg") ext = "jpg";
    // wx_fmt sometimes carries unknown values like "other"; normalize anything
    // outside the standard image extension set to "jpg" (curl just writes the
    // bytes; the extension is purely a hint to viewers).
    if (!["jpg", "png", "gif", "webp", "svg"].includes(ext)) ext = "jpg";
    const localFilename = `weixin-img-${String(counter).padStart(3, "0")}.${ext}`;
    out.push({ remoteUrl: src, localFilename });
    // Replace the img with a clean placeholder so turndown emits
    // `![alt](localFilename)` without WeChat's data-* attributes.
    const replacement = doc.createElement("img");
    replacement.setAttribute("src", localFilename);
    const alt = img.getAttribute("alt");
    if (alt && alt.trim()) replacement.setAttribute("alt", alt.trim());
    img.parentNode?.replaceChild(replacement, img);
  }
  return out;
}

export interface WeixinSvgFile {
  /** Filename to save the SVG as inside slugDir, e.g. "weixin-svg-001.svg". */
  localFilename: string;
  /** Full SVG outerHTML — the caller writes it to disk. */
  svg: string;
}

/**
 * Extract `<svg>...</svg>` blocks from the raw HTML BEFORE sanitization.
 *
 * The CSS-strip in convertWeixinHtml removes every `style="..."` attribute
 * to dodge jsdom's CSS-shorthand parser bug. But mermaid-rendered SVGs
 * carry ALL their visual semantics (fill colors, stroke widths, marker
 * arrowhead fills, font families) in inline styles — strip them and the
 * SVG renders as a black-on-white wireframe with broken arrows.
 *
 * Solution: harvest each SVG's original outerHTML (with styles intact)
 * here, BEFORE the strip pass. Match by ordinal — the Nth `<svg>` jsdom
 * sees == the Nth `<svg>` we extracted. processSvgs then uses these
 * pristine bytes when writing the .svg file, so the saved file renders
 * correctly even though the in-memory DOM SVG is style-less.
 */
function extractOriginalSvgs(rawHtml: string): string[] {
  const out: string[] = [];
  const re = /<svg\b[\s\S]*?<\/svg>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rawHtml)) !== null) {
    out.push(m[0]);
  }
  return out;
}

/**
 * Process inline `<svg>` elements:
 *   - REAL diagrams (mermaid flowcharts, architecture pictures, etc.) are
 *     extracted as standalone `.svg` files and replaced with a markdown
 *     image reference. Most viewers (GitHub, Lark/Feishu) render `.svg`
 *     image refs natively.
 *   - DECORATIVE SVGs (mdnice's tiny colored-dot section markers, ~500
 *     bytes, no text/labels) are dropped to avoid clutter.
 *
 * Heuristic for "real": outerHTML ≥ 2000 bytes OR has aria-roledescription
 * containing "flowchart"/"sequence"/"diagram"/"graph". The decorative dots
 * are typically 450-650 bytes with just 3 `<ellipse>` children. Real
 * mermaid SVGs run well into the tens of KB.
 *
 * `originalSvgs` carries the pristine pre-style-strip bytes (see
 * extractOriginalSvgs above) so the saved .svg file renders correctly.
 */
function processSvgs(
  doc: Document,
  root: Element,
  originalSvgs: string[],
): { files: WeixinSvgFile[]; dropped: number } {
  const svgs = root.querySelectorAll("svg");
  const files: WeixinSvgFile[] = [];
  let dropped = 0;
  let realCounter = 0;
  let svgIndex = -1;
  for (const svg of svgs) {
    svgIndex++;
    // Use the in-DOM (style-less) outerHTML for the heuristic, since it's
    // what jsdom has. Either form is equivalently valid for size-based
    // detection (the colored-dot decorative SVGs barely change with styles).
    const inDomHtml = svg.outerHTML;
    const ariaRole = (svg.getAttribute("aria-roledescription") || "").toLowerCase();
    const isReal = inDomHtml.length >= 2000
      || /flowchart|sequence|diagram|graph|state-diagram|class-diagram/.test(ariaRole);
    if (!isReal) {
      svg.remove();
      dropped++;
      continue;
    }
    realCounter++;
    const localFilename = `weixin-svg-${String(realCounter).padStart(3, "0")}.svg`;
    // Prefer the pre-strip pristine SVG bytes if we have them; fall back to
    // the in-DOM form if the index doesn't line up (shouldn't happen, but
    // we don't want to crash if regex misses a malformed SVG).
    const fileBody = originalSvgs[svgIndex] ?? inDomHtml;
    files.push({ localFilename, svg: fileBody });
    // Replace with an <img>-equivalent so turndown emits ![](filename).
    // Tag with data-local-svg="1" so normalizeImages skips it (otherwise
    // its filter for http-only src would treat the relative ref as a
    // tracking pixel and remove the placeholder).
    const img = doc.createElement("img");
    img.setAttribute("src", localFilename);
    img.setAttribute("alt", ariaRole || "diagram");
    img.setAttribute("data-local-svg", "1");
    svg.parentNode?.replaceChild(img, svg);
  }
  return { files, dropped };
}

/** Build a turndown service preconfigured for weixin output. */
function makeTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    fence: "```",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });
  td.use(gfm);
  // Preserve HTML comments verbatim so our SVG placeholders survive.
  td.addRule("preserve-comments", {
    filter: (node) => node.nodeType === 8 /* COMMENT_NODE */,
    replacement: (_content, node) => `<!--${(node as unknown as Comment).data}-->`,
  });
  // <pre> → fenced block. Three structural shapes appear in WeChat output:
  //
  //   (A1) Single <code>, lines separated by `\n` text nodes. Canonical.
  //   (A2) Single <code>, lines separated by <br> elements wrapped in
  //        decorative spans. textContent silently collapses <br> to "",
  //        so we must walk the tree and emit `\n` for each <br>.
  //   (B)  Multi-<code>: one <code> per line, each line in <span leaf="">.
  //        Join children's per-element text (also <br>-aware) with \n.
  //
  // We do NOT trust `data-lang` on multi-child shape because mdnice often
  // mislabels (e.g. `data-lang="sql"` for actual YAML). For single-child
  // shape, the `<code>`'s `class="language-X"` attr is reliable.
  td.addRule("fenced-code", {
    filter: (node) => node.nodeName === "PRE",
    replacement: (_content, node) => {
      const pre = node as Element;
      const codes = Array.from(pre.children).filter((c) => c.tagName === "CODE");
      let text = "";
      let lang = "";
      if (codes.length > 1) {
        text = codes.map(textWithLineBreaks).join("\n");
      } else if (codes.length === 1) {
        text = textWithLineBreaks(codes[0]);
        const cls = codes[0].getAttribute("class") || "";
        const m = cls.match(/language-(\S+)/);
        if (m) lang = m[1];
      } else {
        text = textWithLineBreaks(pre);
      }
      const trimmed = text.replace(/\r\n/g, "\n").replace(/^\n+/, "").replace(/\n+$/, "");
      return `\n\n\`\`\`${lang}\n${trimmed}\n\`\`\`\n\n`;
    },
  });
  return td;
}

/**
 * Count rendered features for the adapter's note line.
 */
function countFeatures(md: string): { tables: number; codeFences: number } {
  const lines = md.split("\n");
  let tables = 0;
  let fences = 0;
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      fences++;
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (/^\|/.test(line)) tables++;
  }
  return { tables, codeFences: Math.floor(fences / 2) };
}

/**
 * Main entry point. Caller provides:
 *   - contentHtml: outerHTML of `#js_content` from a hydrated weixin page
 *   - metadata: title / author / publishTime extracted from the same page
 *     (the caller already has DOM access, so it does the meta lookup)
 *   - originUrl: the source URL (used in the §2 frontmatter `> 原文链接:` line)
 */
export function convertWeixinHtml(
  contentHtml: string,
  metadata: WeixinMetadata,
  originUrl: string,
): ConvertResult {
  // Capture original SVG bytes BEFORE the style-strip below — mermaid SVGs
  // store all visual semantics in inline styles and would render as
  // black-and-white wireframes without them.
  const originalSvgs = extractOriginalSvgs(contentHtml);

  // jsdom 23+ parses inline `style="..."` and crashes on malformed
  // background-shorthand expressions (which weixin/mdnice can emit). Styles
  // are irrelevant to markdown conversion, so strip every `style` attribute
  // before parsing — sidesteps the CSS engine entirely.
  const sanitized = contentHtml.replace(/\sstyle\s*=\s*"[^"]*"/gi, "")
                               .replace(/\sstyle\s*=\s*'[^']*'/gi, "");
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${sanitized}</body></html>`);
  const doc = dom.window.document;
  // Find the root: the wrapper we just put the contentHtml inside.
  const root = doc.body.firstElementChild ?? doc.body;

  // 1. SVGs: real diagrams → standalone .svg files + ![](ref); decorative
  //    section-marker dots → drop. Runs BEFORE list-marker / image walks so
  //    we don't process SVG-internal nodes as list markers. Uses the
  //    pre-strip originalSvgs for the file body so styles survive.
  const svgResult = processSvgs(doc, root, originalSvgs);

  // 2. <li> mdnice prefix strip
  const listMarkersCleaned = stripListMarkerPrefixes(doc);

  // 2a. Unwrap all <span> elements OUTSIDE of <pre>/<code>. mdnice nests
  //     emphasis inside style-only <span> wrappers like
  //     `<strong>A</strong><span><strong>B</strong></span>` which keeps
  //     the two STRONGs from being adjacent siblings — emphasis-merge
  //     would miss them. Inside <pre>/<code> we keep <span>s because
  //     textWithLineBreaks relies on the full DOM structure.
  unwrapInertSpans(root);

  // 2b. Normalize emphasis chains: merge adjacent <strong><strong>, unwrap
  //     <strong><b> nesting. Prevents `**A****B**` and `****X****` shapes.
  normalizeEmphasis(doc, root);

  // 3. <img> normalize → local placeholder + return download list
  const imagesToDownload = normalizeImages(doc, root);

  // 4. Turndown
  const td = makeTurndown();
  let body = td.turndown(root.outerHTML).trim();
  // Collapse 3+ consecutive newlines (turndown can emit them around fences/blockquotes).
  body = body.replace(/\n{3,}/g, "\n\n");
  // Strip inline emphasis inside ATX headings — WeChat wraps heading text in
  // <strong>/<b>, but headings are already visually bold; the surplus `**`
  // creates `## **title**` noise and breaks downstream styling.
  body = body.replace(/^(#{1,6}\s+)\*+\s*([^*\n]+?)\s*\*+\s*$/gm, "$1$2");
  // Drop empty headings (e.g. `## ` with no text). They appear when turndown
  // picks up a heading whose only child is decorative whitespace.
  body = body.replace(/^#{1,6}\s*$\n?/gm, "");
  // Move trailing colon out of bold spans — mdnice authors type `**效果：**`
  // where the colon is a separator, not part of the bold term. Read better
  // as `**效果**：` and renders identically.
  body = body.replace(/\*\*([^*\n]+?)([:：])\*\*/g, "**$1**$2");
  // Re-collapse newlines after the strips above.
  body = body.replace(/\n{3,}/g, "\n\n");

  // 5. §2 frontmatter
  const fmLines: string[] = [`# ${metadata.title || "(untitled)"}`, ""];
  if (metadata.author) fmLines.push(`> 公众号: ${metadata.author}`);
  if (metadata.publishTime) fmLines.push(`> 发布时间: ${metadata.publishTime}`);
  fmLines.push(`> 原文链接: ${originUrl}`, "", "---", "", "");
  const markdown = fmLines.join("\n") + body + "\n";

  const counts = countFeatures(markdown);
  return {
    markdown,
    imagesToDownload,
    svgFiles: svgResult.files,
    metadata,
    stats: {
      images: imagesToDownload.length,
      tables: counts.tables,
      codeFences: counts.codeFences,
      svgFiles: svgResult.files.length,
      svgDropped: svgResult.dropped,
      listMarkersCleaned,
    },
  };
}
