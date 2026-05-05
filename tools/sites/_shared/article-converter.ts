/**
 * Shared "article-shape" converter — used by site modules for hosts whose
 * pages follow the standard blog/article pattern: one main content
 * container, og:title metadata, optional published-date meta tag,
 * occasional chrome divs to strip.
 *
 * Each per-host site module supplies a small `ArticleSelectors` config
 * (body selector, title-suffix-strip, dropSelectors, imagePrefix) and
 * lets this helper handle the rest. Reduces per-host converter code
 * from ~150 lines to ~30.
 *
 * For richer/structured pages (catalog, gallery, REST-API-driven),
 * write a dedicated converter; this helper is for the simple blog shape.
 */

import { JSDOM } from "jsdom";

import { convertGenericHtml } from "./generic-converter.ts";
import { applyCommonMarkdownCleanups } from "./markdown-cleanups.ts";

export interface ArticleSelectors {
  /**
   * CSS selectors for the article body container, tried in order; first
   * match (with at least 200 chars of textContent) wins. Falls back to
   * `<article>` then `<main>` if none match.
   */
  bodySelectors: string[];
  /**
   * Optional suffix to strip from the document title. Run on the value
   * extracted from og:title (or document.title as fallback). E.g.
   * `/\s*\|\s*Qwen\s*$/` strips ` | Qwen`.
   */
  titleSuffix?: RegExp;
  /**
   * Selectors for elements to remove from the body BEFORE turndown sees
   * them. Use for chrome (share rows, comment widgets, related-posts
   * blocks, author bios) that the body container includes.
   */
  dropSelectors?: string[];
  /**
   * Selectors whose matches should be REPLACED with a placeholder
   * paragraph (instead of removed). Use for non-text content turndown
   * would mangle — e.g. inline `<svg>` whose `<text>` children would
   * otherwise become a character-per-line "explosion" in the markdown.
   *
   * Each entry: `{ selector, replacementText }`. Every match is swapped
   * for a `<p>` containing `replacementText`. Runs AFTER `dropSelectors`.
   */
  replaceSelectors?: { selector: string; replacementText: string }[];
  /**
   * Set true if the host uses `<h1>` for in-page section headings inside
   * the body (Tailwind .prose theme, some Hexo themes). Demotes all
   * body headings by 1 level so the §2 contract single-H1 rule holds.
   */
  demoteH1?: boolean;
  /** Filename prefix for image localization, e.g. "qwen-ai", "blog-google". */
  imagePrefix: string;
  /** Optional suffix appended to title for diagnostics (e.g. site name). */
  diagnosticTag?: string;
}

export interface ArticleConvertResult {
  markdown: string;
  imagesToDownload: { remoteUrl: string; localFilename: string }[];
  metadata: {
    title: string;
    description: string;
    publishedAt: string;
    authors: string[];
  };
  stats: {
    bodyChars: number;
    images: number;
  };
}

export interface ArticleConvertOpts {
  html: string;
  url: string;
  selectors: ArticleSelectors;
}

export function convertArticle(opts: ArticleConvertOpts): ArticleConvertResult {
  const { selectors } = opts;
  const dom = new JSDOM(opts.html);
  const doc = dom.window.document;

  // ── Metadata ─────────────────────────────────────────────────────────────
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
  const docTitle = (doc.querySelector("title")?.textContent || "").trim();
  let title = (ogTitle || docTitle).trim();
  if (selectors.titleSuffix) title = title.replace(selectors.titleSuffix, "").trim();
  if (!title) title = `(${selectors.imagePrefix} article)`;

  const description =
    (doc.querySelector('meta[property="og:description"]')?.getAttribute("content") || "").trim();

  const publishedAt =
    (doc.querySelector('meta[property="article:published_time"]')?.getAttribute("content") || "").trim() ||
    (doc.querySelector('meta[name="article:published_time"]')?.getAttribute("content") || "").trim() ||
    (doc.querySelector('meta[property="og:updated_time"]')?.getAttribute("content") || "").trim() ||
    (doc.querySelector('meta[itemprop="datePublished"]')?.getAttribute("content") || "").trim();

  const authors: string[] = [];
  for (const a of Array.from(doc.querySelectorAll('meta[property="article:author"], meta[name="author"]'))) {
    const v = a.getAttribute("content");
    if (v && v.trim() && !authors.includes(v.trim())) authors.push(v.trim());
  }

  // ── Body extraction ─────────────────────────────────────────────────────
  let bodyEl: Element | null = null;
  for (const sel of selectors.bodySelectors) {
    const candidates = Array.from(doc.querySelectorAll(sel));
    for (const c of candidates) {
      if ((c.textContent || "").length >= 200) { bodyEl = c; break; }
    }
    if (bodyEl) break;
  }
  if (!bodyEl) bodyEl = doc.querySelector("article") || doc.querySelector("main") || doc.body;

  // ── Pre-filter chrome ───────────────────────────────────────────────────
  for (const sel of selectors.dropSelectors || []) {
    for (const el of Array.from(bodyEl.querySelectorAll(sel))) el.remove();
  }

  // ── Replace selectors with placeholder paragraphs ────────────────────────
  for (const { selector, replacementText } of selectors.replaceSelectors || []) {
    for (const el of Array.from(bodyEl.querySelectorAll(selector))) {
      const p = doc.createElement("p");
      p.textContent = replacementText;
      el.replaceWith(p);
    }
  }

  // ── Demote H1 if requested (Tailwind .prose pattern) ────────────────────
  if (selectors.demoteH1) {
    const headings = Array.from(bodyEl.querySelectorAll("h1, h2, h3, h4, h5"));
    for (const h of headings) {
      const oldLevel = parseInt(h.tagName.slice(1), 10);
      const newH = doc.createElement(`h${oldLevel + 1}`);
      while (h.firstChild) newH.appendChild(h.firstChild);
      if (h.getAttribute("id")) newH.setAttribute("id", h.getAttribute("id")!);
      h.replaceWith(newH);
    }
  }

  // ── Convert via shared generic-converter ─────────────────────────────────
  const generic = convertGenericHtml({
    html: bodyEl.outerHTML,
    url: opts.url,
    imagePrefix: selectors.imagePrefix,
  });
  let body = generic.body;
  body = applyCommonMarkdownCleanups(body);

  // ── Compose markdown ─────────────────────────────────────────────────────
  const fm: string[] = [`# ${title}`, ""];
  fm.push(`> 原文链接: ${opts.url}`);
  if (authors.length > 0) fm.push(`> 作者: ${authors.join(", ")}`);
  if (publishedAt) {
    const dateStr = publishedAt.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || publishedAt;
    fm.push(`> 发表于: ${dateStr}`);
  }
  if (description) fm.push(`> ${description}`);
  fm.push("", "---", "");

  let markdown = fm.join("\n") + body;
  markdown = markdown.replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "\n");

  return {
    markdown,
    imagesToDownload: generic.imagesToDownload,
    metadata: { title, description, publishedAt, authors },
    stats: { bodyChars: body.length, images: generic.imagesToDownload.length },
  };
}
