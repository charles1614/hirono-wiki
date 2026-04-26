/**
 * Convert raw zhihu article HTML (the `.Post-RichTextContainer` outerHTML
 * extracted via opencli's headless browser) into clean §2-contract markdown.
 *
 * Per the universal pattern (CLAUDE.md §5a): we use opencli for browser +
 * auth only; conversion is owned by us. Replaces the previous
 * opencli `zhihu download` pipeline whose markdown output lost paragraph
 * structure on long-form articles AND polluted the body with zhihu's
 * internal search-redirect links (zhida.zhihu.com).
 *
 * Pure function: no I/O, no network. Caller (fetcher.ts) handles the
 * browser session + image downloads.
 */

import { JSDOM } from "jsdom";
import TurndownService from "turndown";
// @ts-expect-error  no types published for this package
import { gfm } from "@joplin/turndown-plugin-gfm";

export interface ZhihuMetadata {
  title: string;
  author: string;
  /** Display date — "2025-01-09 02:41・北京" or similar; "编辑于"/"发布于" prefix stripped. */
  publishedAt: string;
}

export interface ZhihuImageDownload {
  remoteUrl: string;
  localFilename: string;
}

export interface ConvertResult {
  markdown: string;
  imagesToDownload: ZhihuImageDownload[];
  metadata: ZhihuMetadata;
  stats: {
    images: number;
    codeFences: number;
    zhidaLinksUnwrapped: number;
  };
}

/**
 * Unwrap zhihu's internal search-redirect links (`zhida.zhihu.com/search?...`).
 *
 * Zhihu auto-links many words in article bodies to its own internal entity-
 * search service. The links don't add reading value — the destination is just
 * a search results page on zhihu — and they pollute the markdown.
 * Strip the wrapping `<a>`, keep the inner text.
 */
/** Map digits 0-9 → unicode superscript. */
const SUPERSCRIPT_DIGIT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};
function toSuperscript(num: string): string {
  return num.split("").map((d) => SUPERSCRIPT_DIGIT[d] ?? d).join("");
}

function unwrapZhidaLinks(doc: Document, root: Element): number {
  let count = 0;
  for (const a of Array.from(root.querySelectorAll("a"))) {
    const href = a.getAttribute("href") || "";
    const isZhida = /zhida\.zhihu\.com/.test(href);
    // Zhihu in-text footnote refs: `<a data-reference-link="true"
    // href="#ref_N">[1]</a>`. The rendered zhihu page shows them as a
    // small superscript number (¹), not bracketed text. Convert `[N]`
    // → unicode superscript so the markdown renders the same way as
    // the source page (and avoids the ugly `[\[1\]](#ref_1)` form
    // turndown would otherwise emit).
    const isReferenceLink = a.getAttribute("data-reference-link") === "true";
    if (!isZhida && !isReferenceLink) continue;
    const parent = a.parentNode;
    if (!parent) continue;
    if (isReferenceLink) {
      const m = (a.textContent || "").trim().match(/^\[(\d+)\]$/);
      if (m) {
        a.replaceWith(doc.createTextNode(toSuperscript(m[1])));
        count++;
        continue;
      }
    }
    // Default: just unwrap the link, keep the inner content.
    while (a.firstChild) parent.insertBefore(a.firstChild, a);
    a.remove();
    count++;
  }
  return count;
}

/**
 * Normalize zhihu image elements:
 *   - Prefer `data-original` (full-res) over `src` (lazy-loaded thumbnail)
 *   - Generate stable local filenames `zhihu-img-NNN.<ext>`
 *   - Replace each `<img>` with a clean placeholder for turndown
 *   - Return the (remoteUrl, localFilename) list for the caller to download
 */
function normalizeImages(doc: Document, root: Element): ZhihuImageDownload[] {
  const imgs = root.querySelectorAll("img");
  const out: ZhihuImageDownload[] = [];
  let counter = 0;
  for (const img of imgs) {
    const src = img.getAttribute("data-original")
      || img.getAttribute("data-actualsrc")
      || img.getAttribute("src")
      || "";
    if (!/^https?:\/\//i.test(src)) {
      img.remove();
      continue;
    }
    counter++;
    let ext = "jpg";
    if (/\.png(\?|$)/i.test(src)) ext = "png";
    else if (/\.gif(\?|$)/i.test(src)) ext = "gif";
    else if (/\.webp(\?|$)/i.test(src)) ext = "webp";
    else if (/\.svg(\?|$)/i.test(src)) ext = "svg";
    if (ext === "jpeg") ext = "jpg";
    const localFilename = `zhihu-img-${String(counter).padStart(3, "0")}.${ext}`;
    out.push({ remoteUrl: src, localFilename });
    const replacement = doc.createElement("img");
    replacement.setAttribute("src", localFilename);
    const alt = img.getAttribute("alt");
    if (alt && alt.trim()) replacement.setAttribute("alt", alt.trim());
    img.parentNode?.replaceChild(replacement, img);
  }
  return out;
}

/**
 * Strip zhihu-internal chrome blocks that should not appear in the body:
 *   - "目录" (TOC) navigation widget at the top
 *   - Inline "查看回答详情" / "继续阅读" / engagement buttons
 *   - Equation/formula widget chrome
 */
