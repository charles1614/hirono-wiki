/**
 * anthropic.com — Anthropic's blog and product pages. Server-rendered
 * HTML with stable selectors. The historical defect this module fixes:
 * the blog's marketing pages embed `<svg>` figures whose `<text>`
 * children turndown would otherwise convert to a character-per-line
 * "explosion" in the markdown:
 *
 *     How
 *
 *     Anthropic
 *
 *     teams
 *
 *     ...
 *
 * `replaceSelectors` swaps every `<svg>` element for a single
 * placeholder paragraph BEFORE turndown sees the body, eliminating
 * the explosion at the DOM level rather than patching it up downstream.
 */

import { makeArticleSite } from "../_shared/article-site-factory.ts";

export const { site, testHooks } = makeArticleSite({
  name: "anthropic",
  hosts: ["anthropic.com"],
  converterName: "convertAnthropic",
  selectors: {
    bodySelectors: [
      "article",
      "main",
      ".post-body",
      ".article-body",
      "[role='main']",
    ],
    titleSuffix: /\s*[\\\|]\s*Anthropic\s*$/,
    dropSelectors: [
      "nav",
      "footer",
      "aside",
      "header",
      ".nav",
      ".navigation",
      ".breadcrumbs",
      ".share",
      ".social-share",
      ".related",
      ".related-posts",
      ".author-bio",
      ".tags",
      ".meta",
      ".byline",
      ".cta",
      ".newsletter",
    ],
    replaceSelectors: [
      { selector: "svg", replacementText: "[SVG figure — see source for visual content]" },
    ],
    imagePrefix: "anthropic",
  },
});
