/**
 * aleksagordic.com (Aleksa Gordić's blog) — Next.js + Tailwind .prose
 * articles. Same shape as intuitionlabs / qwen blogs.
 */

import { makeArticleSite } from "../_shared/article-site-factory.ts";

const built = makeArticleSite({
  name: "aleksagordic",
  hosts: ["aleksagordic.com"],
  converterName: "convertAleksagordic",
  selectors: {
    bodySelectors: [".prose", "article", "main"],
    titleSuffix: /\s*-\s*Aleksa\s+Gordić\s*$/,
    demoteH1: true,
    imagePrefix: "aleksagordic",
  },
});

export const { site, testHooks } = built;
