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
  /**
   * Optional per-host DOM transform run AFTER dropSelectors / replaceSelectors
   * and AFTER the universal srcset upgrade, but BEFORE the body is handed to
   * the generic markdown converter. Use for host-specific quirks like custom
   * lazy-load attributes (blog.google's `data-loading="{...}"`, Medium's
   * `data-src`, etc.) that can't be expressed as CSS selectors.
   *
   * The function mutates `bodyEl` in place. Return value is ignored.
   */
  preConvertTransform?: (bodyEl: Element, doc: Document) => void;
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

/**
 * Walk up from each element collecting ancestor chains, then find the
 * deepest element that appears in every chain. Returns null if the
 * elements are in disjoint trees (shouldn't happen within one document)
 * or if the only common ancestor is the document root.
 *
 * Used by the body-selector cascade to handle blog-index pages where
 * `querySelectorAll("article")` returns many sibling cards: instead of
 * picking just the first, we pick the parent container that wraps all
 * of them so the entire listing makes it into the markdown.
 */
function nearestCommonAncestor(elements: Element[]): Element | null {
  if (elements.length === 0) return null;
  if (elements.length === 1) return elements[0].parentElement;
  const chains = elements.map(el => {
    const chain: Element[] = [];
    let cur: Element | null = el;
    while (cur) { chain.push(cur); cur = cur.parentElement; }
    return chain.reverse(); // root → leaf
  });
  const minLen = Math.min(...chains.map(c => c.length));
  let lcaIdx = -1;
  for (let i = 0; i < minLen; i++) {
    const ref = chains[0][i];
    if (chains.every(c => c[i] === ref)) lcaIdx = i;
    else break;
  }
  if (lcaIdx < 0) return null;
  const lca = chains[0][lcaIdx];
  // Reject `<html>` / `<body>` — we want the tightest wrapper, not the
  // whole document. Walk down one level into the chain if possible.
  if (lca.tagName === "HTML" || lca.tagName === "BODY") {
    return chains[0][lcaIdx + 1] || lca;
  }
  return lca;
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
  // Per-selector strategy:
  //   - If a single candidate ≥ 200 chars matches, use it (the common
  //     blog/article shape — one `<article>` is the post body).
  //   - If MULTIPLE candidates ≥ 200 chars match (≥ 3), the page is
  //     likely a blog index / archive listing where each `<article>` is
  //     a card. Picking the first card drops 95% of the page. Walk up
  //     to the candidates' nearest common ancestor and use THAT as the
  //     body so all cards survive into the markdown. See P-40 in
  //     `Meta/site-handling-patterns.md`.
  let bodyEl: Element | null = null;
  for (const sel of selectors.bodySelectors) {
    const candidates = Array.from(doc.querySelectorAll(sel))
      .filter(c => (c.textContent || "").length >= 200);
    if (candidates.length === 0) continue;
    if (candidates.length >= 3) {
      const ancestor = nearestCommonAncestor(candidates);
      if (ancestor && (ancestor.textContent || "").length >= 200) {
        bodyEl = ancestor;
        break;
      }
    }
    bodyEl = candidates[0];
    break;
  }
  if (!bodyEl) bodyEl = doc.querySelector("article") || doc.querySelector("main") || doc.body;

  // ── Pre-filter chrome ───────────────────────────────────────────────────
  for (const sel of selectors.dropSelectors || []) {
    for (const el of Array.from(bodyEl.querySelectorAll(sel))) el.remove();
  }

  // ── Upgrade responsive-image srcset to largest-candidate src ────────────
  // Modern blog hosts ship `<img src="thumb.webp" srcset="thumb.webp 240w,
  // medium.webp 800w, full.webp 1600w">` — the inline `src` is the
  // small-viewport variant. Our downstream `<img>`-extractor reads `src`
  // only, so we'd save the thumbnail. Pre-rewrite every `<img>` with a
  // non-empty `srcset` (or with a `<picture><source srcset>` parent) so
  // `src` points at the largest candidate. Surfaced concretely by
  // blog.google's Ironwood post; the same trap applies to most
  // responsive-image-using hosts.
  upgradeImgSrcsetToLargest(bodyEl, doc);

  // ── Per-host DOM transform (custom lazy-load attrs, etc.) ───────────────
  if (selectors.preConvertTransform) {
    selectors.preConvertTransform(bodyEl, doc);
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

/**
 * Walk every `<img>` inside `root`. If it has a non-empty `srcset` (directly
 * or via a `<picture><source srcset>` parent), rewrite its `src` attribute to
 * the largest candidate URL. Removes the `srcset` attribute afterward to
 * avoid downstream double-processing. Returns the count of upgraded `<img>`s
 * (for tests + visibility).
 *
 * "Largest" semantics:
 *   - Prefer width descriptors (`url 800w`); pick the largest `Nw`.
 *   - If no widths present, fall back to DPR descriptors (`url 2x`); pick
 *     the largest `Nx`.
 *   - If neither, the candidate list is just URLs — use the last one (spec
 *     says order-of-appearance ≠ priority, but in practice authors list
 *     low-to-high; the last entry is usually the best).
 *
 * Exported for unit testing.
 */
export function upgradeImgSrcsetToLargest(root: Element, doc: Document): number {
  let upgraded = 0;
  for (const img of Array.from(root.querySelectorAll("img"))) {
    let best: { url: string; rank: number } | null = null;

    // Check <picture><source srcset> siblings.
    const parent = img.parentElement;
    if (parent && parent.tagName === "PICTURE") {
      for (const source of Array.from(parent.querySelectorAll("source[srcset]"))) {
        const cand = pickLargestSrcsetCandidate(source.getAttribute("srcset") || "");
        if (cand && (!best || cand.rank > best.rank)) best = cand;
      }
    }

    // Check the <img>'s own srcset.
    const imgSrcset = img.getAttribute("srcset");
    if (imgSrcset) {
      const cand = pickLargestSrcsetCandidate(imgSrcset);
      if (cand && (!best || cand.rank > best.rank)) best = cand;
    }

    if (best) {
      const currentSrc = img.getAttribute("src") || "";
      if (currentSrc !== best.url) {
        img.setAttribute("src", best.url);
        upgraded++;
      }
      img.removeAttribute("srcset");
    }
  }
  return upgraded;
}

/**
 * Parse one srcset attribute value, return the largest candidate.
 *
 * srcset grammar (HTML spec): comma-separated list of `URL [descriptor]`
 * pairs, where descriptor is `Nw` (width in CSS pixels) or `Nx` (pixel-
 * density), or absent (defaults to 1x). URLs cannot contain whitespace.
 *
 * Precedence rule (chosen for "give me the highest-resolution asset"):
 *   1. Any `w`-descriptor candidate beats any `x`-descriptor candidate.
 *      Width tells you the asset's actual pixel size — a 1600w variant
 *      is unambiguously larger than a 3x@200px variant.
 *   2. Within `w`s, the largest `Nw` wins. Within `x`s, the largest `Nx`.
 *   3. If only unitless URLs appear, return the *last* one — authors
 *      typically list low-to-high; the last entry is the best bet.
 *
 * The returned `rank` is the winning descriptor's numeric value (the
 * width in CSS pixels or the DPR multiplier), useful for tests + logging.
 *
 * Returns null on empty / unparseable input.
 *
 * Exported for unit testing.
 */
export function pickLargestSrcsetCandidate(srcset: string): { url: string; rank: number } | null {
  const trimmed = srcset.trim();
  if (!trimmed) return null;
  const candidates = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  let bestW: { url: string; w: number } | null = null;
  let bestX: { url: string; x: number } | null = null;
  let fallback: string | null = null;
  for (const c of candidates) {
    // Match "URL" or "URL Nw" or "URL Nx" — URL is everything up to the last whitespace.
    const m = c.match(/^(\S+)(?:\s+(\d+(?:\.\d+)?)(w|x))?$/);
    if (!m) continue;
    const [, url, num, unit] = m;
    fallback = url;
    if (!num || !unit) continue;
    const n = parseFloat(num);
    if (unit === "w") {
      if (!bestW || n > bestW.w) bestW = { url, w: n };
    } else {
      if (!bestX || n > bestX.x) bestX = { url, x: n };
    }
  }
  if (bestW) return { url: bestW.url, rank: bestW.w };
  if (bestX) return { url: bestX.url, rank: bestX.x };
  if (fallback) return { url: fallback, rank: 0 };
  return null;
}
