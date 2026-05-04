/**
 * docs.nvidia.com — Sphinx-rendered HTML documentation. Body lives in
 * `<div class="rst-content">` (Read-the-Docs theme) inside `<main>`.
 * Strips Sphinx nav rails and edit-link chrome.
 */

import { makeArticleSite } from "../_shared/article-site-factory.ts";

export const { site, testHooks } = makeArticleSite({
  name: "docs-nvidia",
  hosts: ["docs.nvidia.com"],
  converterName: "convertDocsNvidia",
  selectors: {
    bodySelectors: [
      "main .rst-content",
      "div[itemprop='articleBody']",
      ".rst-content",
      "article",
      "main",
    ],
    titleSuffix: /\s*[-—]\s*NVIDIA\s+Docs\s*$/,
    dropSelectors: [
      ".wy-nav-side",
      ".wy-side-nav-search",
      ".wy-menu",
      ".rst-footer-buttons",
      ".rst-versions",
      ".wy-breadcrumbs",
      ".breadcrumbs",
      ".edit-link",
      ".headerlink",
      "nav.wy-nav-top",
      "nav",
      "footer",
    ],
    imagePrefix: "docs-nvidia",
  },
});
