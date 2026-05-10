/**
 * deepwiki.com — the official hosted DeepWiki service.
 *
 * Independent of `wiki.litenext.digital` — different operator, separate
 * uptime, separate failure modes, no shared code. The
 * `hirono raindrop check` dispatch report labels them separately so
 * per-operator issues stay visible.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { Site } from "../_shared/types.ts";
import { extractDeepwikiComContent } from "./fetcher.ts";
import { convertDeepwikiComHtml } from "./converter.ts";
import { downloadImage } from "../../fetch-raw.ts";
import { makeStub } from "../_shared/stub.ts";
import { harvestServiceCard } from "../_shared/service-card.ts";
import { hostOf } from "../../shared/url-helpers.ts";

export const site: Site = {
  name: "deepwiki-com",
  match: (url) => hostOf(url) === "deepwiki.com",
  fetch: (url, opts) => fetchDeepwiki(url, opts),
};

/**
 * deepwiki.com's bare-domain landing (`/`) is a marketing/search UI —
 * "Which repo would you like to understand?" + a "What is DeepWiki?"
 * blurb. It has substantive HTML (~900KB) but the bookmark intent is
 * the service, not the page. Emit an app-only stub so the slug
 * classifies as `intentional-stub-app-only` instead of going through
 * the article-extraction path (which would either fail or save the
 * marketing prose as if it were content).
 */
function isLandingPage(url: string): boolean {
  try {
    const u = new URL(url);
    return /^\/?$/.test(u.pathname);
  } catch { return false; }
}

function fetchDeepwiki(url: string, opts: { slugDir: string; titleHint?: string }) {
  mkdirSync(opts.slugDir, { recursive: true });

  if (isLandingPage(url)) {
    const card = harvestServiceCard(url);
    return makeStub({
      url,
      module: "deepwiki-com",
      kind: "landing",
      title: "DeepWiki — service landing page",
      summary: "deepwiki.com bare-domain landing — interactive search/marketing surface, no per-page content to archive",
      advice:
        "The bookmark URL is the deepwiki.com homepage (search + marketing copy). " +
        "If you wanted a specific repo's wiki, the URL pattern is " +
        "`https://deepwiki.com/<owner>/<repo>` — re-bookmark with that path. " +
        "If you bookmarked the homepage on purpose, accept the stub.",
      bodyExtra: card?.markdown,
    });
  }

  const x = extractDeepwikiComContent(url);
  if (x.error) {
    return stubResult(url, `deepwiki browser extraction failed: ${x.error.slice(0, 160)}`);
  }
  if (!x.contentHtml || x.contentHtml.length < 200) {
    return stubResult(url, `deepwiki .prose container empty or too small (${x.contentHtml.length} chars)`);
  }

  const conv = convertDeepwikiComHtml(x.contentHtml, x.mermaidSources, {
    title: x.title,
    url,
  });

  const images: string[] = [];
  let imgFailed = 0;
  for (const dl of conv.imagesToDownload) {
    const dest = join(opts.slugDir, dl.localFilename);
    const bytes = downloadImage(dl.remoteUrl, dest);
    if (bytes > 0) images.push(dl.localFilename);
    else imgFailed++;
  }

  const flags: string[] = [];
  if (imgFailed > 0) flags.push("deepwiki-image-download-partial");
  if (conv.stats.mermaidPlaced < conv.stats.mermaidExpected) {
    flags.push("deepwiki-mermaid-splice-incomplete");
  }

  const notes: string[] = [
    `deepwiki-com: ${conv.stats.mermaidPlaced}/${conv.stats.mermaidExpected} mermaid block(s) embedded, ${conv.stats.tables} table(s), ${conv.stats.codeFences} code fence(s), ${images.length}/${conv.imagesToDownload.length} image(s) downloaded`,
  ];
  if (imgFailed > 0) notes.push(`deepwiki-com: ${imgFailed} image download(s) failed`);

  return {
    markdown: conv.markdown,
    title: conv.metadata.title || undefined,
    images,
    metadata: {
      source: "deepwiki-com-raw-html",
      host: hostOf(url),
      title: conv.metadata.title,
      stats: conv.stats,
    },
    flags,
    notes,
  };
}

function stubResult(url: string, reason: string, errorDetail?: string) {
  return makeStub({
    url, module: "deepwiki-com", kind: "fetch-failed",
    title: "DeepWiki.com page (fetch failed)",
    summary: reason,
    errorDetail,
  });
}
