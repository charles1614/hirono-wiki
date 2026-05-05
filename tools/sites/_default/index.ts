/**
 * `_default` — catch-all site module. Registered LAST in `SITES[]` so
 * every host-specific module gets first pick; this one fields any URL
 * none of them claimed.
 *
 * Strategy: plain curl + JSDOM with permissive body selectors and a
 * generous chrome dropSelector list. If the extracted body is too small
 * (< 200 chars — typical SPA shell), emit an `intentional-stub` with
 * `default-curl-fallback-empty`. URLs that consistently land here with
 * stub flags are candidates for promotion to a dedicated site module.
 *
 * Replaces the legacy `case "web-read":` fallback path. The latter
 * consumed opencli's lossy markdown and patched it with a regex
 * post-processor pipeline; this module owns DOM-level extraction so
 * defects (over-escaped emoji, multi-line link wrappers, flattened
 * mermaid) are fixable in the converter rather than in downstream
 * patches that pile up over time.
 */

import { makeArticleSite } from "../_shared/article-site-factory.ts";

export const { site, testHooks } = makeArticleSite({
  name: "_default",
  hosts: [],
  matchAll: true,
  // Reference snapshots are captured against stable static blog posts on
  // hosts that don't have dedicated modules. Add more entries as the
  // catch-all gets exercised against more URL shapes in production.
  snapshotHosts: ["martinfowler.com"],
  converterName: "convertDefaultArticle",
  selectors: {
    bodySelectors: [
      "article",
      "main",
      "[role='main']",
      ".prose",
      ".post-content",
      ".article-body",
      ".entry-content",
      ".content",
    ],
    dropSelectors: [
      "nav",
      "footer",
      "aside",
      "header",
      ".nav",
      ".navigation",
      ".breadcrumb",
      ".breadcrumbs",
      ".share",
      ".share-buttons",
      ".social-share",
      ".social",
      ".related",
      ".related-posts",
      ".related-stories",
      ".comments",
      ".comment-section",
      ".cookie-banner",
      ".cookie-notice",
      ".sidebar",
      ".side-bar",
      ".author-bio",
      ".author-card",
      ".tags",
      ".tag-list",
      ".meta",
      ".byline",
      ".post-meta",
      ".post-navigation",
      ".pagination",
      ".paginav",
    ],
    imagePrefix: "default",
  },
});
