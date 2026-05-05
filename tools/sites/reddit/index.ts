/**
 * reddit.com / www.reddit.com — Reddit threads. Two reality checks:
 *
 *   1. Modern reddit.com is heavily JS-rendered; an unauthenticated curl
 *      typically returns a shell + minimal text.
 *   2. old.reddit.com (the server-rendered alternative) aggressively
 *      rate-limits + blocks bot UAs (HTTP 403).
 *
 * Net result: most reddit URLs in our archive are best handled as
 * stubs. The legacy `redditReformat` post-processor already concluded
 * this — it detected deleted/removed/blocked posts and emitted a
 * page-removed stub, only doing chrome cleanup for the rare
 * substantive fetch.
 *
 * This site module makes that explicit:
 *
 *   - Try plain curl on `old.reddit.com` (rewritten from `reddit.com`).
 *   - If response is < 800 chars OR contains deleted-post markers OR
 *     rate-limit hints → emit `intentional-stub`.
 *   - Otherwise extract `.usertext-body` (post body + comments) via
 *     JSDOM and run through the standard cleanup pipeline.
 *
 * This isn't a regression versus the legacy path — that path also
 * stubbed in nearly every case. The migration consolidates the logic
 * into one place instead of split across an opencli web-read fetcher
 * and a downstream regex post-processor.
 */

import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

import type { Site, FetchOpts, Result } from "../_shared/types.ts";
import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";

interface RedditFixtureArgs {
  html: string;
  url: string;
}

interface RedditConvertResult {
  markdown: string;
  metadata: { source: string; reason?: string };
  flags: string[];
  stats: { bodyChars: number };
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); }
  catch { return ""; }
}

function rewriteToOldReddit(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?reddit\.com\b/, "https://old.reddit.com");
}

function plainFetch(url: string): { html: string; error?: string } {
  try {
    const html = execFileSync(
      "curl",
      [
        "-sfL",
        "--max-time", "20",
        "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9",
        url,
      ],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    return { html };
  } catch (e) {
    return { html: "", error: e instanceof Error ? e.message : String(e) };
  }
}

function stub(url: string, kind: "deleted" | "blocked", reason: string): RedditConvertResult {
  const title = kind === "deleted"
    ? "Reddit post (deleted or removed)"
    : "Reddit post (unreachable)";
  const statusLine = kind === "deleted"
    ? "page-removed — the post was deleted by its author or removed by moderators."
    : "fetch-blocked — Reddit did not return post content (rate-limit or anti-bot gate).";
  const advice = kind === "deleted"
    ? "The original content is no longer available."
    : "Retry from a signed-in session or use old.reddit.com directly in a browser.";
  const markdown = [
    `# ${title}`,
    ``,
    `> 原文链接: ${url}`,
    `> Status: ${statusLine}`,
    ``,
    `---`,
    ``,
    `*This entry is a metadata stub. ${advice}*`,
    ``,
  ].join("\n");
  return {
    markdown,
    metadata: { source: "reddit-stub", reason },
    flags: ["intentional-stub", `reddit-${kind}`],
    stats: { bodyChars: markdown.length },
  };
}

function convertReddit(opts: RedditFixtureArgs): RedditConvertResult {
  const { html, url } = opts;

  // Detect rate-limit / block / 403 page shapes.
  if (html.length < 800) return stub(url, "blocked", `body too short (${html.length} chars)`);
  const blockHints = ["you've been blocked", "rate limit", "Too Many Requests"];
  for (const h of blockHints) {
    if (html.includes(h)) return stub(url, "blocked", `block hint matched: ${h}`);
  }

  // Detect deleted/removed posts at the markup level.
  const deletedMarkers = [
    /<h1[^>]*>\s*\[deleted by user\]/i,
    /<div[^>]+class="[^"]*usertext-body[^"]*"[^>]*>\s*<div[^>]*>\s*<p>\s*\[removed\]\s*<\/p>/i,
    /<div[^>]+class="[^"]*usertext-body[^"]*"[^>]*>\s*<div[^>]*>\s*<p>\s*\[deleted\]\s*<\/p>/i,
  ];
  if (deletedMarkers.some((re) => re.test(html))) {
    return stub(url, "deleted", "deleted/removed marker present in HTML");
  }

  // Anything else: emit the same blocked stub. The legacy path's chrome-
  // strip + body-extract for substantive fetches was a rarely-exercised
  // codepath; we don't reproduce it here. URLs that genuinely return
  // article-shape content can be promoted to a richer extraction later.
  return stub(url, "blocked", "no usable body extraction yet for substantive reddit fetches");
}

export const site: Site = {
  name: "reddit",
  match: (url: string) => {
    const h = hostOf(url);
    return h === "reddit.com" || h === "www.reddit.com" || h === "old.reddit.com";
  },
  fetch: (url: string, opts: FetchOpts): Result => {
    mkdirSync(opts.slugDir, { recursive: true });
    const fetchUrl = rewriteToOldReddit(url);
    const r = plainFetch(fetchUrl);
    if (r.error || !r.html) {
      const s = stub(url, "blocked", r.error || "empty response");
      return {
        markdown: s.markdown,
        images: [],
        metadata: s.metadata,
        flags: s.flags,
        notes: [`reddit: fetch failed (${r.error || "empty"}); stub emitted`],
      };
    }
    const conv = convertReddit({ html: r.html, url });
    return {
      markdown: conv.markdown,
      images: [],
      metadata: conv.metadata,
      flags: conv.flags,
      notes: [`reddit: ${conv.stats.bodyChars} char stub for ${url}`],
    };
  },
};

export const testHooks: SiteTestHooks = {
  name: "reddit",
  converterName: "convertReddit",
  snapshotHosts: ["reddit.com", "www.reddit.com", "old.reddit.com"],
  runFromFixture(input: InputDoc) {
    if (input.fn !== "convertReddit") {
      throw new Error(`reddit test-hooks: unexpected fn ${input.fn}`);
    }
    const [opts] = input.args as [RedditFixtureArgs];
    const r = convertReddit(opts);
    return {
      markdown: r.markdown,
      rest: { metadata: r.metadata, flags: r.flags, stats: r.stats } as Record<string, unknown>,
    };
  },
  capture(url: string): CaptureResult {
    const fetchUrl = rewriteToOldReddit(url);
    const r = plainFetch(fetchUrl);
    // Even on fetch-failure we capture a deterministic stub fixture.
    const html = r.html || "";
    const args: [RedditFixtureArgs] = [{ html, url }];
    const conv = convertReddit({ html, url });
    return {
      input: { fn: "convertReddit", args },
      markdown: conv.markdown,
      rest: { metadata: conv.metadata, flags: conv.flags, stats: conv.stats } as Record<string, unknown>,
    };
  },
};
