/**
 * sspai.com (少数派) post converter.
 *
 * Pure function: HTML string → §2-contract markdown + image-localization list.
 *
 * Strategy:
 *   1. Title from `<title>` (strip ` - 少数派` suffix).
 *   2. Date from JSON-LD `"datePublished":"..."` (sspai embeds article
 *      metadata as JSON-LD; reliable across page versions).
 *   3. Body from `<div class="article__main__content">` — the inner
 *      WangEditor content wrapper. Bypasses author-card chrome,
 *      action bar (like / comment / share buttons), and sidebar.
 *   4. Image normalization: each `<figure class="image ss-img-wrapper">`
 *      contains an `<img>` with both `src=` (resized via imageView2
 *      transform query) and `data-original=` (full-resolution URL).
 *      Prefer `data-original` for the localized download — gets the
 *      full-quality original without sspai's CDN transforms.
 *   5. Strip the `<figure>` wrapper itself, keeping just the `<img>`.
 */

import { JSDOM } from "jsdom";

import { convertGenericHtml } from "../_shared/generic-converter.ts";
import { applyCommonMarkdownCleanups } from "../_shared/markdown-cleanups.ts";

export interface SspaiConvertResult {
  markdown: string;
  imagesToDownload: { remoteUrl: string; localFilename: string }[];
  metadata: {
    title: string;
    publishedAt: string;
  };
  stats: {
    bodyChars: number;
    images: number;
  };
}

export interface SspaiConvertOpts {
  html: string;
  url: string;
}

export function convertSspai(opts: SspaiConvertOpts): SspaiConvertResult {
  const dom = new JSDOM(opts.html);
  const doc = dom.window.document;

  // ── Metadata ─────────────────────────────────────────────────────────────
  const titleEl = doc.querySelector("title");
  const title = (titleEl?.textContent || "")
    .replace(/\s*-\s*少数派\s*$/, "")
    .trim() || "(sspai post)";

  // Date from JSON-LD (more reliable than scraping a <time> element).
  let publishedAt = "";
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const data = JSON.parse(script.textContent || "{}");
      if (typeof data.datePublished === "string") {
        publishedAt = data.datePublished;
        break;
      }
    } catch { /* skip non-JSON */ }
  }

  // ── Body extraction ─────────────────────────────────────────────────────
  const bodyEl = doc.querySelector(".article__main__content")
    || doc.querySelector(".article-body")
    || doc.querySelector("article");
  if (!bodyEl) {
    return {
      markdown: "",
      imagesToDownload: [],
      metadata: { title, publishedAt },
      stats: { bodyChars: 0, images: 0 },
    };
  }

  // ── Image normalization ─────────────────────────────────────────────────
  // sspai wraps each image in `<figure class="image ss-img-wrapper">`. The
  // inner `<img>` has both `src=` (CDN-transformed lower-res) and
  // `data-original=` (full-res). Swap to data-original for our localized
  // download, then unwrap the <figure> so turndown emits a plain image.
  for (const fig of Array.from(bodyEl.querySelectorAll("figure.image, figure.ss-img-wrapper, figure"))) {
    const img = fig.querySelector("img");
    if (img) {
      const original = img.getAttribute("data-original");
      if (original) img.setAttribute("src", original);
      // Replace figure with just the img.
      fig.replaceWith(img);
    } else {
      fig.remove();
    }
  }

  // ── Convert via shared generic-converter ─────────────────────────────────
  const generic = convertGenericHtml({
    html: bodyEl.outerHTML,
    url: opts.url,
    imagePrefix: "sspai",
  });

  let body = generic.body;
  body = applyCommonMarkdownCleanups(body);

  // ── Compose markdown ─────────────────────────────────────────────────────
  const fm: string[] = [`# ${title}`, ""];
  fm.push(`> 原文链接: ${opts.url}`);
  if (publishedAt) {
    const dateStr = publishedAt.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || publishedAt;
    fm.push(`> 发表于: ${dateStr}`);
  }
  fm.push("", "---", "");

  let markdown = fm.join("\n") + body;
  markdown = markdown.replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "\n");

  return {
    markdown,
    imagesToDownload: generic.imagesToDownload,
    metadata: { title, publishedAt },
    stats: { bodyChars: body.length, images: generic.imagesToDownload.length },
  };
}
