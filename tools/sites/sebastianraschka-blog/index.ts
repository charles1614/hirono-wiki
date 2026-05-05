/**
 * sebastianraschka.com — Sebastian Raschka's personal blog (excluding
 * the `/blog/.../llm-architecture-gallery/` path which is owned by
 * `tools/sites/sebastianraschka-gallery/`).
 *
 * Static HTML, server-rendered. Single article container. Strips the
 * usual newsletter / social-share / prev-next chrome at the DOM level
 * via dropSelectors instead of post-turndown line-pattern matching.
 *
 * Note: sebastianraschka.com is Cloudflare-fronted with mod_security;
 * the factory now uses a full Chrome UA + Accept-Language header by
 * default, which gets us past the gate.
 */

import { makeArticleSite } from "../_shared/article-site-factory.ts";

function isGalleryPath(url: string): boolean {
  try {
    return new URL(url).pathname.includes("/llm-architecture-gallery");
  } catch {
    return false;
  }
}

const built = makeArticleSite({
  name: "sebastianraschka-blog",
  hosts: ["sebastianraschka.com"],
  converterName: "convertSebastianraschkaBlog",
  selectors: {
    bodySelectors: [
      "article",
      "main",
      ".post-content",
      ".content",
      "[role='main']",
    ],
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
      ".newsletter",
      ".subscribe",
      ".follow",
      ".tags",
      ".tag-list",
      ".post-meta",
      ".post-navigation",
      ".pagination",
      ".prev-next",
    ],
    imagePrefix: "sebastianraschka",
  },
});

// The gallery sub-path is owned by tools/sites/sebastianraschka-gallery/
// (registered earlier in SITES[]). This module's match must NOT claim
// gallery URLs even though both share a hostname. Wrap the factory's
// match() with a path filter.
const factoryMatch = built.site.match;
export const site = {
  ...built.site,
  match: (url: string) => factoryMatch(url) && !isGalleryPath(url),
};
export const testHooks = built.testHooks;
