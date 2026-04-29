/**
 * arxiv.org fetcher — abstract page is server-rendered static HTML; a
 * plain `curl` returns the full DOM. No browser-eval needed.
 *
 * Supports `/abs/<id>[v<N>]` URLs. Other paths (/pdf/, /html/, /list/,
 * /search/) are out of scope — those would need different converters.
 */

import { execFileSync } from "node:child_process";

export interface ArxivRaw {
  html: string;
  finalUrl: string;
  error?: string;
}

export function fetchArxiv(url: string): ArxivRaw {
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
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
    );
    return { html, finalUrl: url };
  } catch (e) {
    return {
      html: "",
      finalUrl: url,
      error: `fetchArxiv: ${e instanceof Error ? e.message : e}`,
    };
  }
}
