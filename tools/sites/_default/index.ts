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
import { makeStub } from "../_shared/stub.ts";
import { harvestServiceCard } from "../_shared/service-card.ts";
import { downloadImage } from "../../fetch-raw.ts";
import { renderPdfFromUrl } from "./pdf-render.ts";

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

interface PlainFetchResult {
  /** Body as utf-8 (or whatever curl wrote — may be binary garbage for PDFs). */
  html: string;
  /** Content-Type from the response, lowercased + leading-token only. */
  contentType?: string;
  error?: string;
}

function plainFetch(url: string): PlainFetchResult {
  try {
    // Use -D to write response headers to a separate file so we can
    // recover Content-Type without polluting the body. The body still
    // streams to stdout.
    const headerFile = `/tmp/_default-headers-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    let html = "";
    try {
      html = execFileSync(
        "curl",
        [
          "-sfL",
          "--max-time", "30",
          "-D", headerFile,
          "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
          "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "-H", "Accept-Language: en-US,en;q=0.9",
          url,
        ],
        { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
      );
    } catch (e) {
      try { require("node:fs").unlinkSync(headerFile); } catch {}
      return { html: "", error: e instanceof Error ? e.message : String(e) };
    }
    // Parse last block of headers (after the last blank line — covers
    // redirect chains where curl -L records every hop's headers).
    let contentType: string | undefined;
    try {
      const fs = require("node:fs") as typeof import("node:fs");
      const headers = fs.readFileSync(headerFile, "utf8");
      fs.unlinkSync(headerFile);
      const blocks = headers.split(/\r?\n\r?\n/).filter(b => b.trim());
      const last = blocks[blocks.length - 1] || "";
      const m = last.match(/^content-type:\s*([^;\r\n]+)/im);
      if (m) contentType = m[1].trim().toLowerCase();
    } catch { /* best-effort */ }
    return { html, contentType };
  } catch (e) {
    return { html: "", error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Detect non-HTML responses we shouldn't try to JSDOM-parse:
 *   - Content-Type starts with "application/pdf" or "application/octet-stream"
 *   - Body starts with "%PDF-" magic bytes (PDF served as misc content-type)
 *   - Content-Type is image/*, video/*, audio/*
 *
 * Returns the matched reason, or null if the response looks like HTML.
 */
function detectNonHtml(body: string, contentType: string | undefined): string | null {
  if (body.startsWith("%PDF-")) return "PDF magic bytes (%PDF-) at body start";
  if (!contentType) return null;
  const ct = contentType.toLowerCase();
  if (ct === "application/pdf" || ct.startsWith("application/pdf")) return `Content-Type: ${ct}`;
  if (ct.startsWith("image/")) return `Content-Type: ${ct}`;
  if (ct.startsWith("video/")) return `Content-Type: ${ct}`;
  if (ct.startsWith("audio/")) return `Content-Type: ${ct}`;
  if (ct === "application/octet-stream") return `Content-Type: ${ct} (binary)`;
  if (ct.startsWith("application/zip") || ct.startsWith("application/x-tar") || ct.startsWith("application/x-gzip")) {
    return `Content-Type: ${ct} (archive)`;
  }
  return null;
}

/**
 * Browser-eval extraction. Open URL in opencli's headless Chrome, sleep
 * for hydration, capture the post-render `<html>` outerHTML so the
 * downstream converter has access to og:* metadata as well as the
 * hydrated body.
 */
function browserFetch(url: string, waitMs: number = 3500): { html: string; error?: string } {
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
    sleepMs(waitMs);

    // Scroll-trigger lazy-loaded images BEFORE extracting HTML.
    // Modern sites use intersection-observer-driven lazy loading: the
    // initial `<img src>` is a tiny placeholder (e.g. width-100 GCS
    // thumb), and the high-res variant only loads when the image
    // scrolls into view. Without scroll, our extraction captures the
    // placeholder URLs and the image-download phase saves tiny
    // thumbs (1-6 KB instead of 15-50 KB).
    //
    // The scroll routine walks 0% → 100% in 8 steps with 600ms pauses
    // (total ~5s on top of the initial waitMs). Each scroll step
    // fires intersection observers for newly-visible images, swapping
    // their `src` to the high-res variant. After the walk, scroll
    // back to 0 so any extraction that depends on document position
    // sees a stable state. See P-39 in
    // `Meta/site-handling-patterns.md`.
    const scrollScript = `(async () => {
      const h = document.body.scrollHeight;
      for (const pct of [12, 25, 38, 50, 62, 75, 88, 100, 0]) {
        window.scrollTo(0, h * pct / 100);
        await new Promise(r => setTimeout(r, 600));
      }
      return "";
    })()`;
    spawnSync("opencli", ["browser", "eval", scrollScript], {
      encoding: "utf8",
      timeout: browserTimeoutMs("eval"),
      maxBuffer: 1024,
    });

    const evalScript = `(() => {
      // Return the full document outerHTML so meta tags + body are both visible
      // to convertArticle's metadata extraction. Post-scroll, lazy-loaded
      // <img src> values have been upgraded to their high-res URLs.
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

function stubResult(url: string, summary: string, errorDetail?: string): Result {
  // Service-landing stubs (SPA shells, interactive apps) tend to have
  // rich `<meta>` in `<head>` even when the body extraction yielded
  // nothing useful — `og:title` + `og:description` describe what the
  // service IS, which is the user's bookmark intent. Harvest into
  // bodyExtra so the slug carries a "## About this service" card
  // instead of bare boilerplate. See P-41.
  const card = harvestServiceCard(url);
  return makeStub({
    url,
    module: "_default",
    kind: "fetch-failed",
    title: "_default article (fetch failed)",
    summary,
    advice:
      "_default tried plain curl then a browser-eval fallback; both produced too little body. " +
      "Open the URL in a browser to confirm the page renders. If it does, this host may " +
      "warrant a dedicated site module (see tools/sites/MIGRATION.md).",
    errorDetail,
    bodyExtra: card?.markdown,
  });
}

/**
 * Detect that the body we extracted is actually an anti-bot challenge
 * page (Cloudflare "Just a moment..." / Akamai / DataDome /
 * PerimeterX) or a Cloudflare origin-error interstitial (5xx error
 * pages served from the CF edge). Returns the matched signature name
 * for diagnostics, or null when the body is real content.
 *
 * Signals are deliberately broad — we want false positives over false
 * negatives, since the alternative is shipping a slug whose body
 * literally says "Performing security verification" as if it were
 * the article text. Tightening can come later if real-content pages
 * trip the filter.
 */
function looksLikeBotChallenge(title: string | undefined, body: string): string | null {
  const t = (title ?? "").trim();
  const head = body.slice(0, 1500);
  // Title-only signals — high confidence.
  if (/^Just a moment\.\.\.?$/i.test(t)) return "cloudflare-just-a-moment";
  if (/^Attention Required!.*Cloudflare/i.test(t)) return "cloudflare-attention-required";
  if (/\b\d{3}:\s*(SSL handshake failed|Origin is unreachable|Connection timed out|Web server is down)/i.test(t)) return "cloudflare-origin-error";
  // Body-text signals (any one is enough — these strings only appear
  // on challenge / interstitial pages, not on real content).
  if (/Performing security verification/i.test(head)) return "cloudflare-security-verification";
  if (/Checking your browser before accessing/i.test(head)) return "cloudflare-browser-check";
  if (/cf-browser-verification|cf-im-under-attack|cf_chl_/i.test(head)) return "cloudflare-class-marker";
  if (/Cloudflare Ray ID/i.test(head) && /\b(blocked|attention|security)\b/i.test(head)) return "cloudflare-ray-id-blocked";
  if (/DataDome|PerimeterX|HUMAN Security|ddg_captcha/i.test(head)) return "third-party-bot-protection";
  if (/Akamai Bot Manager|reference\s*#\d+\.[0-9a-f]+/i.test(head)) return "akamai-bot-manager";
  return null;
}

/**
 * Detect that the body we extracted is actually a "page not found" /
 * "page deleted" / HTTP-error-as-content page rather than real
 * content. Returns the matched signature name for diagnostics, or
 * null on no match.
 *
 * Distinct from `looksLikeBotChallenge` (which signals a TEMPORARY
 * block that might retry-succeed): a 404 means the resource is gone.
 * Operator action differs — bot-block points at re-auth; 404 points
 * at "edit the bookmark or accept the stub". The failure-kind
 * classifier maps the matched flag to `upstream-deleted`.
 *
 * Common shapes covered:
 *   - Tengine / nginx / Apache default 404 bodies
 *   - "Page not found" titles (literal, with site-suffix variants)
 *   - HTTP 410 Gone / 451 Unavailable served with a body
 *   - Common platform-specific dead-page messages
 */
function looksLikeNotFoundPage(title: string | undefined, body: string): string | null {
  const t = (title ?? "").trim();
  const head = body.slice(0, 1500);
  // Title-first: a `<title>` reading "404", "Page not found", "Not Found",
  // "Error 404", or "<NNN> [— site]" is a high-confidence signal. Real
  // articles whose CONTENT mentions 404 don't have it in the title.
  if (/^(?:404\b|Page Not Found|Not Found|Error 404|HTTP 4(?:04|10|51))/i.test(t)) return "title-404";
  if (/\|\s*404(\s|$)|—\s*Page Not Found|·\s*Page Not Found/i.test(t)) return "title-404-suffix";
  // Platform-specific dead-page messages.
  if (/^Sorry, this page isn't available/i.test(t)) return "instagram-deleted";
  if (/^This page (?:isn't available|doesn't exist|could not be found)/i.test(t)) return "platform-deleted";
  // Body-text fallback when the title is generic (some sites use the
  // site name as `<title>` even on 404s).
  if (/The requested URL .{0,80}was not found on this server/i.test(head)) return "apache-nginx-404";
  if (/(?:the page you (?:are looking for|requested) (?:doesn't|does not) exist|this page could not be found)/i.test(head)) return "page-not-found-body";
  if (/410 Gone|451 Unavailable For Legal Reasons/i.test(head)) return "http-gone-or-legal";
  return null;
}

/**
 * Page-deleted stub — emitted when the body we extracted is a 404 /
 * page-deleted error page rather than the underlying content.
 * Distinct flag (`_default-not-found`) so the failure-kind classifier
 * can route the slug to `upstream-deleted` (different operator
 * action from bot-block: edit the bookmark or accept). See P-34 in
 * `Meta/site-handling-patterns.md`.
 */
function notFoundStub(url: string, signature: string, errorDetail?: string): Result {
  return makeStub({
    url,
    module: "_default",
    kind: "not-found",
    title: "_default article (page not found)",
    summary: `body extracted is a 404 / page-deleted error page (signature: ${signature})`,
    advice:
      "The URL responded with a body that's a `404 Not Found` / `Page Deleted` page. " +
      "The resource is gone upstream. Edit or remove the bookmark in Raindrop, " +
      "or look for an archive.org snapshot if the content matters.",
    errorDetail,
  });
}

/**
 * Bot-blocked stub — emitted when the body we extracted is the
 * anti-bot challenge page itself rather than the underlying content.
 * Distinct flag (`bot-protection-blocked`) so the failure-kind
 * classifier can map this case to `upstream-fetch-failed` directly
 * instead of letting the slug masquerade as `content-too-short` /
 * `content-incomplete-images-zero`. See P-33 in
 * `Meta/site-handling-patterns.md`.
 */
function botBlockedStub(url: string, signature: string, errorDetail?: string): Result {
  return makeStub({
    url,
    module: "_default",
    kind: "bot-blocked",
    title: "_default article (bot protection blocked)",
    summary: `body extracted is an anti-bot challenge page (signature: ${signature})`,
    advice:
      "Cloudflare / Akamai / DataDome served a challenge or origin-error interstitial " +
      "instead of the underlying content. Both curl and browser-eval saw the same. " +
      "Open the URL in the opencli-bound Chrome to clear the challenge cookie, " +
      "then refetch — or accept the stub if the host is consistently bot-walled.",
    errorDetail,
  });
}

/**
 * Non-HTML stub — emitted when the curl response is a PDF / binary /
 * media file we can't extract markdown from. Distinct kind from
 * `fetch-failed` so the failure-kind classifier can label it
 * `upstream-not-html` directly.
 */
function nonHtmlStub(url: string, summary: string, errorDetail?: string): Result {
  return makeStub({
    url,
    module: "_default",
    kind: "non-html",
    title: "_default: non-HTML response",
    summary,
    advice:
      "The URL returned a non-HTML response (PDF, image, archive, or binary stream). " +
      "_default doesn't extract markdown from these — use a separate tool (e.g. PDF→text) or skip.",
    errorDetail,
  });
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

    // Short-circuit non-HTML responses (PDF, binary, media). JSDOM-parsing
    // them produces nonsense markdown ("good" status with random ASCII
    // from PDF binary bytes). Detect via Content-Type header AND the
    // %PDF- magic bytes in the body.
    if (!curlR.error && html) {
      const nonHtml = detectNonHtml(html, curlR.contentType);
      if (nonHtml) {
        // PDF: pivot from stub-only path (P-20) to the render path
        // (P-36). Re-downloads the PDF in binary mode (the curl above
        // captured as utf-8 and corrupted the bytes), loads via
        // mupdf, renders each page to PNG at 150 DPI, and emits an
        // image-bearing §2-contract markdown document.
        if (/PDF/.test(nonHtml)) {
          // Slug derived from slugDir basename (last path segment).
          const slug = opts.slugDir.split("/").filter(Boolean).pop() ?? "pdf";
          return renderPdfFromUrl({ url, slugDir: opts.slugDir, slug });
        }
        const detail = [
          `[curl] response: ${html.length} bytes, content-type: ${curlR.contentType ?? "(none)"}`,
          `[non-html detection] ${nonHtml}`,
          `[browser fallback] not attempted (content-type indicates non-HTML)`,
        ].join("\n");
        return nonHtmlStub(url, `${nonHtml}, ${html.length} bytes binary`, detail);
      }
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
      const summary = curlR.error
        ? `curl fetch failed: ${curlR.error.split("\n")[0].slice(0, 100)}`
        : "no usable HTML response from either curl or browser-eval";
      const detail = [
        curlR.error ? `[curl] ${curlR.error}` : `[curl] ok (${html.length} bytes) but no convertible body`,
        browserError ? `[browser-eval] ${browserError}` : `[browser-eval] not attempted or returned empty`,
      ].join("\n");
      return stubResult(url, summary, detail);
    }
    // 404 / page-deleted detection. Some hosts (Tengine, custom CMS
    // 404 pages) serve a page-deleted error body with HTTP 200, so
    // curl doesn't error and the body passes the stub threshold —
    // we'd save the error page as if it were content. Detect it and
    // emit a `_default-not-found` stub which classifies as
    // `upstream-deleted`. See P-34 in
    // `Meta/site-handling-patterns.md`.
    const notFoundSig = looksLikeNotFoundPage(conv.metadata.title, conv.markdown);
    if (notFoundSig) {
      const detail = [
        `signature:           ${notFoundSig}`,
        `final body chars:    ${conv.stats.bodyChars}`,
        `extracted title:     ${conv.metadata.title ?? "(none)"}`,
        `via:                 ${usedBrowser ? "browser-eval" : "curl"}`,
      ].join("\n");
      return notFoundStub(url, notFoundSig, detail);
    }

    // Anti-bot challenge detection. If the body we extracted IS the
    // Cloudflare / Akamai / DataDome challenge page (or a CF
    // origin-error interstitial), DON'T let it pass through as
    // content. See P-33 in `Meta/site-handling-patterns.md`.
    //
    // CF challenges typically auto-resolve in 10-15s with JS execution
    // — the default 3.5s browser wait often catches the challenge
    // mid-resolution. Retry with a 15s wait against the same URL
    // before giving up. opencli's user-bound Chrome carries organic
    // cookies + behavior signals Cloudflare often trusts. Origin-error
    // interstitials (CF 5xx) won't auto-resolve, so we skip retry for
    // those signatures.
    const challengeSig = looksLikeBotChallenge(conv.metadata.title, conv.markdown);
    if (challengeSig) {
      const isAutoResolvable = /^cloudflare-(?:just-a-moment|attention-required|security-verification|browser-check|class-marker|ray-id-blocked)$/i.test(challengeSig);
      let retried = false;
      let retryError: string | undefined;
      if (isAutoResolvable) {
        retried = true;
        const retryR = browserFetch(url, 15_000);
        if (retryR.error) {
          retryError = retryR.error;
        } else if (retryR.html) {
          const retryConv = runConverter({ html: retryR.html, url });
          const retrySig = looksLikeBotChallenge(retryConv.metadata.title, retryConv.markdown);
          if (!retrySig && retryConv.stats.bodyChars >= STUB_THRESHOLD) {
            // Challenge cleared. Continue with the retry result as
            // the canonical conv.
            conv = retryConv;
            html = retryR.html;
            usedBrowser = true;
          }
        }
      }
      // Re-check after the (possible) retry.
      const finalSig = looksLikeBotChallenge(conv.metadata.title, conv.markdown);
      if (finalSig) {
        const detail = [
          `signature:           ${finalSig}`,
          `curl bytes:          ${curlBytes}`,
          `curl body chars:     ${curlBodyChars}`,
          `browser path tried:  ${usedBrowser ? "yes (kept)" : conv ? "yes (rejected, smaller than curl)" : "no"}`,
          retried ? `retry path:          attempted with 15s wait${retryError ? ` (eval error: ${retryError})` : " (still challenged)"}` : "",
          browserError ? `browser eval error:  ${browserError}` : "",
          `final body chars:    ${conv.stats.bodyChars}`,
          `extracted title:     ${conv.metadata.title ?? "(none)"}`,
        ].filter(Boolean).join("\n");
        return botBlockedStub(url, finalSig, detail);
      }
    }

    if (conv.stats.bodyChars < STUB_THRESHOLD) {
      const summary = `body empty/too small (${conv.stats.bodyChars} chars after ${usedBrowser ? "browser" : "curl"} path)`;
      const detail = [
        `curl bytes:           ${curlBytes}`,
        `curl body chars:      ${curlBodyChars}`,
        `browser path tried:   ${conv ? (usedBrowser ? "yes (kept)" : "yes (rejected, smaller than curl)") : "no"}`,
        browserError ? `browser eval error:   ${browserError}` : "",
        `final body chars:     ${conv.stats.bodyChars}`,
        `stub threshold:       ${STUB_THRESHOLD}`,
      ].filter(Boolean).join("\n");
      return stubResult(url, summary, detail);
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
