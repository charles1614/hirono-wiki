/**
 * Generic HTML → markdown converter for the web-read fallback path.
 *
 * Pure function: given raw outerHTML extracted from a browser session,
 * produce clean §2-body markdown plus a list of images to localize.
 * No site-specific selectors or rules — every host on the web-read
 * path runs through this same converter.
 *
 * Reuses the proven jsdom + TurndownService + @joplin/turndown-plugin-gfm
 * stack from the per-host converters (nvidianews, deepwiki, linux-do).
 * The GFM plugin is what gives us proper `|`-delimited markdown tables
 * from `<table>` HTML — the single biggest defect of opencli's own
 * MD converter.
 */

import { JSDOM } from "jsdom";
import TurndownService from "turndown";
// @ts-expect-error  no types published for this package
import { gfm } from "@joplin/turndown-plugin-gfm";

export interface GenericImageDownload {
  remoteUrl: string;
  localFilename: string;
}

export interface GenericConvertResult {
  /** Markdown body — caller composes the §2 frontmatter (H1 + 原文链接 + ---). */
  body: string;
  imagesToDownload: GenericImageDownload[];
  stats: {
    tables: number;
    codeFences: number;
    images: number;
  };
}

export interface GenericConvertOpts {
  /** outerHTML of the main-content container extracted from the page. */
  html: string;
  /** Origin URL used to absolutize relative image refs. */
  url: string;
  /**
   * Filename prefix for localized images, e.g. "developer-nvidia-com".
   * Default `"webread"`. Files become `<prefix>-img-001.png` etc.
   */
  imagePrefix?: string;
}

/**
 * Tags whose entire subtree is dropped before turndown sees it. These are
 * page chrome that web-read's main-content selector cascade may include
 * even when the cascade picks the right container (especially when the
 * fallback hits `document.body`).
 */
const DROP_TAGS = ["nav", "header", "footer", "aside", "script", "style", "noscript", "form", "iframe", "select", "button"];

