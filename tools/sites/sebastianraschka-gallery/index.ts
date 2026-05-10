/**
 * sebastianraschka.com/llm-architecture-gallery/ site module.
 *
 * The gallery page is a CATALOG shape (§5e.i): a flat grid of 50+
 * `<article class="llm-architecture-overview__card">` elements, each with
 * structured `data-compare-*` attributes + a fact-grid `<dl>` + meta-link
 * row + figure image. The page is server-rendered — plain curl returns
 * the full DOM, no browser-eval needed.
 *
 * Output is one section per architecture with image + summary blockquote
 * + fact table + resource links + `---` separator. The interactive
 * "Architecture diff tool" `<select>` block is intentionally dropped (it
 * has no static value).
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { Site } from "../_shared/types.ts";
import { fetchRaschkaGallery } from "./fetcher.ts";
import { convertRaschkaGallery } from "./converter.ts";
import { downloadImage } from "../../fetch-raw.ts";
import { makeStub } from "../_shared/stub.ts";
import { hostOf } from "../../shared/url-helpers.ts";

function pathOf(url: string): string {
  try { return new URL(url).pathname; }
  catch { return ""; }
}

export const site: Site = {
  name: "sebastianraschka-gallery",
  match: (url) =>
    hostOf(url) === "sebastianraschka.com" &&
    pathOf(url).startsWith("/llm-architecture-gallery"),
  fetch: (url, opts) => {
    mkdirSync(opts.slugDir, { recursive: true });
    mkdirSync(join(opts.slugDir, "images"), { recursive: true });

    const r = fetchRaschkaGallery(url);
    if (r.error || !r.html) {
      return stubResult(url, r.error || "empty HTML response");
    }

    const conv = convertRaschkaGallery({ html: r.html, url });

    if (conv.stats.cards === 0) {
      return stubResult(url, "no architecture cards found in DOM");
    }

    // Download all card figures via curl into slugDir/images/.
    const images: string[] = [];
    let imgFailed = 0;
    for (const dl of conv.imagesToDownload) {
      const dest = join(opts.slugDir, dl.localFilename);
      const bytes = downloadImage(dl.remoteUrl, dest);
      if (bytes > 0) images.push(dl.localFilename);
      else imgFailed++;
    }

    const title = "LLM Architecture Gallery";
    const markdown =
      `# ${title}\n\n` +
      `> 原文链接: ${url}\n\n` +
      `---\n\n` +
      conv.body;

    const flags: string[] = imgFailed > 0 ? ["raschka-gallery-image-download-partial"] : [];
    const notes: string[] = [
      `raschka-gallery: ${conv.stats.cards} architecture card(s), ` +
      `${images.length}/${conv.imagesToDownload.length} image(s) downloaded` +
      (imgFailed > 0 ? ` (${imgFailed} failed)` : ""),
    ];

    return {
      markdown,
      title,
      images,
      metadata: {
        source: "raschka-gallery",
        title,
        cards: conv.stats.cards,
        images_total: conv.imagesToDownload.length,
        images_downloaded: images.length,
        images_failed: imgFailed,
      },
      flags,
      notes,
    };
  },
};

function stubResult(url: string, reason: string, errorDetail?: string) {
  return makeStub({
    url, module: "raschka-gallery", kind: "fetch-failed",
    title: "LLM Architecture Gallery (fetch failed)",
    summary: reason,
    errorDetail,
  });
}
