/**
 * deepwiki site module — covers the two host variants of the same content
 * engine:
 *
 *   - wiki.litenext.digital   (data-original-text on `.mermaid` elements)
 *   - deepwiki.com            (mermaid sources buried in Next.js hydration scripts)
 *
 * Per the universal pattern (CLAUDE.md §5a, MIGRATION.md): no opencli
 * web-read. We open the page via opencli's browser session, wait for the
 * client-side render (mermaid + markdown hydration), then extract the
 * `.prose` container's outerHTML + the mermaid sources (in document order,
 * matched to rendered SVG count) in a single eval call. The converter then
 * walks the DOM, replaces mermaid placeholders with proper code fences, and
 * uses turndown for the rest.
 *
 * This replaces the legacy fetch-raw.ts splice pipeline that was layered on
 * top of opencli web-read's lossy markdown — extractDeepwikiMermaidSources,
 * extractDeepwikiTables, spliceDeepwikiMermaid, spliceDeepwikiTables — all
 * superseded by extracting the source HTML directly.
 */

import { mkdirSync } from "node:fs";

import type { Site } from "../_shared/types.ts";
import { extractDeepwikiContent } from "./fetcher.ts";
import { convertDeepwikiHtml } from "./converter.ts";
import { downloadImage } from "../../fetch-raw.ts";
import { join } from "node:path";

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

export const site: Site = {
  name: "deepwiki",
  match: (url) => {
    const h = hostOf(url);
    return h === "wiki.litenext.digital" || h === "deepwiki.com";
  },
  fetch: (url, opts) => {
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
      `deepwiki: ${conv.stats.mermaidPlaced}/${conv.stats.mermaidExpected} mermaid block(s) embedded, ${conv.stats.tables} table(s), ${conv.stats.codeFences} code fence(s), ${images.length}/${conv.imagesToDownload.length} image(s) downloaded`,
    ];
    if (imgFailed > 0) notes.push(`deepwiki: ${imgFailed} image download(s) failed`);

    return {
      markdown: conv.markdown,
      title: conv.metadata.title || undefined,
      images,
      metadata: {
        source: "deepwiki-raw-html",
        host: hostOf(url),
        title: conv.metadata.title,
        stats: conv.stats,
      },
      flags,
      notes,
    };
  },
};

function stubResult(url: string, reason: string) {
  return {
    markdown:
      `# DeepWiki page: ${url}\n\n` +
      `> 原文链接: ${url}\n\n` +
      `---\n\n` +
      `*This entry is a metadata stub. ${reason}*\n`,
    images: [],
    metadata: { source: "deepwiki-stub", reason },
    flags: ["intentional-stub", "deepwiki-fetch-failed"],
    notes: [`deepwiki: stub emitted — ${reason}`],
  };
}
