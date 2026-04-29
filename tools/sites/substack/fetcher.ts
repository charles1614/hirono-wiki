/**
 * Substack fetcher.
 *
 * Substack pages are server-rendered: a plain `curl` returns the full
 * article body inside `<div class="available-content">` (or its inner
 * `<div class="body markup">`). No browser-eval needed, which makes the
 * fetcher fast + cache-friendly + deterministic.
 *
 * Cloudflare in front of substack requires a real Accept header — a
 * bare wildcard returns HTTP 406. Send a browser-shaped Accept and a
 * normal User-Agent.
 */

import { execFileSync } from "node:child_process";

export interface SubstackRaw {
  html: string;
  finalUrl: string;
  error?: string;
}

export function fetchSubstack(url: string): SubstackRaw {
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
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );
    return { html, finalUrl: url };
  } catch (e) {
    return {
      html: "",
      finalUrl: url,
      error: `fetchSubstack: ${e instanceof Error ? e.message : e}`,
    };
  }
}
