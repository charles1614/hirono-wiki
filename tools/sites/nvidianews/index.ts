/**
 * nvidianews.nvidia.com — NVIDIA's press-release site.
 *
 * The page DOM has a clean `.article` wrapper containing `.article-title`,
 * `.article-subtitle`, `.article-date`, `.article-hero` (figure) and
 * `.article-body`. Generic web-read picks the wrong "main content" div
 * (a sidebar that lists OTHER press releases) and produces ~400 chars of
 * noise — this module targets the right selector explicitly.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { Site } from "../_shared/types.ts";
import { extractNvidianewsContent } from "./fetcher.ts";
import { convertNvidianewsHtml } from "./converter.ts";
import { downloadImage } from "../../fetch-raw.ts";
import { makeStub } from "../_shared/stub.ts";

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

export const site: Site = {
  name: "nvidianews",
  match: (url) => hostOf(url) === "nvidianews.nvidia.com",
  fetch: (url, opts) => {
    mkdirSync(opts.slugDir, { recursive: true });

    const x = extractNvidianewsContent(url);
    if (x.error) {
      return stubResult(url, `nvidianews extraction failed: ${x.error.slice(0, 160)}`);
    }
    if (!x.bodyHtml || x.bodyHtml.length < 200) {
      return stubResult(url, `nvidianews .article-body empty or too small (${x.bodyHtml.length} chars)`);
    }

    const conv = convertNvidianewsHtml({
      title: x.title,
      subtitle: x.subtitle,
      date: x.date,
      bodyHtml: x.bodyHtml,
      heroImageUrl: x.heroImageUrl,
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

    const flags: string[] = imgFailed > 0 ? ["nvidianews-image-download-partial"] : [];
    const notes: string[] = [
      `nvidianews: ${conv.stats.paragraphs} paragraph(s), ${conv.stats.codeFences} code fence(s), ${images.length}/${conv.imagesToDownload.length} image(s) downloaded`,
    ];
    if (imgFailed > 0) notes.push(`nvidianews: ${imgFailed} image download(s) failed`);

    return {
      markdown: conv.markdown,
      title: conv.metadata.title || undefined,
      images,
      metadata: {
        source: "nvidianews-raw-html",
        ...conv.metadata,
        stats: conv.stats,
      },
      flags,
      notes,
    };
  },
};

function stubResult(url: string, reason: string, errorDetail?: string) {
  return makeStub({
    url, module: "nvidianews", kind: "fetch-failed",
    title: "NVIDIA Newsroom (fetch failed)",
    summary: reason,
    errorDetail,
  });
}
