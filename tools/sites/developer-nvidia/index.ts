/**
 * developer.nvidia.com/blog — NVIDIA technical developer blog. Server-
 * rendered WordPress with stable selectors (`<article>` / `entry-content`).
 * Strips author/share/related chrome.
 */

import { makeArticleSite } from "../_shared/article-site-factory.ts";

export const { site, testHooks } = makeArticleSite({
  name: "developer-nvidia",
  hosts: ["developer.nvidia.com"],
  pathPrefix: "/blog/",
  converterName: "convertDeveloperNvidia",
  selectors: {
    bodySelectors: [
      "article .entry-content",
      ".entry-content",
      "article",
      "main",
    ],
    titleSuffix: /\s*\|\s*NVIDIA\s+Technical\s+Blog\s*$/,
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
