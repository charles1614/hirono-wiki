/**
 * `_default` — catch-all site module. Registered LAST in `SITES[]` so
 * every host-specific module gets first pick; this one fields any URL
 * none of them claimed.
 *
 * Hybrid strategy:
 *
 *   1. Try plain `curl` + JSDOM with permissive body selectors and a
 *      generous chrome dropSelector list. Fast (<1s) and works for ~80%
 *      of long-tail hosts (real article-shape blogs and docs).
 *
 *   2. If the curl-extracted body has fewer than 500 chars after the
 *      selector cascade — typically a SPA shell — fall back to
 *      `opencli browser open` + `eval` to capture the post-hydration
 *      DOM. Convert via the same `convertArticle` so output style is
 *      identical to the curl path.
 *
 *   3. If the browser path also produces a body shorter than 200 chars
 *      (the existing stub threshold), emit `intentional-stub`.
 *
 * Why hybrid (not always-browser): the browser path serializes through
 * the machine-wide opencli lock and adds ~3-5s per fetch. ~80% of
 * long-tail hosts work fine with curl, so paying that cost only when
 * curl produced an empty body keeps bulk re-ingest fast while still
 * catching SPAs.
 *
 * Why not promote to dedicated modules: the long-tail is 91 single-
 * bookmark hosts. Per-host modules aren't economical; the catch-all
 * needs to handle SPAs itself.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

import type { Site, FetchOpts, Result } from "../_shared/types.ts";
import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";
import { convertArticle, type ArticleConvertResult, type ArticleSelectors } from "../_shared/article-converter.ts";
import { sleepMs, closeBrowser, browserTimeoutMs } from "../_shared/browser-helpers.ts";
import { downloadImage } from "../../fetch-raw.ts";

interface DefaultFixtureArgs {
  html: string;
  url: string;
}

const SELECTORS: ArticleSelectors = {
  bodySelectors: [
    "article",
    "main",
    "[role='main']",
    ".prose",
    ".post-content",
    ".article-body",
    ".entry-content",
    ".content",
  ],
  dropSelectors: [
    "nav", "footer", "aside", "header",
    ".nav", ".navigation",
    ".breadcrumb", ".breadcrumbs",
    ".share", ".share-buttons", ".social-share", ".social",
    ".related", ".related-posts", ".related-stories",
    ".comments", ".comment-section",
    ".cookie-banner", ".cookie-notice",
    ".sidebar", ".side-bar",
    ".author-bio", ".author-card",
    ".tags", ".tag-list",
    ".meta", ".byline", ".post-meta",
    ".post-navigation", ".pagination", ".paginav",
  ],
  // Demote body headings by one level so the §2 frontmatter H1 stays
  // unique. Long-tail SPAs and themed blogs frequently use H1 for
  // in-page section titles; without demotion we get two H1s.
  demoteH1: true,
  imagePrefix: "default",
};

/** Below this body-char count, attempt the browser fallback. */
const BROWSER_FALLBACK_THRESHOLD = 500;
/** Below this after BOTH paths, emit a stub. */
const STUB_THRESHOLD = 200;

