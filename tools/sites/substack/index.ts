/**
 * Substack site module — covers the substack engine across its CNAMEs.
 *
 * Matches substack-hosted hosts:
 *   - `*.substack.com` (the canonical engine)
 *   - `magazine.sebastianraschka.com` (Ahead of AI / Sebastian Raschka)
 *   - `newsletter.semianalysis.com` (SemiAnalysis)
 *
 * Substack pages are server-rendered: a plain `curl` returns the article
 * body inside `<div class="available-content">`. No browser-eval needed.
 *
 * Per the universal pattern (CLAUDE.md §5a), we own the full pipeline:
 * curl → jsdom → turndown via shared generic-converter → substack-specific
 * cleanups in `converter.ts`. Replaces the legacy `substackReformat`
 * post-processor for matched URLs.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { Site } from "../_shared/types.ts";
import { fetchSubstack } from "./fetcher.ts";
import { convertSubstack } from "./converter.ts";
import { downloadImage } from "../../fetch-raw.ts";

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

export function isSubstackHost(host: string): boolean {
  if (!host) return false;
  if (/(?:^|\.)substack\.com$/i.test(host)) return true;
  if (host === "magazine.sebastianraschka.com") return true;
  if (host === "newsletter.semianalysis.com") return true;
  return false;
}

export const site: Site = {
  name: "substack",
  match: (url) => isSubstackHost(hostOf(url)),
  fetch: (url, opts) => {
    mkdirSync(opts.slugDir, { recursive: true });

    const r = fetchSubstack(url);
    if (r.error || !r.html) {
      return stubResult(url, r.error || "empty HTML response");
    }

    const conv = convertSubstack({ html: r.html, url });

    if (!conv.markdown || conv.stats.bodyChars < 200) {
      return stubResult(url, `substack body extraction empty/too small (${conv.stats.bodyChars} chars)`);
    }

    // Download all article images via curl into slugDir.
    const images: string[] = [];
    let imgFailed = 0;
    for (const dl of conv.imagesToDownload) {
      const dest = join(opts.slugDir, dl.localFilename);
      const bytes = downloadImage(dl.remoteUrl, dest);
      if (bytes > 0) images.push(dl.localFilename);
      else imgFailed++;
    }

    const flags: string[] = imgFailed > 0 ? ["substack-image-download-partial"] : [];
    const notes: string[] = [
      `substack: ${conv.stats.bodyChars} body chars, ` +
      `${conv.stats.headerChromeStripped} header chrome line(s) stripped, ` +
      `${conv.stats.cardsCollapsed} related-post card(s) collapsed, ` +
      `${images.length}/${conv.imagesToDownload.length} image(s) downloaded` +
      (imgFailed > 0 ? ` (${imgFailed} failed)` : ""),
    ];

    return {
      markdown: conv.markdown,
      title: conv.metadata.title || undefined,
      images,
      metadata: {
        source: "substack",
        title: conv.metadata.title,
        author: conv.metadata.author,
        published_at: conv.metadata.publishedAt,
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
      `# Substack post: ${url}\n\n` +
      `> 原文链接: ${url}\n\n` +
      `---\n\n` +
      `*This entry is a metadata stub. ${reason}*\n`,
    images: [],
    metadata: { source: "substack-stub", reason },
    flags: ["intentional-stub", "substack-fetch-failed"],
    notes: [`substack: stub emitted — ${reason}`],
  };
}
