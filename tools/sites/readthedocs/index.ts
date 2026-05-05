/**
 * readthedocs.io / readthedocs.org — Sphinx-built documentation sites.
 * Wildcard hostnames: every project has its own subdomain
 * (`<project>.readthedocs.io`).
 *
 * Body selectors:
 *   - `.rst-content` (Read the Docs theme — most common)
 *   - `[itemprop=articleBody]` (alabaster theme)
 *   - `.document` (older Sphinx default)
 *
 * Strips the `<a class="headerlink">` button injected next to every
 * heading at the DOM level (these otherwise survived turndown as
 * `## Title[#](#title "Link to this heading")` chrome) plus the usual
 * Sphinx nav rails.
 */

import { makeArticleSite } from "../_shared/article-site-factory.ts";

export const { site, testHooks } = makeArticleSite({
  name: "readthedocs",
  hosts: [],
  hostPattern: /\.readthedocs\.(io|org)$/,
  // snapshots live under whatever subdomain we capture against; declare
  // the known ones for the coverage gate. Add more entries as new
  // readthedocs subdomains get tested.
  snapshotHosts: ["docs.readthedocs.io"],
  converterName: "convertReadthedocs",
  selectors: {
    bodySelectors: [
      ".rst-content",
      "[itemprop='articleBody']",
      ".document",
      "article",
      "main",
    ],
    dropSelectors: [
      // The `<a class="headerlink">` button that the Sphinx default theme
      // injects at the end of every heading. Pre-removal makes the
      // resulting markdown's `## Title` clean.
      ".headerlink",
      "a.headerlink",
      // Read the Docs theme nav rails / chrome
      ".wy-nav-side",
      ".wy-side-nav-search",
      ".wy-menu",
      ".rst-footer-buttons",
      ".rst-versions",
      ".wy-breadcrumbs",
      ".breadcrumbs",
      ".edit-link",
      "nav.wy-nav-top",
      "nav",
      "footer",
    ],
    imagePrefix: "readthedocs",
  },
});
