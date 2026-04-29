/**
 * intuitionlabs.ai abstract-page converter.
 *
 * Pure function: HTML string → §2-contract markdown + image-localization list.
 *
 * Strategy:
 *   1. Title from `<meta property="og:title">` (strip ` | IntuitionLabs` suffix).
 *   2. Description from `<meta property="og:description">` (becomes a callout).
 *   3. Body from `<div class="prose ...">` outerHTML — this is the
 *      Tailwind-typography wrapper around just the article content,
 *      bypassing all header / nav / TOC / footer chrome.
 *   4. Demote `<h1>` inside body to `<h2>` (Tailwind theme repurposes
 *      `<h1>` for in-page section titles, but our §2 contract reserves
 *      `# ` for the frontmatter title).
 *   5. Run shared `convertGenericHtml` on the body for jsdom + turndown +
 *      image-localization.
 */

import { JSDOM } from "jsdom";

import { convertGenericHtml } from "../_shared/generic-converter.ts";
import { applyCommonMarkdownCleanups } from "../_shared/markdown-cleanups.ts";

export interface IntuitionlabsConvertResult {
  markdown: string;
  imagesToDownload: { remoteUrl: string; localFilename: string }[];
  metadata: {
    title: string;
    description: string;
    publishedAt: string;
  };
  stats: {
    bodyChars: number;
    images: number;
  };
}

export interface IntuitionlabsConvertOpts {
  html: string;
  url: string;
}

export function convertIntuitionlabs(opts: IntuitionlabsConvertOpts): IntuitionlabsConvertResult {
  const dom = new JSDOM(opts.html);
  const doc = dom.window.document;

  // ── Metadata ─────────────────────────────────────────────────────────────
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
  const title = ogTitle.replace(/\s*\|\s*IntuitionLabs\s*$/, "").trim() || "(IntuitionLabs article)";
  const description = (doc.querySelector('meta[property="og:description"]')?.getAttribute("content") || "").trim();
  const publishedAt = (doc.querySelector('meta[property="article:published_time"]')?.getAttribute("content") || "").trim();

  // ── Body extraction ─────────────────────────────────────────────────────
  const bodyEl = doc.querySelector(".prose");
  if (!bodyEl) {
    return {
      markdown: "",
      imagesToDownload: [],
      metadata: { title, description, publishedAt },
      stats: { bodyChars: 0, images: 0 },
    };
  }

  // Demote every body heading by 1 level (h1 → h2, h2 → h3, ..., h5 → h6,
  // h6 stays h6). Tailwind .prose theme puts in-page section titles at
  // h1; our §2 contract reserves `# ` for the frontmatter title.
  //
  // Collect all headings up-front (single snapshot) then mutate. This
  // avoids double-demote: a naive two-pass approach (first h1→h2, then
  // h2→h3) would bump original h1s twice.
  const headings = Array.from(bodyEl.querySelectorAll("h1, h2, h3, h4, h5"));
  for (const h of headings) {
    const oldLevel = parseInt(h.tagName.slice(1), 10);
    const newH = doc.createElement(`h${oldLevel + 1}`);
    while (h.firstChild) newH.appendChild(h.firstChild);
    if (h.getAttribute("id")) newH.setAttribute("id", h.getAttribute("id")!);
    h.replaceWith(newH);
  }

  // Run the generic converter for jsdom-cleanup + turndown + image localization.
  // We pass the post-demote bodyEl outerHTML.
  const generic = convertGenericHtml({
    html: bodyEl.outerHTML,
    url: opts.url,
    imagePrefix: "intuitionlabs",
  });

  let body = generic.body;
  // Apply shared post-turndown cleanups.
  body = applyCommonMarkdownCleanups(body);

  // ── Compose markdown ─────────────────────────────────────────────────────
  const fm: string[] = [`# ${title}`, ""];
  fm.push(`> 原文链接: ${opts.url}`);
  if (publishedAt) fm.push(`> 发表于: ${publishedAt.slice(0, 10)}`);
  if (description) {
    fm.push(`> ${description}`);
  }
  fm.push("", "---", "");

  let markdown = fm.join("\n") + body;
  markdown = markdown.replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "\n");

  return {
    markdown,
    imagesToDownload: generic.imagesToDownload,
    metadata: { title, description, publishedAt },
    stats: { bodyChars: body.length, images: generic.imagesToDownload.length },
  };
}
