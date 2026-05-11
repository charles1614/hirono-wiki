/**
 * blog.google — Google's official corporate blog. Server-rendered HTML
 * with `<article class="uni-blog-landing">` (landing) or `<article>`
 * (post). Body content lives inside `<div class="article-body">`.
 *
 * Lazy-load quirk (Ironwood TPU post surfaced this): in-body figures
 * use a bespoke `data-loading='{"mobile":"...","desktop":"..."}'`
 * JSON attribute instead of standard `srcset`. The inline `src`
 * points at a `width-100` thumbnail; the readable `width-1000`
 * desktop variant lives in the data-loading JSON. We rewrite `src`
 * to the desktop URL in `preConvertTransform` so the figure
 * downloader saves the readable variant.
 */

import { makeArticleSite } from "../_shared/article-site-factory.ts";

/**
 * Walk `<img>` tags with `data-loading` JSON; prefer the `desktop` URL.
 *
 * Shape observed on blog.google:
 *   <img src=".../width-100.webp"
 *        data-loading='{"mobile":".../width-500.webp",
 *                       "desktop":".../width-1000.webp"}'>
 *
 * Defensive: malformed JSON / missing keys leaves the `<img>` alone.
 */
function upgradeBlogGoogleDataLoading(root: Element, _doc: Document): void {
  for (const img of Array.from(root.querySelectorAll("img[data-loading]"))) {
    const raw = img.getAttribute("data-loading");
    if (!raw) continue;
    let parsed: { desktop?: string; mobile?: string } | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!parsed) continue;
    const upgrade = parsed.desktop || parsed.mobile;
    if (!upgrade || typeof upgrade !== "string") continue;
    if (img.getAttribute("src") !== upgrade) {
      img.setAttribute("src", upgrade);
    }
    img.removeAttribute("data-loading");
  }
}

export const { site, testHooks } = makeArticleSite({
  name: "blog-google",
  hosts: ["blog.google"],
  converterName: "convertBlogGoogle",
  selectors: {
    bodySelectors: [
      ".article-container__content",
      ".uni-container.article-container",
      "article .article-body",
      ".article-body",
      "article",
      "main",
    ],
    titleSuffix: /\s*\|\s*Google\s*$/,
    dropSelectors: [
      ".article-share__title",
      ".copy-link__dialog",
      ".uni-blog-landing__nav",
      ".article-related-posts",
      ".author-bio",
      ".uni-social-share",
      ".uni-article-progress-bar",
      ".article-meta__container",
      ".article-meta__author-container",
      ".uni-blog-article-tags",
      ".article-tags",
      ".article-hero",
      "nav",
      "footer",
    ],
    imagePrefix: "blog-google",
    preConvertTransform: upgradeBlogGoogleDataLoading,
  },
});
