/**
 * blog.google — Google's official corporate blog. Server-rendered HTML
 * with `<article class="uni-blog-landing">` (landing) or `<article>`
 * (post). Body content lives inside `<div class="article-body">`.
 */

import { makeArticleSite } from "../_shared/article-site-factory.ts";

export const { site, testHooks } = makeArticleSite({
  name: "blog-google",
  hosts: ["blog.google"],
  converterName: "convertBlogGoogle",
  selectors: {
    bodySelectors: ["article .article-body", ".article-body", "article", "main"],
    titleSuffix: /\s*\|\s*Google\s*$/,
    dropSelectors: [
      ".article-share__title",
      ".copy-link__dialog",
      ".uni-blog-landing__nav",
      ".article-related-posts",
      ".author-bio",
      "nav",
      "footer",
    ],
    imagePrefix: "blog-google",
  },
});
