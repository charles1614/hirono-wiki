/**
 * Service-card harvest — for stub-emitting modules whose URL is a
 * service's bare-domain homepage / app shell.
 *
 * When the user bookmarks a tool's homepage (`https://deepwiki.com/`,
 * `https://qwen.ai/`, `https://feishu.cn/`, etc.), they typically
 * mean "remember this service exists" rather than "archive this page".
 * The page itself is interactive / marketing and doesn't have a
 * single article body to extract — the site module rightly emits a
 * stub. But the homepage's `<meta og:title>` + `<meta og:description>`
 * usually carry exactly the kind of one-paragraph "what does this
 * service do?" summary that gives the stub real archival value.
 *
 * Usage: pass the result's `markdown` field as `bodyExtra` on
 * `makeStub` so the harvested card renders between the `---` divider
 * and the operator-advice line.
 *
 * Best-effort. Returns `null` on any failure (network, no meta tags,
 * etc.) — the caller should fall through to its plain stub.
 */

import { execFileSync } from "node:child_process";

export interface ServiceCard {
  /** Markdown block ready to drop into `bodyExtra`. */
  markdown: string;
  /** Raw harvested fields, for diagnostics / metadata. */
  raw: { ogTitle: string; ogDescription: string; siteName: string };
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36";

export function harvestServiceCard(url: string): ServiceCard | null {
  let html = "";
  try {
    html = execFileSync(
      "curl",
      ["-sfL", "--max-time", "15", "-A", UA, url],
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    );
  } catch {
    return null;
  }
  if (!html || html.length < 200) return null;

  // Pull head only — meta tags are always there. Avoids accidentally
  // matching `<meta>` strings that appear quoted in body JSON.
  const headEnd = html.search(/<\/head\s*>/i);
  const head = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 32 * 1024);

  const ogTitle = pickMeta(head, ["og:title", "twitter:title"]) || extractTitle(head);
  const ogDescription = pickMeta(head, ["og:description", "twitter:description", "description"]);
  const siteName = pickMeta(head, ["og:site_name", "application-name"]);

  if (!ogTitle && !ogDescription) return null;

  const lines: string[] = ["## About this service", ""];
  if (ogTitle) lines.push(`**${ogTitle}**`, "");
  if (ogDescription) lines.push(ogDescription, "");
  if (siteName && siteName !== ogTitle) lines.push(`*— ${siteName}*`, "");

  return {
    markdown: lines.join("\n").trimEnd(),
    raw: { ogTitle, ogDescription, siteName },
  };
}

function pickMeta(head: string, keys: string[]): string {
  for (const key of keys) {
    // Match either `property="og:title"` or `name="og:title"` form, in
    // either attribute order. Content can be on either side.
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escapeRe(key)}["'][^>]*content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${escapeRe(key)}["']`, "i"),
    ];
    for (const re of patterns) {
      const m = head.match(re);
      if (m && m[1]) {
        const v = decodeEntities(m[1]).trim();
        if (v) return v;
      }
    }
  }
  return "";
}

function extractTitle(head: string): string {
  const m = head.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? decodeEntities(m[1]).trim() : "";
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
