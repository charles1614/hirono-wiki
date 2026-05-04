/**
 * blog.csdn.net — CSDN tech blog (Chinese). Server-rendered HTML with
 * the post body inside `<div id="content_views">` or
 * `<article class="baidu_pl">`. Heavy footer chrome (推荐文章 /
 * 相关推荐 / 评论) needs scoped removal.
 */

import { makeArticleSite } from "../_shared/article-site-factory.ts";

export const { site, testHooks } = makeArticleSite({
  name: "blog-csdn",
  hosts: ["blog.csdn.net"],
  converterName: "convertBlogCsdn",
  selectors: {
    bodySelectors: ["#content_views", "article.baidu_pl", "article", "main"],
    titleSuffix: /\s*[-_|]\s*CSDN(?:博客)?\s*$/,
    dropSelectors: [
      ".article-info-box",
      ".article-bar-bottom",
      ".operating",
      ".recommend-box",
      ".recommend-right",
      ".comment-box",
      ".csdn-side-toolbar",
      ".more-toolbox",
      ".vip-recommend",
      ".meau-style",
      "nav",
      "footer",
    ],
    imagePrefix: "blog-csdn",
  },
});
