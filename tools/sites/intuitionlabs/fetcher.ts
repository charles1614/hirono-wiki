/**
 * intuitionlabs.ai fetcher — Next.js SSR pages return full HTML via plain
 * curl; no browser-eval needed.
 */

import { execFileSync } from "node:child_process";

export interface IntuitionlabsRaw {
  html: string;
  finalUrl: string;
  error?: string;
}

export function fetchIntuitionlabs(url: string): IntuitionlabsRaw {
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
      error: `fetchIntuitionlabs: ${e instanceof Error ? e.message : e}`,
    };
  }
}