function plainFetch(url: string): { html: string; error?: string } {
  try {
    const html = execFileSync(
      "curl",
      [
        "-sfL",
        "--max-time", "30",
        "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
        "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "-H", "Accept-Language: en-US,en;q=0.9",
        url,
      ],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    return { html };
  } catch (e) {
    return { html: "", error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Browser-eval extraction. Open URL in opencli's headless Chrome, sleep
 * for hydration, capture the post-render `<html>` outerHTML so the
 * downstream converter has access to og:* metadata as well as the
 * hydrated body.
 */
function browserFetch(url: string): { html: string; error?: string } {
  let opened = false;
  try {
    const openRes = spawnSync("opencli", ["browser", "open", url], {
      encoding: "utf8",
      timeout: browserTimeoutMs("open"),
    });
    if (openRes.status !== 0) {
      return { html: "", error: `browser open failed: ${(openRes.stderr || "").slice(0, 200)}` };
    }
    opened = true;
    sleepMs(3500);

    const evalScript = `(() => {
      // Return the full document outerHTML so meta tags + body are both visible
      // to convertArticle's metadata extraction.
      return JSON.stringify({ html: document.documentElement.outerHTML });
    })()`;
    const evalRes = spawnSync("opencli", ["browser", "eval", evalScript], {
      encoding: "utf8",
      timeout: browserTimeoutMs("eval"),
      maxBuffer: 64 * 1024 * 1024,
    });
    if (evalRes.status !== 0) {
      return { html: "", error: `browser eval failed: ${(evalRes.stderr || "").slice(0, 200)}` };
    }

    const stdout = evalRes.stdout || "";
    const start = stdout.indexOf("{");
    if (start < 0) return { html: "", error: "no JSON in eval output" };
    let depth = 0, end = -1, inStr = false, esc = false;
    for (let i = start; i < stdout.length; i++) {
      const c = stdout[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) return { html: "", error: "unterminated JSON" };
    try {
      const p = JSON.parse(stdout.slice(start, end + 1));
      return { html: p.html || "" };
    } catch (e) {
      return { html: "", error: `JSON parse failed: ${e instanceof Error ? e.message : e}` };
    }
  } catch (e) {
    return { html: "", error: e instanceof Error ? e.message : String(e) };
  } finally {
    if (opened) closeBrowser();
  }
}

function runConverter(args: DefaultFixtureArgs): ArticleConvertResult {
  return convertArticle({ html: args.html, url: args.url, selectors: SELECTORS });
}

function stubResult(url: string, reason: string): Result {
  return {
    markdown:
      `# _default article: ${url}\n\n` +
      `> 原文链接: ${url}\n\n` +
      `---\n\n` +
      `*This entry is a metadata stub. ${reason}*\n`,
    images: [],
    metadata: { source: "_default-stub", reason },
    flags: ["intentional-stub", "_default-fetch-failed"],
    notes: [`_default: stub emitted — ${reason}`],
  };
}

export const site: Site = {
  name: "_default",
  match: () => true,
  fetch: (url: string, opts: FetchOpts): Result => {
    mkdirSync(opts.slugDir, { recursive: true });

    // Path 1: plain curl
    const curlR = plainFetch(url);
    let html = curlR.html;
    let conv: ArticleConvertResult | null = null;
    let usedBrowser = false;
    let curlBytes = 0;
    let curlBodyChars = 0;
    let browserError: string | undefined;

    if (!curlR.error && html) {
      conv = runConverter({ html, url });
      curlBytes = html.length;
      curlBodyChars = conv.stats.bodyChars;
    }

    // Path 2: browser-eval fallback if curl produced too little body
    if (!conv || conv.stats.bodyChars < BROWSER_FALLBACK_THRESHOLD) {
      const browserR = browserFetch(url);
      if (browserR.error) {
        browserError = browserR.error;
      } else if (browserR.html) {
        const browserConv = runConverter({ html: browserR.html, url });
        // Take browser result if it produced meaningfully more body than curl
        if (browserConv.stats.bodyChars > curlBodyChars) {
          conv = browserConv;
          html = browserR.html;
          usedBrowser = true;
        }
      }
    }

    if (!conv) {
      const reason = curlR.error || browserError || "empty HTML response";
      return stubResult(url, reason);
    }
    if (conv.stats.bodyChars < STUB_THRESHOLD) {
      return stubResult(url, `_default body empty/too small (${conv.stats.bodyChars} chars after ${usedBrowser ? "browser" : "curl"} path)`);
    }

    // Image localization
    const images: string[] = [];
    let imgFailed = 0;
    for (const dl of conv.imagesToDownload) {
      const dest = join(opts.slugDir, dl.localFilename);
      const bytes = downloadImage(dl.remoteUrl, dest, undefined, url);
      if (bytes > 0) images.push(dl.localFilename);
      else imgFailed++;
    }

    const flags: string[] = [];
    if (imgFailed > 0) flags.push("_default-image-download-partial");
    if (usedBrowser) flags.push("_default-used-browser-fallback");

    return {
      markdown: conv.markdown,
      title: conv.metadata.title,
      images,
      metadata: {
        source: "_default",
        title: conv.metadata.title,
        description: conv.metadata.description,
        published_at: conv.metadata.publishedAt,
        authors: conv.metadata.authors,
        stats: conv.stats,
        used_browser_fallback: usedBrowser,
        curl_html_bytes: curlBytes,
      },
      flags,
      notes: [
        `_default: ${conv.stats.bodyChars} body chars via ${usedBrowser ? "browser-eval fallback" : "plain curl"}, ` +
        `${images.length}/${conv.imagesToDownload.length} image(s) downloaded` +
        (imgFailed > 0 ? ` (${imgFailed} failed)` : ""),
      ],
    };
  },
};

export const testHooks: SiteTestHooks = {
  name: "_default",
  converterName: "convertDefaultArticle",
  // Reference snapshots are captured against stable static blog posts on
  // hosts that don't have dedicated modules.
  snapshotHosts: ["martinfowler.com"],
  runFromFixture(input: InputDoc) {
    if (input.fn !== "convertDefaultArticle") {
      throw new Error(`_default test-hooks: unexpected fn ${input.fn}`);
    }
    const [args] = input.args as [DefaultFixtureArgs];
    const r = runConverter(args);
    const { markdown, ...rest } = r;
    return { markdown, rest: rest as Record<string, unknown> };
  },
  capture(url: string): CaptureResult {
    // Capture path uses curl-only so fixtures stay deterministic. SPA URLs
    // shouldn't be locked into snapshots through _default — they belong in
    // dedicated modules.
    const r = plainFetch(url);
    if (r.error) throw new Error(`_default capture: ${r.error}`);
    if (!r.html || r.html.length < 1000) throw new Error(`_default capture: HTML empty/short (${r.html.length} chars)`);
    const args: [DefaultFixtureArgs] = [{ html: r.html, url }];
    const result = runConverter(args[0]);
    const { markdown, ...rest } = result;
    return {
      input: { fn: "convertDefaultArticle", args },
      markdown,
      rest: rest as Record<string, unknown>,
    };
  },
};
