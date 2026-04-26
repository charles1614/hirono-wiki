/**
 * deepwiki converter — pure function from `(.prose outerHTML, mermaid sources)`
 * to clean §2 markdown.
 *
 * Both host variants share this converter — the host-specific work
 * (mermaid extraction strategy) lives in fetcher.ts.
 *
 * Steps:
 *   1. Parse with jsdom.
 *   2. Walk decorative SVGs (heading-anchor copy buttons, etc.) and remove
 *      them. Mermaid SVGs are removed too — we substitute mermaid sources
 *      from the fetcher.
 *   3. Replace `.mermaid` divs and `<svg id="mermaid-*">` placeholders with
 *      sentinel `<pre data-mermaid-idx="N">…</pre>` blocks, in document
 *      order. Turndown emits these as ` ```mermaid …``` ` via a custom rule.
 *   4. Strip nav chrome (`Back to Index`, `Next →`, top/bottom `<hr>` framing).
 *   5. Extract image refs to localize and rewrite to local paths.
 *   6. Run turndown + GFM tables.
 *   7. Compose §2 frontmatter.
 *
 * No I/O — image downloads are returned as a list for the caller.
 */

import { JSDOM } from "jsdom";
import TurndownService from "turndown";
// @ts-expect-error  no types published for this package
import { gfm } from "@joplin/turndown-plugin-gfm";

export interface DeepwikiImageDownload {
  remoteUrl: string;
  localFilename: string;
}

export interface DeepwikiMetadata {
  title: string;
}

export interface DeepwikiConvertResult {
  markdown: string;
  imagesToDownload: DeepwikiImageDownload[];
  metadata: DeepwikiMetadata;
  stats: {
    mermaidExpected: number;
    mermaidPlaced: number;
    tables: number;
    codeFences: number;
    images: number;
    chromeStripped: number;
  };
}

interface ConvertOpts {
  title: string;
  url: string;
}

/**
 * Lines that, alone in a paragraph, are pure nav chrome and should be removed
 * before/after content. Pattern is "Back to ..." / "Next: ... →" etc.
 * Match is case-sensitive substring on the trimmed paragraph text.
 */
const NAV_CHROME_PATTERNS: RegExp[] = [
  /^(?:[←⬅<\-]+\s*)?Back to Index\b/i,
  /^Next:\s.+→\s*$/i,
  /^← Previous:/i,
  /^Previous:\s.+\|\s*Next:/i,
  /\|\s*Next:\s.+→\s*$/i,
];

function isNavChromePara(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return false;
  if (t.length > 200) return false;
  return NAV_CHROME_PATTERNS.some((re) => re.test(t));
}

