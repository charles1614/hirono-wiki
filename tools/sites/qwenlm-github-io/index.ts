/**
 * qwenlm.github.io — the Qwen team's research blog (Hugo on GitHub
 * Pages). Server-rendered HTML with stable selectors:
 *   - body: `<article class="post-single"> .post-content`
 *   - title: `<h1 class="post-title">` / `<title>`
 *
 * Note: `qwen.ai` itself is a JavaScript SPA (chat product shell);
 * the actual research blog content lives here. Bookmarks pointing at
 * qwen.ai blog routes are typically the public-facing entrypoint that
 * resolves to qwenlm.github.io content via JS hydration — we route
 * the github.io path directly through this module.
 */

import { makeArticleSite } from "../_shared/article-site-factory.ts";

export const { site, testHooks } = makeArticleSite({
  name: "qwenlm-github-io",
  hosts: ["qwenlm.github.io"],
  converterName: "convertQwenlmGithubIo",
  selectors: {
    bodySelectors: [
      ".post-content",
      "article.post-single",
      "article",
      "main",
    ],
    titleSuffix: /\s*\|\s*Qwen\s*$/,
    dropSelectors: [
      ".post-meta",
      ".post-tags",
      ".paginav",
      ".share-buttons",
      ".related-posts",
      "nav",
      "footer",
    ],
    imagePrefix: "qwenlm",
  },
});