function stripZhihuChrome(doc: Document, root: Element): void {
  // TOC widget — usually a `<div>` with class `Catalog` or has text "目录"
  for (const el of Array.from(root.querySelectorAll(".Catalog, .ColumnPageHeader, .ColumnEditor, .Reward"))) {
    el.remove();
  }
  // Strip standalone "目录" headings + zero-width-space lines that appear
  // before the article body.
  const firstFew = Array.from(root.children).slice(0, 5);
  for (const el of firstFew) {
    const t = (el.textContent || "").trim().replace(/​/g, "");
    if (t === "目录" || t === "" || t.length === 0) {
      el.remove();
    }
  }
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
  // Preserve <code class="language-X"> inside <pre> as a fenced block with language hint.
  td.addRule("fenced-code-with-language", {
    filter: (node) => node.nodeName === "PRE" && (node as Element).querySelector("code") !== null,
    replacement: (_content, node) => {
      const codeEl = (node as Element).querySelector("code");
      const text = codeEl?.textContent ?? "";
      const cls = codeEl?.getAttribute("class") || "";
      const langMatch = cls.match(/language-(\S+)/);
      const lang = langMatch ? langMatch[1] : "";
      const trimmed = text.replace(/\r\n/g, "\n").replace(/^\n+/, "").replace(/\n+$/, "");
      return `\n\n\`\`\`${lang}\n${trimmed}\n\`\`\`\n\n`;
    },
  });
  td.addRule("fenced-code-bare", {
    filter: (node) => node.nodeName === "PRE" && (node as Element).querySelector("code") === null,
    replacement: (_content, node) => {
      const text = (node as Element).textContent ?? "";
      const trimmed = text.replace(/\r\n/g, "\n").replace(/^\n+/, "").replace(/\n+$/, "");
      return `\n\n\`\`\`\n${trimmed}\n\`\`\`\n\n`;
    },
  });
  return td;
}

function countFenceBlocks(md: string): number {
  const lines = md.split("\n");
  let n = 0;
  for (const l of lines) if (/^```/.test(l.trim())) n++;
  return Math.floor(n / 2);
}

/**
 * Trim zhihu metadata-string artifacts:
 *   - Strip "编辑于" / "发布于" prefix from the date string.
 *   - Strip zero-width spaces (`​`) and other invisibles from author/date.
 */
function cleanMetaString(s: string): string {
  return s
    .replace(/[​‌‍﻿]/g, "")
    .replace(/^(?:编辑于|发布于)\s*/, "")
    .trim();
}

export function convertZhihuArticleHtml(
  contentHtml: string,
  rawMetadata: { title: string; author: string; date: string },
  originUrl: string,
): ConvertResult {
  const sanitized = contentHtml
    .replace(/\sstyle\s*=\s*"[^"]*"/gi, "")
    .replace(/\sstyle\s*=\s*'[^']*'/gi, "");
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${sanitized}</body></html>`);
  const doc = dom.window.document;
  const root = doc.body.firstElementChild ?? doc.body;

  // 1. Strip zhihu-internal chrome blocks (TOC, reward widget, etc.)
  stripZhihuChrome(doc, root);

  // 2. Unwrap zhida.zhihu.com search-redirect links
  const zhidaLinksUnwrapped = unwrapZhidaLinks(doc, root);

  // 3. Normalize images and collect download list
  const imagesToDownload = normalizeImages(doc, root);

  // 4. Convert via turndown
  const td = makeTurndown();
  let body = td.turndown(root.outerHTML).trim();
  body = body.replace(/\n{3,}/g, "\n\n");
  // Drop empty headings (defensive — converters elsewhere can produce these).
  body = body.replace(/^#{1,6}\s*$\n?/gm, "");
  // Drop leading zero-width-space-only lines.
  body = body.replace(/^\s*​+\s*\n?/gm, "");
  // Move trailing colon out of bold spans. Authors writing in mdnice/zhihu
  // editors often type `**效果：**prose` — semantically the colon is a
  // separator, not part of the bold term. `**term：**` reads cleanly as
  // `**term**：` and the rendered output is identical.
  body = body.replace(/\*\*([^*\n]+?)([:：])\*\*/g, "**$1**$2");

  // 5. Build §2 frontmatter
  const meta: ZhihuMetadata = {
    title: rawMetadata.title.trim(),
    author: cleanMetaString(rawMetadata.author),
    publishedAt: cleanMetaString(rawMetadata.date),
  };
  const fm: string[] = [`# ${meta.title || "(untitled)"}`, ""];
  if (meta.author) fm.push(`> 作者: ${meta.author}`);
  if (meta.publishedAt) fm.push(`> 发布时间: ${meta.publishedAt}`);
  fm.push(`> 原文链接: ${originUrl}`, "", "---", "", "");

  const markdown = fm.join("\n") + body + "\n";

  return {
    markdown,
    imagesToDownload,
    metadata: meta,
    stats: {
      images: imagesToDownload.length,
      codeFences: countFenceBlocks(markdown),
      zhidaLinksUnwrapped,
    },
  };
}