export function convertDeepwikiHtml(
  contentHtml: string,
  mermaidSources: string[],
  opts: ConvertOpts,
): DeepwikiConvertResult {
  const dom = new JSDOM(`<!doctype html><html><body>${contentHtml}</body></html>`);
  const doc = dom.window.document;
  const root = doc.body.firstElementChild as Element | null;
  if (!root) {
    return emptyResult(opts, "empty .prose container");
  }

  // Strip the heading-anchor copy buttons (deepwiki.com has these on every
  // header — they include an inline SVG and would noise up the output).
  for (const btn of Array.from(root.querySelectorAll("button"))) {
    btn.remove();
  }

  // 1. Replace `.mermaid` (litenext) divs and `<svg id="mermaid-*">` placeholders
  // (deepwiki.com) with `<pre><code class="language-mermaid">SOURCE</code></pre>`
  // in document order. Turndown's standard fenced-code rule (defined below)
  // then emits the proper ```mermaid``` block — no placeholder substitution
  // needed. The fetcher already aligned mermaidSources to document order.
  let mermaidIdx = 0;
  let mermaidPlaced = 0;
  const mermaidExpected = mermaidSources.length;

  // litenext renders each diagram as `<div class="mermaid"><svg id="mermaid-X">`.
  // deepwiki.com renders standalone `<svg id="mermaid-X">` (no `.mermaid`
  // wrapper). Targeting both selectors at once would double-count litenext
  // (the div AND its child SVG), so prefer the wrapper if present and only
  // fall back to the SVGs when there are no wrappers in the tree.
  const mermaidElements: Element[] =
    root.querySelectorAll('.mermaid').length > 0
      ? Array.from(root.querySelectorAll('.mermaid'))
      : Array.from(root.querySelectorAll('svg[id^="mermaid"]'));
  for (const el of mermaidElements) {
    if (mermaidIdx >= mermaidSources.length) {
      el.remove();
      continue;
    }
    const pre = doc.createElement("pre");
    const code = doc.createElement("code");
    code.setAttribute("class", "language-mermaid");
    code.textContent = mermaidSources[mermaidIdx].trim();
    pre.appendChild(code);
    el.replaceWith(pre);
    mermaidIdx++;
    mermaidPlaced++;
  }

  // 2. Remove ALL remaining inline SVGs — they're decorative (icons, anchors).
  for (const svg of Array.from(root.querySelectorAll("svg"))) {
    svg.remove();
  }

  // 3. Strip nav-chrome paragraphs anywhere in the tree, plus any leading/
  // trailing `<hr>` that becomes orphan. We also look for the `<hr>` framing:
  //   <p>Back to Index | Next: X →</p>
  //   <hr>
  // pattern at the top, and the symmetric one at the bottom.
  let chromeStripped = 0;
  for (const p of Array.from(root.querySelectorAll("p"))) {
    if (isNavChromePara(p.textContent || "")) {
      p.remove();
      chromeStripped++;
    }
  }
  // Drop `<hr>` elements that are now orphan (no content sibling on one side).
  // Conservative: only top + bottom-most hr at the boundaries get removed.
  const trimEdgeHrs = (parent: Element) => {
    while (parent.firstElementChild && parent.firstElementChild.tagName === "HR") {
      parent.firstElementChild.remove();
    }
    while (parent.lastElementChild && parent.lastElementChild.tagName === "HR") {
      parent.lastElementChild.remove();
    }
  };
  // Walk into the markdown content wrapper if present.
  const inner = root.querySelector('div[data-markdown-content]') ||
                root.querySelector('.prose-custom') ||
                root;
  trimEdgeHrs(inner);
  // Also drop H1 — we synthesize our own title from metadata.
  const firstH1 = inner.querySelector("h1");
  if (firstH1) firstH1.remove();
  trimEdgeHrs(inner);

  // 4. Localize images. Drop tiny / data: images defensively.
  const imagesToDownload: DeepwikiImageDownload[] = [];
  let imgCounter = 0;
  for (const img of Array.from(root.querySelectorAll("img"))) {
    const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
    if (!src || src.startsWith("data:")) {
      img.remove();
      continue;
    }
    let abs: string;
    try {
      abs = new URL(src, opts.url).href;
    } catch {
      img.remove();
      continue;
    }
    imgCounter++;
    const ext = guessExt(abs);
    const local = `deepwiki-img-${String(imgCounter).padStart(3, "0")}${ext}`;
    img.setAttribute("src", local);
    imagesToDownload.push({ remoteUrl: abs, localFilename: local });
  }

  // 5. Strip noise IDs (heading anchors, etc.) — turndown ignores `id` but
  // they pollute the DOM diagnostics. Class attributes are preserved here
  // because the fenced-code rule reads `language-X` from `<code>` classes
  // (including the `language-mermaid` we just attached).
  for (const el of Array.from(root.querySelectorAll("[id]"))) {
    el.removeAttribute("id");
  }

  // 6. Convert with turndown.
  const td = makeTurndown();
  let body = td.turndown(root.innerHTML);

  // 7. Generic clean-ups.
  body = postProcessBody(body);

  // 8. Bold-colon normalization (consistent with weixin/zhihu converters).
  body = body.replace(/\*\*([^*\n]+?)([:：])\*\*/g, "**$1**$2");

  // 9. `<hr>` → turndown emits `* * *`; deepwiki source markdown uses `---`.
  // Normalize to match the page's original style. (Not done inside turndown
  // to avoid surprising callers of other converters.)
  body = body.split("\n").map((l) => l.trim() === "* * *" ? "---" : l).join("\n");

  const title = opts.title || "Untitled DeepWiki page";
  const fm = ["# " + title, "", "> 原文链接: " + opts.url, "", "---", ""].join("\n");
  const markdown = fm + "\n" + body.replace(/^\n+/, "").replace(/\n+$/, "") + "\n";

  const features = countFeatures(markdown);

  return {
    markdown,
    imagesToDownload,
    metadata: { title },
    stats: {
      mermaidExpected,
      mermaidPlaced,
      tables: features.tables,
      codeFences: features.codeFences,
      images: imagesToDownload.length,
      chromeStripped,
    },
  };
}

function emptyResult(opts: ConvertOpts, reason: string): DeepwikiConvertResult {
  const md =
    `# ${opts.title || "DeepWiki page"}\n\n` +
    `> 原文链接: ${opts.url}\n\n` +
    `---\n\n` +
    `*Empty body — ${reason}*\n`;
  return {
    markdown: md,
    imagesToDownload: [],
    metadata: { title: opts.title || "" },
    stats: {
      mermaidExpected: 0, mermaidPlaced: 0, tables: 0, codeFences: 0,
      images: 0, chromeStripped: 0,
    },
  };
}

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

  // <pre> → fenced code, language from <code class="language-X">. Used both
  // for normal code blocks and for the mermaid replacements (we set
  // class="language-mermaid" on those inside `convertDeepwikiHtml`).
  td.addRule("fenced-code", {
    filter: (node) => node.nodeName === "PRE",
    replacement: (_content, node) => {
      const pre = node as Element;
      const code = pre.querySelector("code");
      const text = (code ? code.textContent : pre.textContent) || "";
      const cls = code ? code.getAttribute("class") || "" : "";
      const m = cls.match(/language-(\S+)/);
      const lang = m ? m[1] : "";
      const trimmed = text.replace(/\r\n/g, "\n").replace(/^\n+/, "").replace(/\n+$/, "");
      return `\n\n\`\`\`${lang}\n${trimmed}\n\`\`\`\n\n`;
    },
  });

  return td;
}

function postProcessBody(body: string): string {
  // Collapse 3+ blank lines.
  body = body.replace(/\n{3,}/g, "\n\n");
  // Drop trailing whitespace per line.
  body = body.split("\n").map((l) => l.replace(/[ \t]+$/, "")).join("\n");
  // Remove residual heading-anchor brackets that occasionally leak from
  // turndown when a header had a `<a class="anchor">` we stripped.
  body = body.replace(/^(#{1,6}.*?)\s*\[#\]\s*$/gm, "$1");
  return body;
}

function guessExt(url: string): string {
  try {
    const p = new URL(url).pathname.toLowerCase();
    const m = p.match(/\.(png|jpe?g|gif|webp|svg)$/);
    if (m) return "." + (m[1] === "jpeg" ? "jpg" : m[1]);
  } catch { /* fall through */ }
  return ".png";
}

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
