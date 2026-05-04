/**
 * 01.me — Hexo-themed personal blog. Server-rendered HTML with the post
 * body inside `<div class="content">` (Hexo's default Next theme) and an
 * `<div class="entry-show-title">` H1. No SPA hydration.
 */

import { makeArticleSite } from "../_shared/article-site-factory.ts";

export const { site, testHooks } = makeArticleSite({
  name: "01-me",
  hosts: ["01.me"],
  converterName: "convert01Me",
  selectors: {
    bodySelectors: ["article .content", ".post-body", ".content", "article", "main"],
    titleSuffix: /\s*[-|·]\s*01\.me\s*$/,
    dropSelectors: [
      ".post-nav",
      ".post-copyright",
      ".post-related",
      ".comments",
      ".post-toc",
      "nav",
      "footer",
    ],
    imagePrefix: "01-me",
  },
});
