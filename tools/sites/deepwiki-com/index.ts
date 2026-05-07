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

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

export const site: Site = {
  name: "deepwiki-com",
  match: (url) => hostOf(url) === "deepwiki.com",
  fetch: (url, opts) => fetchDeepwiki(url, opts),
};

function fetchDeepwiki(url: string, opts: { slugDir: string; titleHint?: string }) {
  mkdirSync(opts.slugDir, { recursive: true });

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
