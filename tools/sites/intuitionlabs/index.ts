/**
 * intuitionlabs.ai site module — articles at `/articles/<slug>` are
 * Tailwind-typography pages with stable `<div class="prose">` body
 * containers. Replaces the legacy generic-converter fallback which
 * captured nav chrome, tag chains, and image-card metadata as content.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { Site } from "../_shared/types.ts";
import { fetchIntuitionlabs } from "./fetcher.ts";
import { renderPdfFromUrl } from "../_default/pdf-render.ts";
import { convertIntuitionlabs } from "./converter.ts";
import { downloadImage } from "../../fetch-raw.ts";
import { makeStub } from "../_shared/stub.ts";

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

export const site: Site = {
  name: "intuitionlabs",
  match: (url) => hostOf(url) === "intuitionlabs.ai",
  fetch: (url, opts) => {
    mkdirSync(opts.slugDir, { recursive: true });

    // intuitionlabs.ai/pdfs/<file>.pdf → delegate to the PDF renderer
    // (P-36) instead of trying to extract HTML. Any URL with a .pdf
    // path matches; the renderer handles fetching + render + stub on
    // failure.
    if (/\.pdf(?:[?#]|$)/i.test(url)) {
      const slug = opts.slugDir.split("/").filter(Boolean).pop() ?? "intuitionlabs-pdf";
      return renderPdfFromUrl({ url, slugDir: opts.slugDir, slug });
    }

    const r = fetchIntuitionlabs(url);
    if (r.error || !r.html) {
      return stubResult(url, r.error || "empty HTML response");
    }
    const conv = convertIntuitionlabs({ html: r.html, url });
    if (conv.stats.bodyChars < 200) {
      return stubResult(url, `intuitionlabs body empty/too small (${conv.stats.bodyChars} chars)`);
    }

    const images: string[] = [];
    let imgFailed = 0;
    for (const dl of conv.imagesToDownload) {
      const dest = join(opts.slugDir, dl.localFilename);
      const bytes = downloadImage(dl.remoteUrl, dest);
      if (bytes > 0) images.push(dl.localFilename);
      else imgFailed++;
    }

    const flags: string[] = imgFailed > 0 ? ["intuitionlabs-image-download-partial"] : [];
    return {
      markdown: conv.markdown,
      title: conv.metadata.title,
      images,
      metadata: {
        source: "intuitionlabs",
        title: conv.metadata.title,
        description: conv.metadata.description,
        published_at: conv.metadata.publishedAt,
        stats: conv.stats,
      },
      flags,
      notes: [
        `intuitionlabs: ${conv.stats.bodyChars} body chars, ` +
        `${images.length}/${conv.imagesToDownload.length} image(s) downloaded` +
        (imgFailed > 0 ? ` (${imgFailed} failed)` : ""),
      ],
    };
  },
};

function stubResult(url: string, reason: string, errorDetail?: string) {
  return makeStub({
    url, module: "intuitionlabs", kind: "fetch-failed",
    title: "IntuitionLabs article (fetch failed)",
    summary: reason,
    errorDetail,
  });
}
