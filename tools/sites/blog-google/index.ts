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
  },
});