export function convertGenericHtml(opts: GenericConvertOpts): GenericConvertResult {
  const prefix = opts.imagePrefix ?? "webread";
  const dom = new JSDOM(`<!doctype html><html><body>${opts.html}</body></html>`);
  const doc = dom.window.document;
  const root = doc.body;

  // 1. Strip chrome tags + decorative SVGs.
  for (const tag of DROP_TAGS) {
    for (const el of Array.from(root.querySelectorAll(tag))) el.remove();
  }
  for (const svg of Array.from(root.querySelectorAll("svg"))) svg.remove();
  // Sphinx/readthedocs decorate every heading with `<a class="headerlink">[#]</a>`
  // which turndown emits as `[#](#anchor)`. Drop them DOM-side so they never
  // reach the markdown.
  for (const a of Array.from(root.querySelectorAll("a.headerlink, a.anchor, a.toc-backref"))) {
    a.remove();
  }
  // Discourse-style empty anchor inside headings.
  for (const a of Array.from(root.querySelectorAll("h1 a[name], h2 a[name], h3 a[name], h4 a[name], h5 a[name], h6 a[name]"))) {
    if ((a.textContent || "").trim() === "") a.remove();
  }

  // 2. Localize images. Drop `data:` URIs and missing-src.
  const imagesToDownload: GenericImageDownload[] = [];
  let imgCounter = 0;
  for (const img of Array.from(root.querySelectorAll("img"))) {
    const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
    if (!src || src.startsWith("data:")) {
      img.remove();
      continue;
    }
    let abs: string;
    try { abs = new URL(src, opts.url).href; }
    catch { img.remove(); continue; }
    imgCounter++;
    const ext = guessExt(abs);
    const local = `${prefix}-img-${String(imgCounter).padStart(3, "0")}${ext}`;
    img.setAttribute("src", local);
    imagesToDownload.push({ remoteUrl: abs, localFilename: local });
  }

  // 3. Strip noise IDs (heading anchor targets etc.) — turndown ignores `id`
  // attrs but we keep the DOM clean for diagnostics. Class attrs are
  // PRESERVED because the fenced-code rule reads `language-X` from `<code>`.
  for (const el of Array.from(root.querySelectorAll("[id]"))) {
    el.removeAttribute("id");
  }

  // 4. Pre-process table cells: turndown's GFM table rule bails when cells
  // contain block-level children (the developer.nvidia.com page wraps every
  // `<td>` content in `<div>`, and uses `<h3>` inside `<th>`). Flatten the
  // common cases so GFM produces a real markdown table:
  //   - unwrap a single child <div> in <td> / <th> (keep its contents)
  //   - replace <h1>..<h6> inside <th> with their text (keep text, drop tag)
  //   - replace <br> inside <td> / <th> with ` / ` to keep multi-line cells readable
  for (const tdth of Array.from(root.querySelectorAll("td, th"))) {
    // Unwrap `joplin-table-wrapper` div parents already done by querySelectorAll
    // surfacing the inner cells. Now flatten cell-internal divs.
    for (const div of Array.from(tdth.querySelectorAll("div"))) {
      while (div.firstChild) div.parentNode!.insertBefore(div.firstChild, div);
      div.remove();
    }
    if (tdth.tagName === "TH") {
      for (const h of Array.from(tdth.querySelectorAll("h1, h2, h3, h4, h5, h6"))) {
        const txt = doc.createTextNode((h.textContent || "").trim());
        h.replaceWith(txt);
      }
    }
    for (const br of Array.from(tdth.querySelectorAll("br"))) {
      br.replaceWith(doc.createTextNode(" / "));
    }
  }
  // Unwrap table-wrapper divs entirely so turndown sees a clean <table>.
  for (const wrap of Array.from(root.querySelectorAll(".joplin-table-wrapper, .table-wrapper, .table-responsive"))) {
    while (wrap.firstChild) wrap.parentNode!.insertBefore(wrap.firstChild, wrap);
    wrap.remove();
  }

  // 5. Run turndown.
  const td = makeTurndown();
  let body = td.turndown(root.innerHTML).trim();

  // 6. Cleanups (consistent with other converters).
  body = body.replace(/\n{3,}/g, "\n\n");
  body = body.split("\n").map((l) => l.replace(/[ \t]+$/, "")).join("\n");
  // Bold-colon normalization: `**x：**` → `**x**：`.
  body = body.replace(/\*\*([^*\n]+?)([:：])\*\*/g, "**$1**$2");
  // Drop empty heading lines (`## ` with no text — H1-demotion artifact).
  body = body.split("\n").filter((l) => !/^#{1,6}\s*$/.test(l)).join("\n");
  // Turndown escapes `[N]` to `\[N\]` (or `\[N]`, depending on whether the
  // closing `]` is followed by `[` or `(`) when N is digits, thinking it
  // might be a reference-style link. For numbered footnote references this
  // looks ugly. Unescape both forms back to `[N]`. Fence-aware so we don't
  // touch literal `\[` inside fenced code blocks.
  {
    const lines = body.split("\n");
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^```/.test(lines[i].trim())) { inFence = !inFence; continue; }
      if (inFence) continue;
      lines[i] = lines[i]
        .replace(/\\\[(\d+)\\\]/g, "[$1]")
        .replace(/\\\[(\d+)\]/g, "[$1]");
    }
    body = lines.join("\n");
  }

  const features = countFeatures(body);

  return {
    body,
    imagesToDownload,
    stats: {
      tables: features.tables,
      codeFences: features.codeFences,
      images: imagesToDownload.length,
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

  // <pre> → fenced code with language hint from <code class="language-X">,
  // <code class="lang-X">, or <pre data-code-wrap="X">. Same rule as the
  // per-host converters (linux-do, deepwiki, nvidianews).
  td.addRule("fenced-code", {
    filter: (node) => node.nodeName === "PRE",
    replacement: (_content, node) => {
      const pre = node as Element;
      const code = pre.querySelector("code");
      const text = (code ? code.textContent : pre.textContent) || "";
      const cls = code ? code.getAttribute("class") || "" : "";
      const wrap = pre.getAttribute("data-code-wrap") || "";
      const m = cls.match(/(?:language|lang)-(\S+)/);
      const lang = m ? m[1] : (wrap || "");
      const trimmed = text.replace(/\r\n/g, "\n").replace(/^\n+/, "").replace(/\n+$/, "");
      return `\n\n\`\`\`${lang}\n${trimmed}\n\`\`\`\n\n`;
    },
  });

  return td;
}

function guessExt(url: string): string {
  try {
    const p = new URL(url).pathname.toLowerCase();
    const m = p.match(/\.(png|jpe?g|gif|webp|svg)$/);
    if (m) return "." + (m[1] === "jpeg" ? "jpg" : m[1]);
  } catch { /* fall through */ }
  return ".jpg";
}

function countFeatures(md: string): { tables: number; codeFences: number } {
  let fences = 0;
  let tables = 0;
  let inFence = false;
  for (const line of md.split("\n")) {
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
