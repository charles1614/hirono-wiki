/**
 * sspai.com (少数派) site module — long-form posts at `/post/<id>`.
 *
 * Replaces the legacy generic-converter fallback which captured author
 * cards, action bar (like/comment/share), trailing recommendations as
 * content. The site module extracts just `<div class="article__main__content">`
 * and substitutes full-resolution image URLs from `data-original=` over
 * the lower-res transforms in `src=`.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { Site } from "../_shared/types.ts";
import { fetchSspai } from "./fetcher.ts";
import { convertSspai } from "./converter.ts";
import { downloadImage } from "../../fetch-raw.ts";
import { makeStub } from "../_shared/stub.ts";
import { hostOf } from "../../shared/url-helpers.ts";

export const site: Site = {
  name: "sspai",
  match: (url) => hostOf(url) === "sspai.com",
  fetch: (url, opts) => {
    mkdirSync(opts.slugDir, { recursive: true });

    const r = fetchSspai(url);
    if (r.error || !r.html) {
      return stubResult(url, r.error || "empty HTML response");
    }
    const conv = convertSspai({ html: r.html, url });
    if (conv.stats.bodyChars < 200) {
      return stubResult(url, `sspai body empty/too small (${conv.stats.bodyChars} chars)`);
    }

    const images: string[] = [];
    let imgFailed = 0;
    for (const dl of conv.imagesToDownload) {
      const dest = join(opts.slugDir, dl.localFilename);
      // sspai's CDN serves images on cdnfile.sspai.com — these used to
      // need a Referer header to avoid 403s in earlier sessions, so
      // pass the originUrl as referer.
      const bytes = downloadImage(dl.remoteUrl, dest, undefined, url);
      if (bytes > 0) images.push(dl.localFilename);
      else imgFailed++;
    }

    const flags: string[] = imgFailed > 0 ? ["sspai-image-download-partial"] : [];
    return {
      markdown: conv.markdown,
      title: conv.metadata.title,
      images,
      metadata: {
        source: "sspai",
        title: conv.metadata.title,
        published_at: conv.metadata.publishedAt,
        stats: conv.stats,
      },
      flags,
      notes: [
        `sspai: ${conv.stats.bodyChars} body chars, ` +
        `${images.length}/${conv.imagesToDownload.length} image(s) downloaded` +
        (imgFailed > 0 ? ` (${imgFailed} failed)` : ""),
      ],
    };
  },
};

function stubResult(url: string, reason: string, errorDetail?: string) {
  return makeStub({
    url, module: "sspai", kind: "fetch-failed",
    title: "sspai post (fetch failed)",
    summary: reason,
    errorDetail,
  });
}
