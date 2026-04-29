/**
 * sspai.com (少数派) fetcher — server-rendered Vue.js pages with full
 * content in HTML; plain curl is enough.
 */

import { execFileSync } from "node:child_process";

export interface SspaiRaw {
  html: string;
  finalUrl: string;
  error?: string;
}

export function fetchSspai(url: string): SspaiRaw {
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
      error: `fetchSspai: ${e instanceof Error ? e.message : e}`,
    };
  }
}
