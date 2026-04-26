/**
 * wiki.litenext.digital — a self-hosted DeepWiki deployment.
 *
 * Different operator from `deepwiki.com`, but the two run the SAME
 * DeepWiki engine — same `.prose` container layout, same `.mermaid`
 * rendering, same selectors. Both modules import the shared
 * extraction + conversion code from `tools/sites/_shared/deepwiki-engine/`;
 * the only per-operator differences (mermaid extraction strategy:
 * `data-original-text` attribute on litenext vs hydration-script
 * regex on deepwiki.com) are handled inside the shared fetcher
 * automatically based on what the page actually exposes.
 *
 * Why two modules instead of one with a `match` for both hostnames:
 * they are operationally distinct sites — separate operators, separate
 * uptime, separate failure modes. The dispatch report
 * (`hirono raindrop check`) labels them separately so per-operator
 * issues stay visible.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { Site } from "../_shared/types.ts";
import { extractDeepwikiContent } from "../_shared/deepwiki-engine/fetcher.ts";
import { convertDeepwikiHtml } from "../_shared/deepwiki-engine/converter.ts";
import { downloadImage } from "../../fetch-raw.ts";

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

export const site: Site = {
  name: "deepwiki-litenext",
  match: (url) => hostOf(url) === "wiki.litenext.digital",
  fetch: (url, opts) => fetchDeepwiki(url, opts),
};

function fetchDeepwiki(url: string, opts: { slugDir: string; titleHint?: string }) {
  mkdirSync(opts.slugDir, { recursive: true });

  const x = extractDeepwikiContent(url);
  if (x.error) {
    return stubResult(url, `deepwiki browser extraction failed: ${x.error.slice(0, 160)}`);
  }
  if (!x.contentHtml || x.contentHtml.length < 200) {
    return stubResult(url, `deepwiki .prose container empty or too small (${x.contentHtml.length} chars)`);
  }

  const conv = convertDeepwikiHtml(x.contentHtml, x.mermaidSources, {
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
    `deepwiki-litenext: ${conv.stats.mermaidPlaced}/${conv.stats.mermaidExpected} mermaid block(s) embedded, ${conv.stats.tables} table(s), ${conv.stats.codeFences} code fence(s), ${images.length}/${conv.imagesToDownload.length} image(s) downloaded`,
  ];
  if (imgFailed > 0) notes.push(`deepwiki-litenext: ${imgFailed} image download(s) failed`);

  return {
    markdown: conv.markdown,
    title: conv.metadata.title || undefined,
    images,
    metadata: {
      source: "deepwiki-litenext-raw-html",
      host: hostOf(url),
      title: conv.metadata.title,
      stats: conv.stats,
    },
    flags,
    notes,
  };
}

function stubResult(url: string, reason: string) {
  return {
    markdown:
      `# DeepWiki (litenext) page: ${url}\n\n` +
      `> 原文链接: ${url}\n\n` +
      `---\n\n` +
      `*This entry is a metadata stub. ${reason}*\n`,
    images: [],
    metadata: { source: "deepwiki-litenext-stub", reason },
    flags: ["intentional-stub", "deepwiki-litenext-fetch-failed"],
    notes: [`deepwiki-litenext: stub emitted — ${reason}`],
  };
}
