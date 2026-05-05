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
import { site as intuitionlabs } from "./intuitionlabs/index.ts";
import { site as sspai } from "./sspai/index.ts";
import { site as aleksagordic } from "./aleksagordic/index.ts";
import { site as blogGoogle } from "./blog-google/index.ts";
import { site as zeroOneMe } from "./01-me/index.ts";
import { site as blogCsdn } from "./blog-csdn/index.ts";
import { site as developerNvidia } from "./developer-nvidia/index.ts";
import { site as docsNvidia } from "./docs-nvidia/index.ts";
import { site as lmsys } from "./lmsys/index.ts";
import { site as sohu } from "./sohu/index.ts";
import { site as huggingface } from "./huggingface/index.ts";
import { site as qwenlmGithubIo } from "./qwenlm-github-io/index.ts";
import { site as anthropic } from "./anthropic/index.ts";
import { site as readthedocs } from "./readthedocs/index.ts";
import { site as feishu } from "./feishu/index.ts";
import { site as defaultSite } from "./_default/index.ts";

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
  // intuitionlabs.ai: Tailwind-typography articles with stable
  // `<div class="prose">` body container.
  intuitionlabs,
  // sspai.com (少数派): WangEditor-content articles with stable
  // `<div class="article__main__content">` body container.
  sspai,
  // aleksagordic.com: Next.js + Tailwind .prose blog (same shape as
  // intuitionlabs).
  aleksagordic,
  // The remaining article-shape hosts use the shared article-site
  // factory (`_shared/article-site-factory.ts`) — one config per host.
  // Plain curl + JSDOM body extraction + standard chrome stripping.
  blogGoogle,
  zeroOneMe,
  blogCsdn,
  developerNvidia,
  docsNvidia,
  lmsys,
  sohu,
  // huggingface.co/blog: pulls clean markdown from
  // raw.githubusercontent.com/huggingface/blog (the public mirror).
  // Path-filtered — only `/blog/<slug>` URLs go through this module.
  huggingface,
  // qwenlm.github.io: Qwen team's research blog (Hugo on GitHub Pages).
  // qwen.ai itself is an SPA shell; the actual blog content lives here.
  qwenlmGithubIo,
  // anthropic.com: blog and product pages. Replaces inline SVG figures
  // with a placeholder paragraph at the DOM level, avoiding the
  // character-per-line "explosion" the legacy post-processor patched.
  anthropic,
  // *.readthedocs.io / *.readthedocs.org: Sphinx-built docs. Wildcard
  // host pattern. Strips the `<a class="headerlink">` chrome each
  // heading gets in the default Sphinx theme.
  readthedocs,
  // *.feishu.cn: auth-gated wiki/docs. Stub-only — emits a stub with
  // lark-hirono fetch instructions. No fetch attempted.
  feishu,
  // CATCH-ALL: must be LAST. Fields any URL no host-specific module
  // claimed. Plain curl + JSDOM with permissive selectors; emits
  // `intentional-stub` if extraction returns < 200 chars (typical
  // SPA shell). URLs that consistently land here with stub flags
  // are candidates for promotion to a dedicated site module.
  defaultSite,
];

/**
 * Resolve a URL to its site module. Routing is **total** — the catch-all
 * `_default` site module is registered last with `match: () => true`,
 * so this never returns null. Callers can rely on the non-null result
 * unconditionally.
 */
export function routeSite(url: string): Site {
  for (const s of SITES) {
    if (s.match(url)) return s;
  }
  // Unreachable in practice (the catch-all matches everything), but the
  // explicit fallback keeps the function total even if someone reorders
  // the array and accidentally drops the default last.
  return defaultSite;
}
