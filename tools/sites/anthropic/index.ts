/**
 * anthropic.com — Anthropic's blog and product pages. Server-rendered
 * Next.js HTML. Two non-trivial defects this module fixes:
 *
 * 1. Inline `<svg>` elements (logos, decorative arrows, chevrons)
 *    flatten through turndown into character-per-line "explosions"
 *    (`<text>` children) or — when adjacent to a real `<img>` — emit a
 *    redundant placeholder. We DROP them at the DOM level via
 *    `dropSelectors` rather than leaving any text behind.
 *
 * 2. Every blog post has a "Read more" related-articles rail at the
 *    bottom inside `.LinkGrid-module-scss-module__*__root` (Next.js
 *    CSS-modules-hashed class). Turndown converts those links into
 *    multi-line link wrappers around the inline arrow icons —
 *    literally the `no-multi-line-link-wrappers` defect from
 *    CLAUDE.md. Drop the entire grid via class-prefix selector.
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
      // Anthropic uses Next.js with hashed CSS-module class names. The
      // related-articles "Read more" rail at the bottom of every post
      // is inside `.LinkGrid-module-scss-module__*__root`. Drop it
      // (otherwise we get multi-line link wrappers around SVG arrow
      // icons — see CLAUDE.md "no-multi-line-link-wrappers").
      "[class*='LinkGrid']",
      "[class*='ContactCard']",
      // Inline SVGs are decorative on anthropic (logos, arrows, chevrons).
      // Drop them BEFORE turndown — leaving them produces character-per-
      // line text explosions or redundant placeholder paragraphs next to
      // the actual `<img>` that already carries the visual content.
      "svg",
    ],
    imagePrefix: "anthropic",
  },
});
