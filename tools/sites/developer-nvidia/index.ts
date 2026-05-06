/**
 * developer.nvidia.com — NVIDIA technical developer site. Two URL
 * shapes share the same WordPress-style stable selectors
 * (`<article>` / `.entry-content`):
 *
 *   - `/blog/<slug>/`   — Technical Blog posts (the bulk of bookmarks)
 *   - `/cuda/<page>`    — Reference pages (e.g. `/cuda/gpus` Compute
 *                         Capability table). Same WordPress shape;
 *                         body lives in `<main>` when `.entry-content`
 *                         is absent.
 *
 * No path filter — the module claims every developer.nvidia.com URL
 * and the body-selector cascade picks whichever container exists.
 */

import { makeArticleSite } from "../_shared/article-site-factory.ts";

export const { site, testHooks } = makeArticleSite({
  name: "developer-nvidia",
  hosts: ["developer.nvidia.com"],
  converterName: "convertDeveloperNvidia",
  selectors: {
    bodySelectors: [
      "article .entry-content",
      ".entry-content",
      "article",
      "main",
    ],
    titleSuffix: /\s*\|\s*NVIDIA(?:\s+(?:Technical\s+Blog|Developer))?\s*$/,
    dropSelectors: [
      ".entry-meta",
      ".author-bio",
      ".share",
      ".social-share",
      ".related-posts",
      ".post-navigation",
      ".comments-area",
      ".tags",
      ".breadcrumb",
      "nav",
      "footer",
    ],
    imagePrefix: "developer-nvidia",
  },
});
