/**
 * sebastianraschka.com/llm-architecture-gallery/ fetcher.
 *
 * The page is server-rendered: every architecture card is an
 * `<article class="llm-architecture-overview__card">` with structured
 * `data-compare-*` attributes plus a `<dl class="…fact-grid">`. No
 * browser-eval needed; a plain HTTP GET returns the full content.
 *
 * Cloudflare requires a browser-shaped Accept header — a bare wildcard
 * Accept returns HTTP 406. Send `text/html,application/xhtml+xml,...`
 * to look like a real browser. One of the few hosts seen that strictly
 * content-negotiates.
 */

import { execFileSync } from "node:child_process";

export interface RaschkaGalleryRaw {
  html: string;
  finalUrl: string;
  error?: string;
}

export function fetchRaschkaGallery(url: string): RaschkaGalleryRaw {
  try {
    const html = execFileSync(
      "curl",
      [
        "-sfL",
        "--max-time", "30",
        "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9",
        url,
      ],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    return { html, finalUrl: url };
  } catch (e) {
    return {
      html: "",
      finalUrl: url,
      error: `fetchRaschkaGallery: ${e instanceof Error ? e.message : e}`,
    };
  }
}
