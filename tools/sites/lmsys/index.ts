/**
 * lmsys.org — academic blog (Hugo-rendered). Body lives in
 * `<div class="blog-post">` / `<div class="blog-post-content">`.
 */

import { makeArticleSite } from "../_shared/article-site-factory.ts";

export const { site, testHooks } = makeArticleSite({
  name: "lmsys",
  hosts: ["lmsys.org"],
  converterName: "convertLmsys",
  selectors: {
    bodySelectors: [".blog-post-content", ".blog-post", "article", "main"],
    titleSuffix: /\s*[-|]\s*LMSYS\s*(?:Org)?\s*$/,
    dropSelectors: [
      ".blog-post-meta",
      ".author-card",
      ".share",
      ".tags",
      ".related",
      ".post-navigation",
      ".comments",
      "nav",
      "footer",
    ],
    imagePrefix: "lmsys",
  },
});
