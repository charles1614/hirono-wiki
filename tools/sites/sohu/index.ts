/**
 * sohu.com — Chinese news article host (mass-media CMS). Body inside
 * `<article class="article">` or `<div class="article">`. Heavy footer
 * chrome (recommended-articles, comment widgets, hot-list rails).
 */

import { makeArticleSite } from "../_shared/article-site-factory.ts";

export const { site, testHooks } = makeArticleSite({
  name: "sohu",
  hosts: ["sohu.com", "www.sohu.com"],
  converterName: "convertSohu",
  selectors: {
    bodySelectors: [
      "article.article",
      "div.article",
      "#mp-editor",
      "article",
      "main",
    ],
    titleSuffix: /\s*[-_]\s*搜狐(?:新闻|网|号)?\s*$/,
    dropSelectors: [
      ".article-info",
      ".article-source",
      ".original-source",
      ".article-share",
      ".user-info",
      ".article-news",
      ".article-recommend",
      ".article-comment",
      ".content-tools",
      ".content-tools-box",
      ".head-tools",
      ".god-article-bottom",
      ".side-bar",
      ".sidebar",
      ".hot-list",
      ".recommend",
      ".comment",
      ".article-tag",
      ".author-card",
      ".profile",
      "nav",
      "footer",
    ],
    imagePrefix: "sohu",
  },
});
