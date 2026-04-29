/**
 * Site router. Walks the registered sites and returns the first whose
 * `match(url)` returns true. The router has no per-site knowledge —
 * sites are self-describing via the contract in `_shared/types.ts`.
 *
 * Hosts not yet migrated to a site module fall through to the legacy
 * dispatch in `tools/fetch-raw.ts` (DISPATCH_RULES + per-adapter switch).
 * Each migration moves one host into `tools/sites/<host>/` and registers
 * it here; the legacy dispatch shrinks as a side effect.
 */

import type { Site } from "./_shared/types.ts";
import { site as xhs } from "./xhs/index.ts";
import { site as github } from "./github/index.ts";
import { site as zhihuArticle } from "./zhihu/index.ts";
import { site as weixin } from "./weixin/index.ts";
import { site as deepwikiLitenext } from "./deepwiki-litenext/index.ts";
import { site as deepwikiCom } from "./deepwiki-com/index.ts";
import { site as linuxDo } from "./linux-do/index.ts";
import { site as nvidianews } from "./nvidianews/index.ts";
import { site as epochAi } from "./epoch-ai/index.ts";
import { site as raschkaGallery } from "./sebastianraschka-gallery/index.ts";
import { site as substack } from "./substack/index.ts";
import { site as arxiv } from "./arxiv/index.ts";

export const SITES: readonly Site[] = [
  xhs,
  github,
  zhihuArticle,
  weixin,
  // deepwiki-litenext + deepwiki-com are independent operators of the
  // same DeepWiki software — registered as two separate Site entries
  // with their own copies of converter+fetcher (no shared code).
  deepwikiLitenext,
  deepwikiCom,
  linuxDo,
  nvidianews,
  // epoch.ai: data lives in CSV, not HTML — fetcher curls the dataset
  // and converter embeds top N rows as a markdown table.
  epochAi,
  // sebastianraschka.com/llm-architecture-gallery/: server-rendered
  // catalog of 50+ LLM architectures. Curl + jsdom; one section per
  // card with image + fact table. Matches a path prefix only — regular
  // sebastianraschka.com blog posts still go through the legacy path.
  raschkaGallery,
  // substack: covers *.substack.com + magazine.sebastianraschka.com +
  // newsletter.semianalysis.com. Pages are SSR — plain curl returns
  // `.available-content`. Replaces the legacy substackReformat
  // post-processor for matched URLs.
  substack,
  // arxiv: abstract pages (`/abs/<id>`) — server-rendered static HTML
  // with stable selectors (h1.title, .authors, blockquote.abstract,
  // .tablecell.subjects). Strips bibliographic chrome (BibTeX widget,
  // social bookmarks, browse navigation) and produces a clean §2
  // article-shape output.
  arxiv,
];

export function routeSite(url: string): Site | null {
  for (const s of SITES) {
    if (s.match(url)) return s;
  }
  return null;
}
