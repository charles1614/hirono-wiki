/**
 * Generic HTML → markdown converter shared by every site module.
 *
 * Pure function: given raw outerHTML extracted from a browser session
 * (or curl), produce clean §2-body markdown plus a list of images to
 * localize. No site-specific selectors or rules — host-specific
 * extraction happens in each module's `converter.ts` BEFORE this
 * function sees the HTML. This module just owns the HTML→Markdown
 * conversion mechanics (jsdom + TurndownService).
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

import { applyCommonMarkdownCleanups } from "./markdown-cleanups.ts";

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

  // 4a. Hexo / Pygments / Rouge syntax-highlighter unwrap.
  //
  // Static-site generators (Hexo, Jekyll w/ Rouge, some Sphinx themes)
  // render fenced code as:
  //   <figure class="highlight <lang>">
  //     <table><tbody><tr>
  //       <td class="gutter"><pre>1<br>2<br>3<br></pre></td>
  //       <td class="code"><pre>line1<br>line2<br>line3<br></pre></td>
  //     </tr></tbody></table>
  //   </figure>
  // Naively converting this gives a 2-column markdown table with `<br>1 /`
  // style cells — which is what 01.me's user-flagged output had. Detect
  // the pattern and replace the entire `<figure>` with a single
  // `<pre><code class="language-<lang>">…</code></pre>` BEFORE turndown
  // sees it.
  for (const fig of Array.from(root.querySelectorAll("figure.highlight, div.highlight, figure.code, div.code"))) {
    const codeTd = fig.querySelector("td.code, td:nth-child(2)");
    const codePre = codeTd ? codeTd.querySelector("pre") : fig.querySelector("pre");
    if (!codePre) continue;
    // Reconstruct each line: <span class="line">text</span><br>...
    const lines: string[] = [];
    const lineNodes = codePre.querySelectorAll("span.line, .line");
    if (lineNodes.length > 0) {
      for (const ln of Array.from(lineNodes)) lines.push(ln.textContent || "");
    } else {
      // Fallback: take pre.textContent and split on what looks like line breaks.
      lines.push(...((codePre.textContent || "").split(/\r?\n/)));
    }
    // Language: figure.highlight.<lang> or div.highlight pre.language-<lang>
    let lang = "";
    const cls = fig.getAttribute("class") || "";
    const langMatch = cls.match(/highlight\s+(\S+)|language-(\S+)/);
    if (langMatch) lang = (langMatch[1] || langMatch[2] || "").trim();
    if (lang === "plaintext" || lang === "text") lang = "";
    const newPre = doc.createElement("pre");
    const newCode = doc.createElement("code");
    if (lang) newCode.setAttribute("class", `language-${lang}`);
    newCode.textContent = lines.join("\n");
    newPre.appendChild(newCode);
    fig.replaceWith(newPre);
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
  //
  // Also escape currency `$<digit>` → `\$<digit>` so downstream KaTeX
  // renderers (e.g. lark-hirono's Feishu upload pipeline) don't try to
  // interpret `$60 billion ... $122 billion` as inline math. Real LaTeX
  // math typically uses `$<letter>` (variables) — those stay unescaped.
  // Inline-code spans and fenced code are skipped.
  {
    const lines = body.split("\n");
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^```/.test(lines[i].trim())) { inFence = !inFence; continue; }
      if (inFence) continue;
      let l = lines[i]
        .replace(/\\\[(\d+)\\\]/g, "[$1]")
        .replace(/\\\[(\d+)\]/g, "[$1]");
      // Escape unescaped `$` directly followed by a digit (currency).
      // Negative lookbehind `(?<!\\)` guards already-escaped `\$`.
      // Stripping inline-code spans first so `$50` inside a `code` span
      // (e.g., a shell variable) is left alone.
      const codeSpans: string[] = [];
      l = l.replace(/(`+)([^\n]*?)\1/g, (m) => {
        codeSpans.push(m);
        return `CODE${codeSpans.length - 1}`;
      });
      l = l.replace(/(?<!\\)\$(?=\d)/g, "\\$");
      l = l.replace(/CODE(\d+)/g, (_m, idx) => codeSpans[Number(idx)]);
      lines[i] = l;
    }
    body = lines.join("\n");
  }

  // Multi-line link wrapper unwrap. Two shapes show up in the generic
  // web-fetch path:
  //   (a) Click-to-enlarge / quoted-card: `[\n\n![alt](url)\n\n](other)`
  //       Unwrap to just the image (drop the outer link).
  //   (b) Multi-line text wrapper: `[\n\nText\n\n](url)` (e.g. profile-
  //       link cards rendered with the visible text on its own line).
  //       Collapse to single-line `[Text](url)`.
  // Walks lines so paren-in-title shapes that the naive regex misses are
  // caught. (Lifted from tools/sites/substack/converter.ts.)
  {
    const srcLines = body.split("\n");
    const keep: string[] = [];
    let i = 0;
    while (i < srcLines.length) {
      if (srcLines[i].trim() === "[") {
        let j = i + 1;
        while (j < srcLines.length && srcLines[j].trim() === "") j++;
        const innerMatch = j < srcLines.length ? srcLines[j].match(/^(.+?)\s*$/) : null;
        if (innerMatch) {
          const inner = innerMatch[1];
          let k = j + 1;
          while (k < srcLines.length && srcLines[k].trim() === "") k++;
          const closeMatch = k < srcLines.length ? srcLines[k].match(/^\](\(.+\))\s*$/) : null;
          if (closeMatch) {
            // Shape (a): `![alt](url)` inside.
            if (/^!\[[^\]]*\]\(.+\)$/.test(inner)) {
              keep.push(inner);  // emit just the image, drop outer link
            } else if (!/[\[\]]/.test(inner) && inner.length < 200) {
              // Shape (b): plain text inside (no nested brackets, not
              // arbitrary length). Collapse to `[text](url)` on one line.
              keep.push(`[${inner}]${closeMatch[1]}`);
            } else {
              // Mixed/complex content — leave as-is rather than risk
              // mangling. Structural rule will flag it for human review.
              keep.push(srcLines[i]);
              i++;
              continue;
            }
            i = k + 1;
            continue;
          }
        }
      }
      keep.push(srcLines[i]);
      i++;
    }
    body = keep.join("\n");
  }

  // Shared post-turndown cleanups (insert space after closing `**` etc.).
  body = applyCommonMarkdownCleanups(body);

  // Final whitespace cleanup — runs LAST so it catches any `\n{3,}` that
  // earlier passes (heading-drop, link-unwrap) re-introduced.
  body = body.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

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
