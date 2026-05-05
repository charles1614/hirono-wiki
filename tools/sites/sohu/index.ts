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
      // Comment widgets — sohu's "我来说两句" / 评论 system. The
      // `back-comment*` and `right-comment*` containers carry the
      // comment list, reply boxes, and the publish-comment form.
      "[class*='back-comment']",
      "[class*='right-comment']",
      "[class*='comment-item']",
      "[class*='comment-box']",
      "[class*='comment-publish']",
      "[class*='comment-input']",
      // Login form — sohu injects a phone-login modal at the article
      // tail. Scope on common login class fragments + the wrapping
      // form (`### 登录` heading + verification-code inputs).
      "[class*='login']",
      "[class*='passport']",
      // Bottom footer / nav rail (`返回搜狐, 查看更多`, `回顶部`,
      // `意见反馈`, `回首页`). Sohu uses `.sidebar-box` / `.side-layer`
      // for the floating bottom-right nav widget.
      ".sidebar-box",
      ".side-layer",
      ".article-back",
      ".back-top",
      ".back-home",
      ".back-comment-foot",
      ".feedback",
      "nav",
      "footer",
    ],
    imagePrefix: "sohu",
  },
});
