#!/usr/bin/env node
/**
 * fetch-raw: populate raw/<YYYY>/<slug>/ with a fetched source's content.md,
 * source.json, and image assets. Per the raw-source-archive plan, this is
 * the local-immutable "source of truth" layer (Karpathy's invariant).
 *
 * Subcommands:
 *
 *   store <slug> --origin <origin> --origin-url <url> [--input <file>]
 *                [--raindrop-meta <path>] [--lark-meta <path>]
 *                [--title <title>] [--no-images]
 *     Store pre-fetched markdown. Input defaults to stdin. Use this when
 *     the caller (Claude) has already fetched content via MCP (Raindrop) or
 *     any other mechanism. Writes raw/<year>/<slug>/{content.md, source.json,
 *     *.png}, downloading referenced images unless --no-images.
 *
 *   fetch-lark <node-token> --slug <slug> [--no-images]
 *     Shell out to `lark-hirono fetch --doc <token>`, then store the result.
 *
 *   fetch-url <url> --slug <slug> [--via-browser] [--no-images]
 *     Fetch a URL via r.jina.ai (static) OR opencli browser (login-walled).
 *     Dispatch rules:
 *       1. Hardcoded domain → opencli (xhs, xiaohongshu, zhihu, mp.weixin.qq.com)
 *       2. --via-browser → force opencli
 *       3. Else static; if result is suspicious (short body, login keywords),
 *          retry via opencli.
 *
 *   verify <slug>
 *     Sanity-check raw/<year>/<slug>/ structure.
 *
 * Error escalation (per the codified protocol in Meta/schema.md):
 *   L1 (auto-retry transient): network timeout, 5xx, 429 w/ Retry-After
 *   L2 (queue-and-continue):   404, app-only-url, empty-body, paywalled-partial
 *   L3 (halt and ask user):    extension-offline, login-expired, captcha-required,
 *                              ip-blocked, parse-failure, opencli-timeout
 */

import { execSync, spawnSync } from "node:child_process";
import {
  existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync,
  readdirSync, statSync, renameSync, rmSync,
  openSync, readSync, closeSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { writeFileAtomic } from "./shared/atomic-write.ts";
import { acquireBrowserLock, acquireSlugLock } from "./hirono/shared/browser-lock.ts";
import { deepwikiStripNav } from "./hirono/shared/post-process.ts";
import { convertWeixinHtml } from "./hirono/weixin/raw-html-converter.ts";
import { routeSite } from "./sites/index.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..");
const ISSUES_LOG = join(REPO_ROOT, ".wiki-fetch-issues.md");
const RAW_DIR = join(REPO_ROOT, "raw");

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export interface RaindropMeta {
  bookmark_id: number;
  title: string;
  tags: string[];
  highlights: Array<{ text: string; color?: string; note?: string }>;
  collection_id?: number;
  created?: string;
}

export interface LarkMeta {
  node_token: string;
  title?: string;
}

export type FetcherKind = "raindrop-mcp-piped" | "lark-hirono" | "url-static" | "opencli";
export type FetcherReason = "direct" | "domain-override" | "quality-fallback" | "forced-via-browser";

export interface ImageRecord {
  local: string;
  remote: string;
  bytes: number;
}

/**
 * Quality status is a coarse three-level summary derived from the fine-grained
 * `quality_flags` list. Callers (the `status` + `sync` commands) use it to
 * decide scan-ability and re-fetch eligibility without re-parsing flag lists.
 *
 *   good     — content is usable; no flags fired
 *   flagged  — raw saved, but at least one flag fired (login-wall, short-body,
 *              loading-skeleton, image-download-failed, etc.)
 *   failed   — no usable content on disk at all. This is set externally (by
 *              the `status` walker) when raw/<slug>/content.md is absent; the
 *              classifier itself never returns it because it only runs on
 *              content that was actually captured.
 */
export type QualityStatus = "good" | "flagged" | "failed";

export interface SourceJson {
  fetched_at: string;
  origin: string;
  origin_url: string;
  fetcher: FetcherKind;
  fetcher_reason: FetcherReason;
  content_sha: string;
  content_length: number;
  quality_flags: string[];
  quality_status: QualityStatus;
  images: ImageRecord[];
  notes: string[];
  raindrop_meta?: RaindropMeta;
  lark_meta?: LarkMeta;
}

export type ErrorLevel = "L1" | "L2" | "L3";
export interface FetchError extends Error {
  code: string;
  level: ErrorLevel;
  domain?: string;
  remediation?: string;
}

// ---------------------------------------------------------------------------
// domain dispatch
// ---------------------------------------------------------------------------

/**
 * Dispatch: pick the right opencli adapter for a URL.
 *
 * opencli ships native adapters that know each domain's DOM, handle auth
 * via the Chrome cookie session, and download images for us. Using these
 * adapters directly beats a generic browser+selector approach — opencli
 * maintainers keep them current with each site's DOM changes.
 */
export type OpencliAdapter =
  | "xiaohongshu"       // xhs posts + images
  | "zhihu-article"     // zhuanlan.zhihu.com/p/<id>
  | "zhihu-question"    // www.zhihu.com/question/<id>
  | "weixin"            // mp.weixin.qq.com/s/<id>
  | "web-read";         // generic fallback (opencli web read)

interface DispatchRule {
  match: (url: string, host: string) => boolean;
  adapter: OpencliAdapter;
  friendlyName: string;
}

export const DISPATCH_RULES: DispatchRule[] = [
  // ── Native opencli adapters ──────────────────────────────────────────────
  {
    match: (_u, h) => /(?:^|\.)xiaohongshu\.com$/i.test(h) || h === "xhslink.com",
    adapter: "xiaohongshu",
    friendlyName: "xiaohongshu",
  },
  {
    match: (_u, h) => h === "zhuanlan.zhihu.com",
    adapter: "zhihu-article",
    friendlyName: "zhihu-article",
  },
  {
    match: (u, h) => /(?:^|\.)zhihu\.com$/i.test(h) && /\/question\//.test(u),
    adapter: "zhihu-question",
    friendlyName: "zhihu-question",
  },
  {
    match: (_u, h) => h === "mp.weixin.qq.com",
    adapter: "weixin",
    friendlyName: "wechat",
  },

  // ── Group 1: web-read + existing post-processors ─────────────────────────
  { match: (_u, h) => h === "github.com",            adapter: "web-read", friendlyName: "github-web" },
  { match: (_u, h) => h === "arxiv.org",             adapter: "web-read", friendlyName: "arxiv-web" },
  { match: (_u, h) => h === "wiki.litenext.digital", adapter: "web-read", friendlyName: "deepwiki-litenext" },
  { match: (_u, h) => h === "deepwiki.com",          adapter: "web-read", friendlyName: "deepwiki-com" },

  // ── Group 2: Substack newsletters ────────────────────────────────────────
  { match: (_u, h) => h === "newsletter.semianalysis.com",    adapter: "web-read", friendlyName: "substack-semianalysis" },
  { match: (_u, h) => h === "magazine.sebastianraschka.com",  adapter: "web-read", friendlyName: "substack-sebastianraschka" },
  { match: (_u, h) => h === "sebastianraschka.com",           adapter: "web-read", friendlyName: "sebastianraschka-blog" },

  // ── Group 3: Forums ───────────────────────────────────────────────────────
  { match: (_u, h) => h === "linux.do",   adapter: "web-read", friendlyName: "linux-do-discourse" },
  { match: (_u, h) => h === "reddit.com" || h === "www.reddit.com", adapter: "web-read", friendlyName: "reddit-web" },

  // ── Group 4: Twitter / X (auth-gated — post-processor produces stub) ──────
  { match: (_u, h) => h === "x.com" || h === "twitter.com", adapter: "web-read", friendlyName: "x-metadata-stub" },

  // ── Group 5: Feishu internal wikis ───────────────────────────────────────
  { match: (_u, h) => /\.feishu\.cn$/i.test(h), adapter: "web-read", friendlyName: "feishu-wiki" },

  // ── Group 6: Generic article / blog / research sites ─────────────────────
  { match: (_u, h) => h === "intuitionlabs.ai",       adapter: "web-read", friendlyName: "intuitionlabs-blog" },
  { match: (_u, h) => h === "sspai.com",              adapter: "web-read", friendlyName: "sspai-blog" },
  { match: (_u, h) => h === "nvidianews.nvidia.com",  adapter: "web-read", friendlyName: "nvidia-news" },
  { match: (_u, h) => h === "qwen.ai",                adapter: "web-read", friendlyName: "qwen-blog" },
  { match: (_u, h) => h === "lmsys.org",              adapter: "web-read", friendlyName: "lmsys-blog" },
  { match: (_u, h) => h === "epoch.ai",               adapter: "web-read", friendlyName: "epoch-research" },
  { match: (_u, h) => h === "developer.nvidia.com",   adapter: "web-read", friendlyName: "nvidia-dev" },
  { match: (_u, h) => h === "blog.google",            adapter: "web-read", friendlyName: "google-blog" },
  { match: (_u, h) => h === "aleksagordic.com" || h === "www.aleksagordic.com", adapter: "web-read", friendlyName: "aleksagordic-blog" },
  { match: (_u, h) => h === "huggingface.co",         adapter: "web-read", friendlyName: "huggingface-web" },
  { match: (_u, h) => h === "blog.csdn.net",          adapter: "web-read", friendlyName: "csdn-blog" },
  { match: (_u, h) => h === "01.me",                  adapter: "web-read", friendlyName: "blog-01me" },
  { match: (_u, h) => h === "docs.nvidia.com",        adapter: "web-read", friendlyName: "nvidia-docs" },
  { match: (_u, h) => h === "sohu.com" || h === "www.sohu.com", adapter: "web-read", friendlyName: "sohu-news" },
];

export function hostnameOf(url: string): string {
  try { return new URL(url).hostname; } catch { return ""; }
}

export function lookupDispatch(url: string): DispatchRule | null {
  const host = hostnameOf(url);
  if (!host) return null;
  for (const r of DISPATCH_RULES) if (r.match(url, host)) return r;
  return null;
}

/**
 * Per-host wait overrides for the generic `opencli web read` path. Some
 * client-rendered SPAs don't hydrate their article body in the default 10s
 * window we allow; bumping to 20s at fetch time beats relying on the 60s
 * auto-retry (which pays the first-try cost anyway).
 *
 * Separate from DISPATCH_RULES because DISPATCH_RULES routes to native
 * adapters (xhs/zhihu/wechat) that don't take a `--wait` flag. These
 * overrides apply only to the web-read fallback.
 */
interface WaitOverride {
  match: (url: string, host: string) => boolean;
  waitSeconds: number;
}

const WEB_READ_WAIT_OVERRIDES: WaitOverride[] = [
  // DeepWiki — client-rendered, ~20s to hydrate article body on cold cache
  { match: (_u, h) => h === "wiki.litenext.digital" || h === "deepwiki.com", waitSeconds: 20 },
  // Notion (personal + team workspaces) — heavy client rendering
  { match: (_u, h) => h === "notion.so" || /\.notion\.so$/i.test(h), waitSeconds: 20 },
  // Vercel preview deployments — typically next.js SSG+hydration
  { match: (_u, h) => /\.vercel\.app$/i.test(h), waitSeconds: 20 },
  // Qwen blog / epoch.ai — React SPAs, slow hydration
  { match: (_u, h) => h === "qwen.ai" || h === "epoch.ai", waitSeconds: 20 },
];

export const DEFAULT_WEB_READ_WAIT_SECONDS = 10;

export function getPreferredWaitSeconds(url: string): number {
  const host = hostnameOf(url);
  if (!host) return DEFAULT_WEB_READ_WAIT_SECONDS;
  for (const o of WEB_READ_WAIT_OVERRIDES) {
    if (o.match(url, host)) return o.waitSeconds;
  }
  return DEFAULT_WEB_READ_WAIT_SECONDS;
}

/** Convenience used by the L3 redirect detector: is a given URL on a known article path? */
export function isArticleLikeUrl(url: string): boolean {
  const patterns = [
    /xiaohongshu\.com\/(discovery\/item|explore\/)/,
    /xhslink\.com\/o\//,
    /zhuanlan\.zhihu\.com\/p\//,
    /(?:^|\.)zhihu\.com\/question\//,
    /mp\.weixin\.qq\.com\/s\//,
  ];
  return patterns.some((re) => re.test(url));
}

// ---------------------------------------------------------------------------
// error helpers
// ---------------------------------------------------------------------------

function makeError(code: string, level: ErrorLevel, message: string, extras: Partial<FetchError> = {}): FetchError {
  const err = Object.assign(new Error(message), { code, level, ...extras }) as FetchError;
  return err;
}

export const LOGIN_WALL_KEYWORDS = [
  "Open in App",
  "登录",
  "登陆",
  "打开App",
  "打开小红书 App",
  "Sign in to continue",
  "Log in to continue",
  "app_download",
  "请在微信客户端打开",
];

/** Client-render placeholders. When these appear, the page hadn't fully hydrated by the time we scraped. */
export const LOADING_SKELETON_KEYWORDS = [
  "Loading content",
  "Loading wiki",
  "Loading...",
  "加载中",
  "Please wait",
];

/**
 * Optional context a caller can pass to classifyQuality to surface flags it
 * alone can't see from the raw markdown:
 *
 *   declaredImageCount / downloadedImageCount
 *     Cross-check: if the content.md references images but we saved zero on
 *     disk, fire `images-declared-but-none-downloaded`. Happens when a
 *     generic web-read adapter left `![img](…)` placeholders but failed the
 *     asset download silently.
 *
 *   xhsDownloadSilentFail
 *     Adapter-signaled: `xiaohongshu download` exited 0 but left no image
 *     files in slugDir (even after a 5s-delayed retry). xhs posts are nearly
 *     always image-heavy, so this is almost always a silent failure, not
 *     a genuinely text-only post.
 *
 *   extraFlags
 *     Flags the caller already determined (e.g. "image-download-failed" from
 *     processImages). Merged into the result.
 */
export interface QualityContext {
  declaredImageCount?: number;
  downloadedImageCount?: number;
  xhsDownloadSilentFail?: boolean;
  extraFlags?: string[];
  /**
   * The URL that was fetched. When set, enables per-host expected-size-band
   * and structural checks (heading count, host-specific minimum body size).
   * Omitted for legacy call sites that only have markdown without URL.
   */
  originUrl?: string;
}

/**
 * Per-host minimum body size (chars). Set conservatively — this is meant to
 * catch egregious extractor misfires where opencli latches onto a sidebar /
 * collections card / related-links widget instead of the actual article body
 * (like the `huggingface.co/blog/moe` case where opencli returned 276 chars
 * when the real article is ~30 KB). Hosts absent from the map fall through
 * to the generic 500-char `short-body` floor.
 *
 * Values are deliberately below typical article length so we only fire when
 * extraction is obviously broken, not when a genuine short post exists.
 */
const HOST_MIN_BODY_SIZES: Array<{ match: (u: string, h: string) => boolean; minChars: number }> = [
  // HF blog posts: expect full articles (5-50 KB typical). Spaces are
  // deliberately excluded — their READMEs are often 1-3 KB and handled by a
  // dedicated README fetcher + stub fallback.
  { match: (u, h) => h === "huggingface.co" && /\/blog\//.test(u), minChars: 2000 },
  { match: (_u, h) => h === "arxiv.org", minChars: 1500 },
  { match: (_u, h) => h === "github.com", minChars: 1000 },
  { match: (_u, h) => h === "docs.nvidia.com" || h === "developer.nvidia.com", minChars: 1500 },
  { match: (_u, h) => h === "magazine.sebastianraschka.com" || h === "newsletter.semianalysis.com" || h === "sebastianraschka.com", minChars: 3000 },
  { match: (_u, h) => h === "wiki.litenext.digital" || h === "deepwiki.com", minChars: 1500 },
  { match: (_u, h) => h === "aleksagordic.com" || h === "www.aleksagordic.com", minChars: 3000 },
  { match: (_u, h) => h === "blog.google", minChars: 1500 },
  { match: (_u, h) => h === "intuitionlabs.ai", minChars: 2000 },
  { match: (_u, h) => h === "lmsys.org", minChars: 2000 },
  { match: (_u, h) => h === "blog.csdn.net", minChars: 2000 },
  { match: (_u, h) => h === "sspai.com", minChars: 2000 },
  { match: (_u, h) => h === "01.me", minChars: 1500 },
  { match: (_u, h) => h === "qwen.ai", minChars: 1500 },
];

export interface QualityResult {
  suspicious: boolean;
  flags: string[];
  quality_status: QualityStatus;
}

export function classifyQuality(content: string, ctx: QualityContext = {}): QualityResult {
  const flags: string[] = [];
  const trimmed = content.trim();
  // `intentional-stub` is emitted by post-processors that deliberately
  // replace content with a short metadata stub (HF Spaces, x.com auth-gate,
  // private feishu). For those, skip the size- and structure-based flags —
  // the short body is by design, not a broken extraction.
  const isStub = ctx.extraFlags?.includes("intentional-stub") ?? false;
  if (!isStub && trimmed.length < 500) flags.push("short-body");

  // Per-host expected-size band: flag when body is above the generic 500-char
  // floor but still below what we expect for this host. Targets the case
  // where opencli returned *something* (so no generic `short-body`) but that
  // something is clearly a sidebar/card rather than the article body.
  if (!isStub && ctx.originUrl) {
    const host = hostnameOf(ctx.originUrl).toLowerCase();
    const rule = HOST_MIN_BODY_SIZES.find((r) => r.match(ctx.originUrl!, host));
    if (rule && trimmed.length < rule.minChars && !flags.includes("short-body")) {
      flags.push("below-host-expected-size");
    }
  }

  // Structural check: a body with substantial text (≥ 2 KB) but zero
  // headings is suspicious — article pages almost always have some `##` /
  // `###` hierarchy. Zero headings in a long body usually means opencli
  // grabbed a sidebar/card/feed item rather than the article.
  // Skip when `short-body` / `below-host-expected-size` already fired (those
  // flags already indicate a bad extraction; no need to double-count).
  if (
    !isStub &&
    trimmed.length >= 2000 &&
    !flags.includes("short-body") &&
    !flags.includes("below-host-expected-size")
  ) {
    const headingCount = (trimmed.match(/^#{1,6}\s+\S/gm) ?? []).length;
    if (headingCount === 0) flags.push("no-headings-in-body");
  }

  // Login-wall keywords are very common in Chinese prose ("登录" appears
  // naturally in any article discussing user auth flows). Only flag when:
  //   - body is thin (< 1500 chars — likely a real wall page), OR
  //   - keyword appears in the first 500 chars (above the fold of any
  //     real article body, where a wall would intercept).
  // This avoids false positives on technical articles that happen to
  // mention login mechanics in prose.
  const loginScanRegion =
    trimmed.length < 1500 ? trimmed : trimmed.slice(0, 500);
  for (const kw of LOGIN_WALL_KEYWORDS) {
    if (loginScanRegion.includes(kw)) {
      flags.push("login-wall-keyword");
      break;
    }
  }
  // Loading-skeleton detection is fraught: many pages have incidental
  // "Loading..." text in lazy-loaded widgets (BibTeX boxes, embedded
  // videos, newsletter signup forms) even when the main article body is
  // fully present. Only flag if the body is ALSO short — a true skeleton
  // state has ≤2000 chars of content. Over that threshold, "Loading..."
  // is almost always a widget artifact that we should ignore.
  if (trimmed.length < 2000) {
    for (const kw of LOADING_SKELETON_KEYWORDS) {
      if (trimmed.includes(kw)) {
        flags.push("loading-skeleton");
        break;
      }
    }
  }
  if (
    typeof ctx.declaredImageCount === "number" &&
    typeof ctx.downloadedImageCount === "number" &&
    ctx.declaredImageCount > 0 &&
    ctx.downloadedImageCount === 0
  ) {
    flags.push("images-declared-but-none-downloaded");
  }
  if (ctx.xhsDownloadSilentFail) flags.push("xhs-download-silent-fail");
  if (ctx.extraFlags) {
    for (const f of ctx.extraFlags) {
      // `intentional-stub` is a control signal consumed above (to skip
      // size-based flags). It is NOT a quality problem and should not
      // appear in the output flags list or cause `status=flagged`.
      if (f === "intentional-stub") continue;
      if (f && !flags.includes(f)) flags.push(f);
    }
  }
  // Dedupe (caller's extraFlags may overlap with our detections)
  const uniq = [...new Set(flags)];
  const suspicious = uniq.length > 0;
  const quality_status: QualityStatus = suspicious ? "flagged" : "good";
  return { suspicious, flags: uniq, quality_status };
}

function logL2Issue(slug: string, code: string, originUrl: string, detail?: string): void {
  const line = `${new Date().toISOString()}  ${code.padEnd(22)}  ${slug.padEnd(40)}  ${originUrl}${detail ? "  " + detail : ""}\n`;
  appendFileSync(ISSUES_LOG, line, "utf8");
}

// ---------------------------------------------------------------------------
// slug + path helpers
// ---------------------------------------------------------------------------

export function yearForSlug(slug: string): string {
  const m = slug.match(/^(\d{4})-\d{2}-\d{2}-/);
  return m ? m[1] : new Date().getFullYear().toString();
}

export function rawDirFor(slug: string): string {
  return join(RAW_DIR, yearForSlug(slug), slug);
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// ---------------------------------------------------------------------------
// image extraction + download
// ---------------------------------------------------------------------------

/** Extract image URLs from markdown. Ignores content inside fenced code blocks. */
export function extractImageUrls(md: string): string[] {
  const out = new Set<string>();
  let inFence = false;
  for (const line of md.split("\n")) {
    if (/^```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    for (const m of line.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) {
      out.add(m[1]);
    }
    for (const m of line.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
      out.add(m[1]);
    }
  }
  return [...out];
}

/** Decide a stable local filename for a remote image URL. */
export function localNameFor(url: string, index: number): string {
  try {
    const u = new URL(url);
    const base = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const safe = base.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 60);
    if (safe && /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(safe)) {
      return `${String(index).padStart(2, "0")}-${safe}`;
    }
    const ext = (safe.match(/\.[a-zA-Z]{2,5}$/)?.[0] ?? "").toLowerCase();
    return `${String(index).padStart(2, "0")}-image${ext || ".bin"}`;
  } catch {
    return `${String(index).padStart(2, "0")}-image.bin`;
  }
}

/**
 * Download one image via curl. Returns bytes downloaded, or -1 on failure.
 *
 * Atomic-write semantics: curl writes to `<destPath>.part`, we verify the
 * file is non-empty, then rename into place. A crash mid-download leaves
 * the `.part` turd (cleaned up on retry or by the stale-cleanup pass) but
 * never a half-written `destPath` that would pass an existsSync() check
 * and get silently accepted as "downloaded".
 */
export function downloadImage(url: string, destPath: string, maxBytes = 15 * 1024 * 1024): number {
  const tmpPath = `${destPath}.part`;
  // curl with max-filesize, connect-timeout, and output to disk. Returns 0 on success.
  const res = spawnSync(
    "curl",
    [
      "-fsSL",
      "--max-filesize", String(maxBytes),
      "--connect-timeout", "10",
      "--max-time", "30",
      "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "-o", tmpPath,
      url,
    ],
    { encoding: "utf8", timeout: 40_000 },
  );
  if (res.status !== 0) {
    try { if (existsSync(tmpPath)) rmSync(tmpPath, { force: true }); } catch {}
    return -1;
  }
  let size = -1;
  try { size = statSync(tmpPath).size; } catch { size = -1; }
  if (size <= 0) {
    try { if (existsSync(tmpPath)) rmSync(tmpPath, { force: true }); } catch {}
    return -1;
  }
  try {
    renameSync(tmpPath, destPath);
  } catch {
    try { if (existsSync(tmpPath)) rmSync(tmpPath, { force: true }); } catch {}
    return -1;
  }
  return size;
}

/** Download images + rewrite references in the markdown to local paths. */
export function processImages(content: string, slugDir: string, enabled: boolean, originUrl?: string): { content: string; images: ImageRecord[]; notes: string[] } {
  if (!enabled) return { content, images: [], notes: ["images: skipped (--no-images)"] };
  const all = extractImageUrls(content);
  // Resolve site-relative refs (only starting with `/` or `../`) against
  // originUrl when present. Without this, opencli's URL-stripping (lmsys,
  // csdn, etc.) leaves `/images/foo.png` refs that processImages can't
  // download because they aren't http(s) URLs. Refs like `images/img_001.png`
  // or `01-foo.png` are left alone — those are already-local filenames the
  // adapter produced, and resolving them against origin would generate a
  // bogus remote URL and 404.
  let rewritten = content;
  const downloadList: Array<{ ref: string; url: string }> = [];
  for (const ref of all) {
    if (/^https?:\/\//i.test(ref)) {
      downloadList.push({ ref, url: ref });
      continue;
    }
    if (!originUrl) continue;
    // Only resolve root-anchored (/foo) or explicit relative (./foo, ../foo).
    // Bare `foo.png` or `images/foo.png` are already-local filenames.
    if (!/^(?:\/|\.\.?\/)/.test(ref)) continue;
    try {
      const abs = new URL(ref, originUrl).toString();
      if (/^https?:\/\//i.test(abs)) downloadList.push({ ref, url: abs });
    } catch {
      // Unresolvable — leave as-is
    }
  }
  if (downloadList.length === 0) return { content, images: [], notes: [] };
  const records: ImageRecord[] = [];
  const notes: string[] = [];
  downloadList.forEach(({ ref, url }, i) => {
    let local = localNameFor(url, i + 1);
    let dest = join(slugDir, local);
    const bytes = downloadImage(url, dest);
    if (bytes < 0) {
      notes.push(`image download failed: ${url}`);
      return;
    }
    // If the URL had no recognizable extension, localNameFor defaults to
    // ".bin" — sniff the file's magic bytes and rename to the real type
    // so viewers + downstream uploaders see a proper image extension.
    if (local.endsWith(".bin")) {
      const realExt = sniffImageExtension(dest);
      if (realExt) {
        const newLocal = local.replace(/\.bin$/, "." + realExt);
        const newDest = join(slugDir, newLocal);
        try { renameSync(dest, newDest); local = newLocal; dest = newDest; } catch {}
      }
    }
    records.push({ local, remote: url, bytes });
    // Rewrite the ORIGINAL ref in markdown (may be absolute or relative).
    rewritten = rewritten.split(ref).join(local);
  });
  return { content: rewritten, images: records, notes };
}

/**
 * Sniff an image file's magic bytes and return the canonical extension
 * (no leading dot), or null if not a recognized image format.
 */
function sniffImageExtension(path: string): string | null {
  try {
    const fd = openSync(path, "r");
    const buf = Buffer.alloc(16);
    const n = readSync(fd, buf, 0, 16, 0);
    closeSync(fd);
    if (n < 4) return null;
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return "png";
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return "jpg";
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "gif";
    if (n >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "webp";
    if (buf[0] === 0x3C) {
      const head = buf.toString("utf8", 0, n).toLowerCase();
      if (head.startsWith("<?xml") || head.startsWith("<svg")) return "svg";
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// the write step — common to all fetchers
// ---------------------------------------------------------------------------

interface WriteArgs {
  slug: string;
  origin: string;
  originUrl: string;
  rawMarkdown: string;
  title?: string;
  fetcher: FetcherKind;
  fetcherReason: FetcherReason;
  raindropMeta?: RaindropMeta;
  larkMeta?: LarkMeta;
  qualityFlags?: string[];
  extraNotes?: string[];
  /** If true, run our own image extraction/download over the markdown. Set false when an adapter already populated slugDir with image files. */
  downloadImages: boolean;
  /** Images already saved to slugDir by an upstream adapter; merged into source.json.images as-is. */
  preExistingImages?: ImageRecord[];
  force: boolean;
}

export function writeRawArchive(args: WriteArgs): SourceJson {
  const slugDir = rawDirFor(args.slug);
  mkdirSync(slugDir, { recursive: true });

  // Append-only: existing content.md → write content-revN.md instead of overwriting.
  let contentFile = "content.md";
  if (existsSync(join(slugDir, "content.md")) && !args.force) {
    let n = 2;
    while (existsSync(join(slugDir, `content-rev${n}.md`))) n++;
    contentFile = `content-rev${n}.md`;
  }

  // Prepend a title if we have one and the body doesn't already start with H1.
  let md = args.rawMarkdown.trim() + "\n";
  if (args.title && !/^#\s+/m.test(md.slice(0, 200))) {
    md = `# ${args.title}\n\n${md}`;
  }

  // Image handling: either our own download/rewrite pass, or trust the adapter.
  let images: ImageRecord[] = args.preExistingImages ?? [];
  let imgNotes: string[] = [];
  if (args.downloadImages) {
    const r = processImages(md, slugDir, true);
    md = r.content;
    images = [...images, ...r.images];
    imgNotes = r.notes;
  }

  writeFileAtomic(join(slugDir, contentFile), md);

  // Derive declared-image count from the final markdown (after rewrites). If
  // the content references images but the images array is empty, that's
  // an adapter silently-failed download — classifyQuality flags it.
  const declaredImageCount = extractImageUrls(md).length;

  const { suspicious, flags: qualityFlags, quality_status } = classifyQuality(md, {
    declaredImageCount,
    downloadedImageCount: images.length,
    extraFlags: args.qualityFlags,
    originUrl: args.originUrl,
  });

  const src: SourceJson = {
    fetched_at: new Date().toISOString(),
    origin: args.origin,
    origin_url: args.originUrl,
    fetcher: args.fetcher,
    fetcher_reason: args.fetcherReason,
    content_sha: sha256(md),
    content_length: md.length,
    quality_flags: qualityFlags,
    quality_status,
    images,
    notes: [...(args.extraNotes ?? []), ...imgNotes],
    raindrop_meta: args.raindropMeta,
    lark_meta: args.larkMeta,
  };
  writeFileAtomic(join(slugDir, "source.json"), JSON.stringify(src, null, 2) + "\n");

  if (suspicious) {
    logL2Issue(args.slug, qualityFlags.join(","), args.originUrl);
  }
  return src;
}

// ---------------------------------------------------------------------------
// opencli native adapters
// ---------------------------------------------------------------------------

export function runOpencli(args: string[], opts: { timeoutMs?: number } = {}): string {
  const res = spawnSync("opencli", args, {
    encoding: "utf8",
    timeout: opts.timeoutMs ?? 90_000,
    maxBuffer: 30 * 1024 * 1024,
  });
  if (res.status !== 0) {
    // Classify by stderr content where we can.
    const stderr = (res.stderr ?? "").trim();
    if (/extension.*(offline|disconnect|not connected)/i.test(stderr)) {
      throw makeError("extension-offline", "L3", `opencli extension offline: ${stderr.slice(0, 200)}`,
        { remediation: "run `opencli doctor`; reconnect the Chrome Bridge extension" });
    }
    if (/login|sign in|未登录|please log in/i.test(stderr)) {
      throw makeError("login-expired", "L3", `opencli requires login: ${stderr.slice(0, 200)}`,
        { remediation: "log into the target site in the opencli-connected Chrome, then retry" });
    }
    throw makeError(
      "opencli-error", "L3",
      `opencli ${args.join(" ").slice(0, 160)} failed (exit ${res.status}): ${stderr.slice(0, 200)}`,
    );
  }
  return res.stdout;
}

export function opencliDoctorOk(): boolean {
  const out = spawnSync("opencli", ["doctor"], { encoding: "utf8", timeout: browserTimeoutMs("doctor") });
  return out.stdout.includes("[OK] Extension:") && out.stdout.includes("[OK] Connectivity:");
}

/**
 * Browser timeout knobs. Defaults match the hard-coded values used
 * throughout the browser extractors; each can be overridden via the
 * corresponding env var for operators running on slower machines or
 * behind a slow SPA. Kept small so values stay readable next to their
 * call sites.
 *
 * Not a total-wall-clock budget for the whole adapter; per-call timeouts
 * combined with the module-wide opencli lock (H1.2) are sufficient
 * bounds — a hung browser blocks only the next acquirer, never the
 * whole batch.
 */
export function browserTimeoutMs(
  kind: "open" | "eval" | "close" | "doctor",
): number {
  const envMap: Record<typeof kind, { env: string; def: number }> = {
    open:   { env: "HIRONO_BROWSER_OPEN_TIMEOUT_MS",   def: 30_000 },
    eval:   { env: "HIRONO_BROWSER_EVAL_TIMEOUT_MS",   def: 15_000 },
    close:  { env: "HIRONO_BROWSER_CLOSE_TIMEOUT_MS",  def: 5_000 },
    doctor: { env: "HIRONO_BROWSER_DOCTOR_TIMEOUT_MS", def: 10_000 },
  };
  const spec = envMap[kind];
  const raw = process.env[spec.env];
  if (!raw) return spec.def;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return spec.def;
  return n;
}

/**
 * Several opencli adapters' `download`-style subcommands save a Markdown file
 * + image assets into `--output <dir>`, and print a JSON summary to stdout
 * when run with `-f json`. We read the summary, find the saved markdown, move
 * / rename to our canonical `content.md`, and keep images in place.
 */
interface AdapterResult {
  markdown: string;      // content of the markdown file, read into memory
  title?: string;
  imageFiles: string[];  // assets saved alongside the markdown (basenames, relative to slugDir)
  rawMetadata: unknown;  // whatever the adapter returned on stdout
  /** Optional adapter-issued quality flags to merge into classifyQuality. Empty when nothing extra to report. */
  extraFlags?: string[];
  /** Optional notes from the adapter (e.g. "xhs download retried once"). */
  adapterNotes?: string[];
}

/**
 * opencli download adapters (weixin, zhihu, xiaohongshu, web read) save artifacts
 * into a title-named subdirectory of --output, e.g.:
 *   <slugDir>/<article-title>/<article-title>.md
 *   <slugDir>/<article-title>/images/img_001.png
 *
 * This helper flattens that subdirectory into slugDir:
 *   <slugDir>/content.md          (renamed)
 *   <slugDir>/images/img_001.png  (moved up one level)
 * Relative image paths in the markdown (`images/img_001.png`) keep resolving
 * after the move — both .md and images/ shift up by the same amount.
 *
 * Returns the flattened markdown content + list of image-file basenames
 * (with `images/` prefix where applicable).
 */
/**
 * Harvest result. `errors` collects any filesystem-level issues we hit
 * during the walk (failed statSync, failed renameSync, etc.). The caller
 * uses its emptiness as an "is this output complete?" signal — a non-
 * empty list raises `adapter-output-partial` on quality_flags so the
 * user knows some assets may have been lost even though the fetch
 * "succeeded" overall.
 */
export interface HarvestResult {
  content: string;
  images: string[];
  errors: string[];
}

export function harvestAdapterOutput(slugDir: string, afterMtime: number): HarvestResult {
  const errors: string[] = [];

  // Find the subdirectory (there should be at most one, named after article title)
  const dirEntries = readdirSync(slugDir, { withFileTypes: true });
  const subdirs = dirEntries.filter((e) => e.isDirectory() && !e.name.startsWith("."));

  // Case A: opencli wrote directly to slugDir (not always, but handle it)
  let mdSource: string | null = null;
  const flatImagesAtRoot: string[] = [];
  for (const e of dirEntries) {
    if (!e.isFile()) continue;
    const full = join(slugDir, e.name);
    try {
      const st = statSync(full);
      if (st.mtimeMs < afterMtime) continue;
      if (/\.md$/i.test(e.name)) mdSource = full;
      else if (/\.(png|jpe?g|webp|gif|svg|mp4|mov|avif)$/i.test(e.name)) flatImagesAtRoot.push(e.name);
    } catch (err) {
      errors.push(`stat failed on ${e.name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (mdSource && subdirs.length === 0) {
    // Flat; just read it.
    return {
      content: readFileSync(mdSource, "utf8"),
      images: flatImagesAtRoot,
      errors,
    };
  }

  // Case B: artifacts live inside a title-named subdirectory.
  // Pick the most-recently-modified subdir as the one we just created.
  let target: string | null = null;
  let bestMtime = 0;
  for (const sub of subdirs) {
    const full = join(slugDir, sub.name);
    try {
      const st = statSync(full);
      if (st.mtimeMs > afterMtime - 1000 && st.mtimeMs > bestMtime) {
        target = full;
        bestMtime = st.mtimeMs;
      }
    } catch (err) {
      errors.push(`stat failed on subdir ${sub.name}: ${err instanceof Error ? err.message : err}`);
    }
  }
  if (!target) {
    throw makeError(
      "parse-failure", "L3",
      `opencli produced no markdown in ${slugDir} (checked flat + subdirectories)`,
      { remediation: "inspect the raw/ dir for what was produced; adapter may have silently failed" },
    );
  }

  // Walk the subdir, collect md + images. Move everything up one level.
  const imagesMoved: string[] = [];
  let finalMdSource: string | null = null;

  function walk(currentAbs: string, relFromTarget: string) {
    for (const entry of readdirSync(currentAbs, { withFileTypes: true })) {
      const src = join(currentAbs, entry.name);
      const relNew = relFromTarget ? join(relFromTarget, entry.name) : entry.name;
      const dst = join(slugDir, relNew);
      if (entry.isDirectory()) {
        mkdirSync(dst, { recursive: true });
        walk(src, relNew);
        continue;
      }
      if (/\.md$/i.test(entry.name)) {
        finalMdSource = src;  // we'll handle this specially below
        continue;
      }
      // Ensure parent dir exists
      mkdirSync(dirname(dst), { recursive: true });
      try {
        renameSync(src, dst);
      } catch (err) {
        // Image-move failure — log and continue. Skipping the push means
        // this image WON'T appear in the returned images list, which
        // correctly surfaces the loss to downstream classifiers.
        errors.push(`rename ${entry.name} → ${relNew} failed: ${err instanceof Error ? err.message : err}`);
        continue;
      }
      if (/\.(png|jpe?g|webp|gif|svg|mp4|mov|avif)$/i.test(entry.name)) {
        imagesMoved.push(relNew);
      }
    }
  }
  walk(target, "");

  if (!finalMdSource) {
    throw makeError(
      "parse-failure", "L3",
      `opencli subdir ${target} contained no .md file`,
      { remediation: "inspect opencli stdout for errors" },
    );
  }

  const content = readFileSync(finalMdSource, "utf8");
  // Clean up: remove the now-processed subdirectory (md file still inside — safe to rm)
  try {
    rmSync(target, { recursive: true, force: true });
  } catch (err) {
    errors.push(`cleanup rmSync ${target} failed: ${err instanceof Error ? err.message : err}`);
  }

  return {
    content,
    images: [...flatImagesAtRoot, ...imagesMoved],
    errors,
  };
}

function tryParseJsonLines(stdout: string): unknown {
  // opencli -f json often prints a JSON object. Sometimes it prefixes with status lines.
  // Find the first '{' or '[' and parse from there.
  const firstBrace = stdout.search(/[{[]/);
  if (firstBrace < 0) return null;
  try {
    return JSON.parse(stdout.slice(firstBrace));
  } catch {
    return null;
  }
}

/**
 * Native xhs adapter. Unlike wechat/zhihu, xhs needs TWO calls:
 *   - `xiaohongshu note <url> -f md` → stdout markdown (body + interaction data)
 *   - `xiaohongshu download <url> --output <dir>` → images/videos, saved flat as
 *                                                     <noteid>_N.jpg at the dir root
 *     (no nested subdir like wechat; no .md file from download.)
 * We combine: use `note` for markdown, `download` for assets, then append an
 * asset-list section to the markdown.
 */
/**
 * Scan slugDir for image/video files whose mtime says they were created by the
 * most recent download call. Encapsulates the "did this download attempt
 * actually produce files?" check so both the initial call and the retry use
 * the same logic.
 */
/**
 * Collect xhs-downloaded images. As of opencli 1.7.4+, `xiaohongshu download`
 * saves images into a `<note-id>/` subdirectory, not flat at slugDir root.
 * We flatten them back up to slugDir so our filename references in the
 * assembled markdown stay simple.
 *
 * Returns basenames relative to slugDir (either plain filename if already
 * flat, or empty string for files we moved up).
 */
export function collectXhsAssets(slugDir: string, afterMtime: number): string[] {
  const files: string[] = [];
  const imageExt = /\.(jpe?g|png|webp|mp4|mov|gif|avif)$/i;

  // Pass 1: pick up any flat files at slugDir root (legacy/future behavior)
  for (const f of readdirSync(slugDir)) {
    try {
      const full = join(slugDir, f);
      const st = statSync(full);
      if (st.isFile() && st.mtimeMs >= afterMtime - 1000 && imageExt.test(f)) {
        files.push(f);
      }
    } catch {}
  }

  // Pass 2: check subdirectories created by opencli (e.g. `<note-id>/`).
  // Move all image files up to slugDir root + remove the empty subdir.
  for (const entry of readdirSync(slugDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const subdir = join(slugDir, entry.name);
    let subdirHasRecentFiles = false;
    try {
      const subdirStat = statSync(subdir);
      if (subdirStat.mtimeMs < afterMtime - 1000) continue;
      for (const childName of readdirSync(subdir)) {
        const childFull = join(subdir, childName);
        try {
          const childStat = statSync(childFull);
          if (!childStat.isFile() || !imageExt.test(childName)) continue;
          subdirHasRecentFiles = true;
          // Move up to slugDir, disambiguating if a same-named file already exists
          const destName = existsSync(join(slugDir, childName))
            ? `${entry.name}_${childName}`
            : childName;
          try {
            renameSync(childFull, join(slugDir, destName));
            files.push(destName);
          } catch {}
        } catch {}
      }
      // Remove now-empty subdir (or try)
      if (subdirHasRecentFiles) {
        try { rmSync(subdir, { recursive: true, force: true }); } catch {}
      }
    } catch {}
  }
  return files;
}

/** Small blocking sleep (we're serial + deliberate here; no Node event-loop concerns). */
export function sleepMs(ms: number): void {
  const end = Date.now() + ms;
  // Spin-wait with Atomics to avoid burning CPU needlessly — allowed here.
  const sab = new SharedArrayBuffer(4);
  const i32 = new Int32Array(sab);
  while (Date.now() < end) {
    // Atomics.wait blocks for up to `timeout` ms. Using a never-signaled buffer
    // so it simply waits the full interval.
    Atomics.wait(i32, 0, 0, Math.min(200, end - Date.now()));
  }
}

/**
 * Resolve an xhs URL (xhslink shortlink or any xiaohongshu.com URL with
 * possibly-stale xsec_token) to its current canonical URL with a fresh,
 * session-valid xsec_token. Uses opencli's browser bridge, which inherits
 * the user's logged-in xhs cookies.
 *
 * Two-step dance:
 *   1. `opencli browser open <url>` — navigate; xhs redirects/refreshes
 *      tokens server-side
 *   2. `opencli browser eval 'window.location.href'` — read the final URL
 *
 * Returns the resolved URL (with fresh xsec_token) on success, null if
 * the browser navigation or eval failed. On success the browser is left
 * open — caller must close it or it'll be closed on next adapter invocation.
 */
function resolveXhsViaBrowser(url: string): string | null {
  // NOTE: we deliberately do NOT close the browser in the success path — the
  // caller (fetchXhsViaAdapter) runs further `opencli browser` commands after
  // us in the same session. The caller is responsible for closing via a
  // finally block. This function's OWN finally block only runs if WE throw;
  // in that case the caller's finally will have already fired by the time it
  // matters.
  let browserOpened = false;
  try {
    // Navigate. This can 200, 404 from xhslink, etc. — we swallow and check eval.
    spawnSync("opencli", ["browser", "open", url], { encoding: "utf8", timeout: browserTimeoutMs("open") });
    browserOpened = true;
    // Let xhs's JS run a beat; in practice ≤1s is plenty for redirects.
    sleepMs(2000);
    const res = spawnSync("opencli", ["browser", "eval", "window.location.href"], {
      encoding: "utf8",
      timeout: browserTimeoutMs("eval"),
    });
    if (res.status !== 0) return null;
    // stdout contains the URL possibly followed by opencli version notice; first
    // non-empty line starting with http is our answer.
    for (const line of (res.stdout || "").split("\n")) {
      const t = line.trim();
      if (/^https?:\/\/(?:www\.)?xiaohongshu\.com\//.test(t)) {
        return t;
      }
    }
    return null;
  } catch {
    // Throw path: if WE opened the browser and our caller might not know,
    // close defensively before returning null.
    if (browserOpened) closeBrowser();
    return null;
  }
}

/**
 * Close the opencli browser tab if open. Best-effort — failures are ignored.
 */
export function closeBrowser(): void {
  try { spawnSync("opencli", ["browser", "close"], { encoding: "utf8", timeout: browserTimeoutMs("close") }); } catch {}
}

/**
 * Extract image URLs from the live xhs post DOM in display order. Opens the
 * URL in opencli's browser (which has user cookies), filters `<img>` elements
 * by minimum size (to skip avatars + UI icons), and dedupes by final URL
 * segment (xhs's carousel often repeats each image as a thumbnail).
 *
 * Returns the absolute URL list in author-intended display order, or an
 * empty array on any failure.
 */
/**
 * Result of DOM-based image extraction. `urls` holds the ordered image URLs
 * (possibly empty — a legitimate "no large images on this post"); `error`
 * is set ONLY when the DOM query itself failed (browser open/eval threw,
 * non-zero exit, unparseable output). This lets the caller distinguish
 * "no images to reorder" from "extractor broken; flag quality".
 */
export interface XhsDomExtractResult {
  urls: string[];
  error?: string;
}

/**
 * Combined Layer-4 xhs extractor: opens the page in opencli's browser,
 * extracts body text + metadata + image URLs in a single eval pass, and
 * closes the session. Returns everything the new converter needs.
 *
 * Body comes from `#detail-desc.textContent` — preserves the `\n\t\n`
 * paragraph separators that opencli's `xiaohongshu note` collapses.
 * Image URLs use the same carousel-dedup logic as
 * `extractXhsImageUrlsInOrder` (sort by `left` position, drop wrap-around
 * negatives, dedupe by image-id segment).
 */
export interface XhsFullContent {
  title: string;
  descText: string;
  author: string;
  likes?: string;
  collects?: string;
  comments?: string;
  imageUrls: string[];
  /** Resolved final URL after any redirects (e.g. xhslink.com → xiaohongshu.com/discovery/item/<noteid>). */
  finalUrl?: string;
  error?: string;
}

export function extractXhsFullContent(url: string): XhsFullContent {
  let browserOpened = false;
  try {
    spawnSync("opencli", ["browser", "open", url], { encoding: "utf8", timeout: browserTimeoutMs("open") });
    browserOpened = true;
    sleepMs(3500);
    const evalScript = `(() => {
      const t = document.querySelector("#detail-title");
      const d = document.querySelector("#detail-desc");
      const author = document.querySelector(".author .name") || document.querySelector("a.name") || document.querySelector("span.username");
      // Stats: walk .interactions .count, but skip per-comment likes (each
      // comment has its own like-wrapper). The article-level stats live in
      // .engage-bar (or similar footer container); they are LAST in DOM
      // order. Strategy: filter out any count whose ancestor is a comment
      // node (.parent-comment / .comment-item / .reply-container), then
      // take the last seen for each category — equivalently, skip counts
      // inside comment containers entirely.
      const stats = { likes: "", collects: "", comments: "" };
      document.querySelectorAll(".interactions .count").forEach(c => {
        // Exclude counts inside any comment container.
        if (c.closest(".parent-comment, .comment-item, .reply-container, .comment-content")) return;
        const txt = (c.textContent || "").trim();
        if (!txt || /^[^0-9]+$/.test(txt)) return;
        const par = c.closest(".like-wrapper, .collect-wrapper, .chat-wrapper");
        if (!par) return;
        if (par.className.indexOf("collect") >= 0) stats.collects = txt;
        else if (par.className.indexOf("chat") >= 0) stats.comments = txt;
        else stats.likes = txt;
      });
      // Images — same carousel-dedup as extractXhsImageUrlsInOrder, plus
      // exclusion of any image inside a comment container (xhs comments
      // can include attached images that match our width/CDN filters but
      // are not part of the note body).
      const items = Array.from(document.querySelectorAll("img"))
        .filter(i => {
          const w = i.naturalWidth || i.width;
          if (!(w >= 400 && i.src.indexOf("xhscdn") > 0)) return false;
          if (i.closest(".parent-comment, .comment-item, .reply-container, .comment-content")) return false;
          return true;
        })
        .map(i => ({ src: i.src, left: Math.round(i.getBoundingClientRect().left) }))
        .filter(it => typeof it.left === "number" && it.left >= 0)
        .sort((a, b) => a.left - b.left);
      const seen = new Set();
      const imageUrls = [];
      for (const it of items) {
        const m = it.src.match(/\\/([^/!]+)!/);
        const key = m ? m[1] : it.src;
        if (seen.has(key)) continue;
        seen.add(key);
        imageUrls.push(it.src);
      }
      return JSON.stringify({
        title: t ? (t.textContent || "").trim() : "",
        descText: d ? (d.textContent || "") : "",
        author: author ? (author.textContent || "").trim().replace(/关注$/, "").trim() : "",
        likes: stats.likes,
        collects: stats.collects,
        comments: stats.comments,
        imageUrls,
        finalUrl: window.location.href,
      });
    })()`;
    const res = spawnSync("opencli", ["browser", "eval", evalScript], {
      encoding: "utf8",
      timeout: browserTimeoutMs("eval"),
      maxBuffer: 8 * 1024 * 1024,
    });
    if (res.status !== 0) {
      return { title: "", descText: "", author: "", imageUrls: [], error: `eval exited ${res.status}` };
    }
    const stdout = res.stdout || "";
    const start = stdout.indexOf("{");
    if (start < 0) return { title: "", descText: "", author: "", imageUrls: [], error: "no JSON object in eval output" };
    let depth = 0, end = -1, inStr = false, esc = false;
    for (let i = start; i < stdout.length; i++) {
      const c = stdout[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === "\"") { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) return { title: "", descText: "", author: "", imageUrls: [], error: "unterminated JSON object" };
    try {
      const parsed = JSON.parse(stdout.slice(start, end + 1));
      return {
        title: parsed.title || "",
        descText: parsed.descText || "",
        author: parsed.author || "",
        likes: parsed.likes || undefined,
        collects: parsed.collects || undefined,
        comments: parsed.comments || undefined,
        imageUrls: Array.isArray(parsed.imageUrls) ? parsed.imageUrls : [],
        finalUrl: parsed.finalUrl || undefined,
      };
    } catch (e) {
      return { title: "", descText: "", author: "", imageUrls: [], error: `JSON parse failed: ${e instanceof Error ? e.message : e}` };
    }
  } catch (e) {
    return { title: "", descText: "", author: "", imageUrls: [], error: `extractXhsFullContent threw: ${e instanceof Error ? e.message : e}` };
  } finally {
    if (browserOpened) closeBrowser();
  }
}

export function extractXhsImageUrlsInOrder(url: string): XhsDomExtractResult {
  // Browser lifetime is fully owned by this function — open at the top,
  // close in finally so any throw or early return still frees the tab.
  let browserOpened = false;
  try {
    spawnSync("opencli", ["browser", "open", url], { encoding: "utf8", timeout: browserTimeoutMs("open") });
    browserOpened = true;
    sleepMs(3_000);
    // Extract {src, left} per image — we need the horizontal viewport position
    // because xhs's carousel is circular: the LAST image is duplicated to the
    // LEFT of the cover (at a negative X offset) for wrap-around scrolling.
    // DOM order alone puts that wrap-around copy FIRST, which is wrong.
    // Sorting by `left` (ascending), filtering out negative-left wrap-arounds,
    // and deduping by image ID gives the author's actual display order.
    // Filter: width >=400, xhscdn URL, AND not inside a comment container
    // (xhs comments can have attached images that match the size+CDN
    // filters but aren't part of the note body).
    const js = "JSON.stringify(Array.from(document.querySelectorAll('img'))"
      + ".filter(function(i){var w=i.naturalWidth||i.width;"
      + "if(!(w>=400 && i.src.indexOf('xhscdn')>0))return false;"
      + "if(i.closest('.parent-comment, .comment-item, .reply-container, .comment-content'))return false;"
      + "return true;})"
      + ".map(function(i){return {src:i.src, left:Math.round(i.getBoundingClientRect().left)}}))";
    const res = spawnSync("opencli", ["browser", "eval", js], {
      encoding: "utf8",
      timeout: browserTimeoutMs("eval"),
      maxBuffer: 4 * 1024 * 1024,
    });
    if (res.status !== 0) {
      return { urls: [], error: `browser eval exited ${res.status}` };
    }
    const stdout = res.stdout || "";
    const jsonStart = stdout.indexOf("[");
    if (jsonStart < 0) {
      return { urls: [], error: "no JSON array in eval output" };
    }
    let depth = 0;
    let jsonEnd = -1;
    for (let i = jsonStart; i < stdout.length; i++) {
      if (stdout[i] === "[") depth++;
      else if (stdout[i] === "]") { depth--; if (depth === 0) { jsonEnd = i; break; } }
    }
    if (jsonEnd < 0) {
      return { urls: [], error: "unterminated JSON array in eval output" };
    }
    let items: Array<{ src: string; left: number }>;
    try {
      const parsed = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1));
      items = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return { urls: [], error: `JSON parse failed: ${e instanceof Error ? e.message : e}` };
    }
    // Step 1: drop wrap-around copies positioned off-screen to the left.
    //   negative `left` means the carousel placed this image before the
    //   actual first slot for circular-scroll preview.
    const visible = items.filter((it) => typeof it.left === "number" && it.left >= 0);
    // Step 2: sort by `left` ascending — this is the author's canonical order.
    visible.sort((a, b) => a.left - b.left);
    // Step 3: dedupe by xhs image ID. xhs uses several CDN paths —
    // `/spectrum/`, `/notes_uhdr/`, etc. — and sometimes serves the same
    // image over both `https://` and `http://` in the same page. Extract
    // the image ID as the last path segment before `!` (which precedes
    // the encoding-param tail like `!nd_dft_wlteh_webp_3`). This is a
    // stable identifier across CDN-path / protocol / timestamp variations.
    const seen = new Set<string>();
    const out: string[] = [];
    for (const it of visible) {
      if (typeof it.src !== "string") continue;
      // Prefer the `<segment>!` pattern (present on all xhs CDN URLs).
      // Fall back to full src if not found (shouldn't happen for xhscdn).
      const m = it.src.match(/\/([^/!]+)!/);
      const key = m ? m[1] : it.src;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it.src);
    }
    // Successful extraction — 0 urls is a valid outcome (non-image post).
    return { urls: out };
  } catch (e) {
    return {
      urls: [],
      error: `extractXhsImageUrlsInOrder threw: ${e instanceof Error ? e.message : e}`,
    };
  } finally {
    if (browserOpened) closeBrowser();
  }
}

/**
 * Download a remote URL to `destPath` via curl. Returns true on success.
 * Used by the xhs DOM-order reorder path — we can't rely on opencli to
 * give us the image URLs, so we fetch them ourselves in display order.
 *
 * Atomic: curl writes to `<destPath>.part`, size is verified (>1000 bytes
 * to filter out xhs's placeholder-error stubs), then renamed into place.
 */
export function downloadImageToPath(url: string, destPath: string): boolean {
  const tmpPath = `${destPath}.part`;
  const res = spawnSync(
    "curl",
    [
      "-fsSL",
      "--max-filesize", "20971520",  // 20 MB cap
      "--connect-timeout", "10",
      "--max-time", "45",
      "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "-H", "Referer: https://www.xiaohongshu.com/",
      "-o", tmpPath,
      url,
    ],
    { encoding: "utf8", timeout: 60_000 },
  );
  if (res.status !== 0) {
    try { if (existsSync(tmpPath)) rmSync(tmpPath, { force: true }); } catch {}
    return false;
  }
  let ok = false;
  try { ok = statSync(tmpPath).size > 1000; } catch { ok = false; }
  if (!ok) {
    try { if (existsSync(tmpPath)) rmSync(tmpPath, { force: true }); } catch {}
    return false;
  }
  try {
    renameSync(tmpPath, destPath);
  } catch {
    try { if (existsSync(tmpPath)) rmSync(tmpPath, { force: true }); } catch {}
    return false;
  }
  return true;
}

/**
 * After opencli's `xiaohongshu download` has saved image files to slugDir
 * with its own `_1.jpg`-style ordering (which may NOT match the author's
 * intended display order), re-fetch images from the live xhs DOM in
 * display order and replace opencli's files. Returns the ordered list of
 * local filenames (`_01.jpg`, `_02.jpg`, ...); falls back to the
 * opencli-provided list on any failure.
 *
 * Strategy:
 *   1. Extract image URLs from the live post DOM (display order, deduped)
 *   2. Download each into `<noteid>_01.jpg`, `_02.jpg`, ... (zero-padded
 *      for cross-tool sort stability)
 *   3. Delete opencli's `_1.jpg` through `_N.jpg` files (they're the same
 *      images in a different order; keep disk tidy)
 *   4. Return the new ordered list
 */
/**
 * Reorder result: `files` is the final ordered image list (or opencli's
 * original if we couldn't improve), `error` is set ONLY when the DOM
 * extractor itself failed — lets the caller push `xhs-dom-extraction-failed`
 * onto quality_flags without conflating "no reorder needed" with
 * "reorder broken".
 */
interface XhsReorderResult {
  files: string[];
  error?: string;
}

export function reorderXhsImagesByDomPosition(
  url: string,
  slugDir: string,
  opencliFiles: string[],
  noteId: string | null,
): XhsReorderResult {
  if (opencliFiles.length === 0) return { files: opencliFiles };
  const extraction = extractXhsImageUrlsInOrder(url);
  if (extraction.error) {
    // DOM query failed. Surface the error; keep opencli's order.
    return { files: opencliFiles, error: extraction.error };
  }
  const orderedUrls = extraction.urls;
  if (orderedUrls.length === 0) return { files: opencliFiles };
  // Count-sanity:
  //   DOM == opencli  → normal case, reorder 1:1
  //   DOM <  opencli  → opencli has duplicates (e.g. same image returned
  //                     twice by the xhs note API). DOM's dedupe by ID is
  //                     authoritative — use DOM count, delete extras.
  //   DOM >  opencli  → something weird; trust opencli to avoid data loss.
  if (orderedUrls.length > opencliFiles.length) return { files: opencliFiles };

  const prefix = noteId || opencliFiles[0].replace(/_\d+\.[a-z]+$/i, "");
  // Pad to at least 2 digits so new filenames DIFFER from opencli's
  // `_1.jpg`..`_8.jpg` single-digit naming. Otherwise name collision
  // causes the "delete opencli's files" step to delete our own downloads.
  const pad = Math.max(2, String(orderedUrls.length).length);
  const newFiles: string[] = [];
  for (let i = 0; i < orderedUrls.length; i++) {
    const ext = (orderedUrls[i].match(/\.(jpe?g|png|webp)(?:\?|$)/i)?.[1] ?? "jpg").toLowerCase();
    const name = `${prefix}_${String(i + 1).padStart(pad, "0")}.${ext === "jpeg" ? "jpg" : ext}`;
    const dest = join(slugDir, name);
    const ok = downloadImageToPath(orderedUrls[i], dest);
    if (!ok) {
      // Clean up partial downloads before aborting; keep opencli's originals
      for (const partial of newFiles) {
        try { rmSync(join(slugDir, partial), { force: true }); } catch {}
      }
      return { files: opencliFiles };
    }
    newFiles.push(name);
  }
  // Success — delete opencli's originals. Name collision is impossible now
  // because pad ≥ 2 ensures newFiles use `_01..._NN` while opencli used
  // `_1..._N`. Belt-and-suspenders: skip deleting any file whose name
  // appears in newFiles.
  const newSet = new Set(newFiles);
  for (const f of opencliFiles) {
    if (newSet.has(f)) continue;
    try { rmSync(join(slugDir, f), { force: true }); } catch {}
  }
  return { files: newFiles };
}

/**
 * Clean an xhs title for use as a search query. Strips the "小红书" suffix
 * (often appended to titles) and trims.
 */
function xhsSearchQuery(title: string): string {
  return title
    .replace(/\s*-?\s*小红书\s*$/, "")
    .trim()
    .slice(0, 80);
}

/**
 * Extract note-id from an xhs URL (full or xhslink form). Returns null if
 * the URL doesn't look like an xhs URL we recognize.
 */
export function extractXhsNoteId(url: string): string | null {
  // Full URL form: /discovery/item/<noteid> or /explore/<noteid> or /search_result/<noteid>
  const m = url.match(/\/(?:discovery\/item|explore|search_result)\/([a-f0-9]+)/i);
  if (m) return m[1];
  return null;
}

/**
 * Try to rescue a stale xsec_token URL by searching xhs for the note's
 * title. Returns a fresh search-result URL on a match, null otherwise.
 *
 * Strategy: search by title, check that the top result's note_id (if we
 * know ours) matches. If no id to verify, trust the top result if the
 * title substring matches.
 */
function findFreshXhsUrl(titleHint: string, originalUrl: string): string | null {
  if (!titleHint) return null;
  const query = xhsSearchQuery(titleHint);
  if (!query) return null;
  const targetId = extractXhsNoteId(originalUrl);
  let searchStdout = "";
  try {
    searchStdout = runOpencli(
      ["xiaohongshu", "search", query, "-f", "json", "--limit", "5"],
      { timeoutMs: 60_000 },
    );
  } catch {
    return null;
  }
  // Parse the JSON array (opencli emits rows)
  let rows: Array<{ url?: string; title?: string }>;
  try {
    const parsed = JSON.parse(searchStdout.slice(searchStdout.search(/[\[{]/)));
    rows = Array.isArray(parsed) ? parsed : [];
  } catch {
    return null;
  }
  // Prefer a row whose URL contains our target note-id; fall back to top
  // result when we don't have an id.
  if (targetId) {
    for (const row of rows) {
      if (row.url && row.url.includes(targetId)) return row.url;
    }
  }
  // No id match. Require a STRONG title match to avoid false positives
  // (xhs titles are often re-shared; many different posts mention the same
  // keyword). Accept a row only if either:
  //   (a) the returned title is a prefix of our query (xhs often truncates
  //       long titles with "..." or cuts at a shorter length), OR
  //   (b) the returned title is substantially (≥70% of its length) contained
  //       in our query as a contiguous substring
  //
  // The megatron case shows why: original title
  //   "megatron是一个伟大的工程但也有伟大的负担"
  // returned candidate
  //   "Slime集成了SGLang和Megatron"
  // share only "Megatron" (8 chars); rejecting this is correct.
  const queryLower = query.toLowerCase();
  const stripEllipsis = (s: string) => s.replace(/\s*(?:\.\.\.|…)\s*$/, "").trim();
  for (const row of rows) {
    if (!row.url || !row.title) continue;
    const titleLower = stripEllipsis(row.title.toLowerCase());
    if (titleLower.length < 6) continue;

    // (a) title is a prefix of query (handles xhs truncation of long titles)
    if (queryLower.startsWith(titleLower)) return row.url;

    // (b) find longest contiguous substring shared; accept iff it covers
    //     ≥70% of the shorter side (catches cases where the title has a
    //     few extra chars vs the query, or vice versa)
    let bestLen = 0;
    for (let i = 0; i < queryLower.length; i++) {
      for (let j = 0; j < titleLower.length; j++) {
        let k = 0;
        while (
          i + k < queryLower.length &&
          j + k < titleLower.length &&
          queryLower[i + k] === titleLower[j + k]
        ) k++;
        if (k > bestLen) bestLen = k;
      }
    }
    const shortLen = Math.min(queryLower.length, titleLower.length);
    if (bestLen >= Math.ceil(shortLen * 0.7) && bestLen >= 10) {
      return row.url;
    }
  }
  return null;
}


/** Native zhihu question adapter: www.zhihu.com/question/<id> — prints structured answers to stdout. */
function fetchZhihuQuestionViaAdapter(url: string): AdapterResult {
  const m = url.match(/\/question\/(\d+)/);
  if (!m) throw makeError("parse-failure", "L3", `could not extract zhihu question id from ${url}`);
  const qid = m[1];
  const stdout = runOpencli(
    ["zhihu", "question", qid, "-f", "md", "--limit", "10"],
    { timeoutMs: 120_000 },
  );
  return { markdown: stdout, imageFiles: [], rawMetadata: { question_id: qid } };
}

/**
 * Native WeChat fetcher: mp.weixin.qq.com/s/<id>
 *
 * Pipeline (Track B — replaces opencli weixin adapter):
 *   1. Open the page in opencli's headless browser (auth + JS hydration)
 *   2. Eval to extract `#js_content` outerHTML + page metadata as JSON
 *   3. Close browser
 *   4. Convert HTML → markdown via our own jsdom + turndown converter
 *      (handles lists, tables, inline code, SVG, images deterministically)
 *   5. Download each image via curl into slugDir
 *   6. Return AdapterResult with §2 frontmatter + body
 *
 * Failure modes are explicit: if any browser step fails or returns empty,
 * we throw a structured error rather than fall back to the broken legacy
 * pipeline (which is gone).
 */
function fetchWechatViaAdapter(url: string, slugDir: string): AdapterResult {
  mkdirSync(slugDir, { recursive: true });

  let browserOpened = false;
  try {
    const openRes = spawnSync(
      "opencli",
      ["browser", "open", url],
      { encoding: "utf8", timeout: browserTimeoutMs("open") },
    );
    if (openRes.status !== 0) {
      throw makeError(
        "browser-open-failed",
        "L3",
        `opencli browser open failed for weixin URL: ${(openRes.stderr || "").slice(0, 200)}`,
      );
    }
    browserOpened = true;
    sleepMs(3500);

    // One eval call returns both the article HTML and metadata so we
    // don't pay for two round trips.
    const evalScript = `(() => {
      const root = document.querySelector("#js_content");
      const html = root ? root.outerHTML : "";
      const titleEl = document.querySelector("#activity-name");
      const authorEl = document.querySelector("#js_name") || document.querySelector("#profileBt #js_name");
      const timeEl = document.querySelector("#publish_time") || document.querySelector("em#publish_time");
      return JSON.stringify({
        html,
        title: titleEl ? (titleEl.textContent || "").trim().replace(/\\s+/g, " ") : "",
        author: authorEl ? (authorEl.textContent || "").trim() : "",
        publishTime: timeEl ? (timeEl.textContent || "").trim() : "",
      });
    })()`;
    const evalRes = spawnSync("opencli", ["browser", "eval", evalScript], {
      encoding: "utf8",
      timeout: browserTimeoutMs("eval"),
      maxBuffer: 32 * 1024 * 1024,
    });
    if (evalRes.status !== 0) {
      throw makeError(
        "browser-eval-failed",
        "L3",
        `opencli browser eval failed for weixin URL: ${(evalRes.stderr || "").slice(0, 200)}`,
      );
    }
    // opencli prints the eval result + a trailing version-notice block on stderr.
    // The result is whatever the JS returned — our JSON.stringify output, but
    // opencli wraps it in its own JSON.stringify pass. Locate the inner JSON
    // by scanning for the first `{` and matching braces.
    const stdout = evalRes.stdout || "";
    const jsonStart = stdout.indexOf("{");
    if (jsonStart < 0) {
      throw makeError("browser-eval-empty", "L3", "weixin eval returned no JSON object");
    }
    let depth = 0;
    let jsonEnd = -1;
    let inStr = false;
    let escape = false;
    for (let i = jsonStart; i < stdout.length; i++) {
      const c = stdout[i];
      if (escape) { escape = false; continue; }
      if (c === "\\") { escape = true; continue; }
      if (c === "\"") { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { jsonEnd = i; break; } }
    }
    if (jsonEnd < 0) {
      throw makeError("browser-eval-malformed", "L3", "weixin eval JSON object not terminated");
    }
    const payload = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1)) as {
      html: string;
      title: string;
      author: string;
      publishTime: string;
    };
    if (!payload.html || payload.html.length < 200) {
      throw makeError(
        "weixin-empty-content",
        "L3",
        `weixin #js_content missing or too small (${payload.html?.length ?? 0} chars) — login expired or wrong page?`,
      );
    }

    const result = convertWeixinHtml(
      payload.html,
      { title: payload.title, author: payload.author, publishTime: payload.publishTime },
      url,
    );

    // Download images. Failures are tolerated individually (one bad CDN URL
    // shouldn't abort the whole fetch); we log a count for visibility.
    const imageFiles: string[] = [];
    let imgFailed = 0;
    for (const dl of result.imagesToDownload) {
      const dest = join(slugDir, dl.localFilename);
      const bytes = downloadImage(dl.remoteUrl, dest);
      if (bytes > 0) imageFiles.push(dl.localFilename);
      else imgFailed++;
    }

    // Write SVG files (real inline diagrams — mermaid flowcharts etc.) to
    // disk alongside images. Each is referenced from the markdown as a
    // standard `![](weixin-svg-NNN.svg)` so any markdown viewer renders it.
    for (const svg of result.svgFiles) {
      const dest = join(slugDir, svg.localFilename);
      writeFileSync(dest, svg.svg);
      imageFiles.push(svg.localFilename);
    }

    const adapterNotes: string[] = [
      `weixin: raw-HTML pipeline (turndown + custom rules)`,
      `weixin: ${result.stats.codeFences} code block(s), ${result.stats.tables} table row(s), ${result.stats.svgFiles} SVG diagram(s) preserved (${result.stats.svgDropped} decorative dropped), ${result.stats.listMarkersCleaned} list-marker prefix(es) stripped`,
      `weixin: downloaded ${imageFiles.length - result.svgFiles.length}/${result.imagesToDownload.length} image(s)${imgFailed > 0 ? ` (${imgFailed} failed)` : ""}`,
    ];
    const extraFlags: string[] = imgFailed > 0 ? ["weixin-image-download-partial"] : [];

    return {
      markdown: result.markdown,
      title: result.metadata.title,
      imageFiles,
      rawMetadata: {
        source: "weixin-raw-html",
        title: result.metadata.title,
        author: result.metadata.author,
        publish_time: result.metadata.publishTime,
        stats: result.stats,
      },
      extraFlags: extraFlags.length > 0 ? extraFlags : undefined,
      adapterNotes,
    };
  } finally {
    if (browserOpened) closeBrowser();
  }
}

/**
 * DeepWiki renders mermaid diagrams client-side. The `<div class="mermaid">`
 * elements carry the full source in a `data-original-text` attribute.
 * Extract all of them via a browser session so we can embed proper
 * ```mermaid blocks in our markdown instead of the exploded node-list text
 * opencli web-read produces.
 *
 * Called only for wiki.litenext.digital URLs. Returns [] on failure (we
 * just leave the diagram-node runs as-is; the deepwiki post-processor
 * wraps them in plain-text code blocks as a fallback).
 */
interface DeepwikiMermaidExtractResult {
  sources: string[];
  error?: string;
}

function extractDeepwikiMermaidSources(url: string): DeepwikiMermaidExtractResult {
  // Browser lifetime owned fully by this function — finally-block closes.
  let browserOpened = false;
  try {
    const openRes = spawnSync("opencli", ["browser", "open", url], { encoding: "utf8", timeout: browserTimeoutMs("open") });
    if (openRes.status !== 0) {
      return { sources: [], error: `browser open exited ${openRes.status}` };
    }
    browserOpened = true;
    // Wait for mermaid client-side render. 12s empirically sufficient on cached cache;
    // we accept the cost because deepwiki is 11 bookmarks total.
    sleepMs(12_000);
    // Two-strategy extractor:
    //   1. `.mermaid[data-original-text]` attribute (wiki.litenext.digital)
    //   2. Next.js hydration scripts containing literal "```mermaid\\n...```"
    //      (deepwiki.com, which renders client-side without data attributes).
    //      Parse the script JSON-string escapes and dedupe by content.
    // Two-strategy extractor:
    //   1. `.mermaid[data-original-text]` attribute (wiki.litenext.digital)
    //   2. Next.js hydration scripts containing literal "```mermaid\\n...```"
    //      (deepwiki.com renders client-side without data attributes).
    //
    // For strategy 2, deepwiki.com ships the ENTIRE wiki's mermaid sources in
    // the hydration bundle (one chunk per cross-linked page). So we cap the
    // result to the number of `<svg id="mermaid-*">` elements actually rendered
    // on THIS page, in document order. The first N sources in the scripts
    // correspond to the first N rendered SVGs (deepwiki emits them in page order).
    const evalScript = `(() => {
  const fromAttr = Array.from(document.querySelectorAll(".mermaid[data-original-text]")).map(el => el.getAttribute("data-original-text")).filter(s => typeof s === "string" && s.length > 0);
  if (fromAttr.length > 0) return JSON.stringify(fromAttr);
  const renderedSvgCount = document.querySelectorAll("svg[id^=\\"mermaid\\"]").length;
  if (renderedSvgCount === 0) return JSON.stringify([]);
  const fences = [];
  const re = /\\\`\\\`\\\`mermaid\\\\n([\\s\\S]*?)\\\`\\\`\\\`/g;
  for (const s of document.querySelectorAll("script")) {
    const t = s.textContent || "";
    let m;
    while ((m = re.exec(t)) !== null) fences.push(m[1]);
  }
  const decode = (raw) => {
    try {
      return JSON.parse('"' + raw.replace(/[\\x00-\\x1f]/g, c => '\\\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + '"');
    } catch { return null; }
  };
  const seen = new Set();
  const out = [];
  for (const raw of fences) {
    const decoded = decode(raw);
    if (!decoded) continue;
    const key = decoded.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= renderedSvgCount) break;
  }
  return JSON.stringify(out);
})()`;
    const evalRes = spawnSync(
      "opencli",
      ["browser", "eval", evalScript],
      { encoding: "utf8", timeout: browserTimeoutMs("eval"), maxBuffer: 10 * 1024 * 1024 },
    );
    if (evalRes.status !== 0) {
      return { sources: [], error: `browser eval exited ${evalRes.status}` };
    }
    // Find the JSON array in stdout (may have opencli banner noise after)
    const out = evalRes.stdout || "";
    const jsonStart = out.indexOf("[");
    if (jsonStart < 0) {
      return { sources: [], error: "no JSON array in mermaid eval output" };
    }
    // Find matching end of the JSON array (greedy — scan forward for `]`
    // matching the outer `[`)
    let depth = 0;
    let jsonEnd = -1;
    for (let i = jsonStart; i < out.length; i++) {
      if (out[i] === "[") depth++;
      else if (out[i] === "]") { depth--; if (depth === 0) { jsonEnd = i; break; } }
    }
    if (jsonEnd < 0) {
      return { sources: [], error: "unterminated JSON array in mermaid eval output" };
    }
    try {
      const arr = JSON.parse(out.slice(jsonStart, jsonEnd + 1));
      const sources = Array.isArray(arr) ? arr.filter((x: unknown): x is string => typeof x === "string") : [];
      return { sources };
    } catch (e) {
      return {
        sources: [],
        error: `mermaid JSON parse failed: ${e instanceof Error ? e.message : e}`,
      };
    }
  } catch (e) {
    return {
      sources: [],
      error: `extractDeepwikiMermaidSources threw: ${e instanceof Error ? e.message : e}`,
    };
  } finally {
    if (browserOpened) closeBrowser();
  }
}

/**
 * DeepWiki renders tables client-side from markdown source, and opencli
 * web-read's DOM-to-markdown converter frequently drops them entirely
 * (producing content.md with no `|` rows even though the page clearly has
 * a table).  Fix: after web-read, navigate in-browser, extract each
 * `<table>` element as a {precedingHeading, rows} record, and splice
 * proper markdown tables into the output after their matching headings.
 *
 * Returned shape per table:
 *   { precedingHeading: "Key Files" | "Comparison with Native Runner" | ...,
 *     rows: [["File","Lines","Description"], ["daft/runners/ray_runner.py", ...], ...] }
 *
 * Returns [] on failure.
 */
interface DeepwikiTable {
  precedingHeading: string;
  rows: string[][];
}

interface DeepwikiTablesExtractResult {
  tables: DeepwikiTable[];
  error?: string;
}

function extractDeepwikiTables(url: string): DeepwikiTablesExtractResult {
  // Browser lifetime owned fully by this function — finally-block closes.
  let browserOpened = false;
  try {
    const openRes = spawnSync("opencli", ["browser", "open", url], { encoding: "utf8", timeout: browserTimeoutMs("open") });
    if (openRes.status !== 0) {
      return { tables: [], error: `browser open exited ${openRes.status}` };
    }
    browserOpened = true;
    sleepMs(12_000);
    const js = `JSON.stringify(Array.from(document.querySelectorAll("table")).map(t => {
      let cur = t;
      let heading = "";
      for (let k = 0; k < 20 && !heading; k++) {
        cur = cur.previousElementSibling || (cur.parentElement && cur.parentElement.previousElementSibling);
        if (!cur) break;
        if (/^H[1-6]$/.test(cur.tagName) && cur.innerText.trim().length > 0) {
          heading = cur.innerText.trim();
          break;
        }
      }
      const rows = Array.from(t.rows).map(r => Array.from(r.cells).map(c => c.innerText.trim().replace(/\\n+/g, " ")));
      return { precedingHeading: heading, rows };
    }))`;
    const evalRes = spawnSync("opencli", ["browser", "eval", js], {
      encoding: "utf8",
      timeout: browserTimeoutMs("eval"),
      maxBuffer: 10 * 1024 * 1024,
    });
    if (evalRes.status !== 0) {
      return { tables: [], error: `browser eval exited ${evalRes.status}` };
    }
    const out = evalRes.stdout || "";
    const jsonStart = out.indexOf("[");
    if (jsonStart < 0) {
      return { tables: [], error: "no JSON array in tables eval output" };
    }
    let depth = 0;
    let jsonEnd = -1;
    for (let i = jsonStart; i < out.length; i++) {
      if (out[i] === "[") depth++;
      else if (out[i] === "]") { depth--; if (depth === 0) { jsonEnd = i; break; } }
    }
    if (jsonEnd < 0) {
      return { tables: [], error: "unterminated JSON array in tables eval output" };
    }
    try {
      const arr = JSON.parse(out.slice(jsonStart, jsonEnd + 1));
      const tables = Array.isArray(arr)
        ? arr.filter((x: unknown): x is DeepwikiTable =>
            typeof x === "object" && x !== null && "rows" in x)
        : [];
      return { tables };
    } catch (e) {
      return {
        tables: [],
        error: `tables JSON parse failed: ${e instanceof Error ? e.message : e}`,
      };
    }
  } catch (e) {
    return {
      tables: [],
      error: `extractDeepwikiTables threw: ${e instanceof Error ? e.message : e}`,
    };
  } finally {
    if (browserOpened) closeBrowser();
  }
}

/**
 * Convert a 2D array of cells into a standard markdown table. First row is
 * treated as headers. Cells containing `|` are escaped.
 */
function renderMarkdownTable(rows: string[][]): string {
  if (rows.length === 0) return "";
  const escape = (s: string) => s.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
  const widths = rows.reduce(
    (acc, row) => row.map((c, i) => Math.max(acc[i] ?? 0, escape(c).length)),
    [] as number[],
  );
  const ncols = widths.length;
  const lines: string[] = [];
  const headerCells = (rows[0] || []).concat(Array(ncols).fill("")).slice(0, ncols);
  lines.push("| " + headerCells.map((c) => escape(c)).join(" | ") + " |");
  lines.push("| " + widths.map(() => "---").join(" | ") + " |");
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i].concat(Array(ncols).fill("")).slice(0, ncols);
    lines.push("| " + row.map((c) => escape(c)).join(" | ") + " |");
  }
  return lines.join("\n");
}

/**
 * Splice DeepWiki tables into the markdown: for each table with a known
 * preceding heading, find that heading in the md and insert the rendered
 * markdown table on a new paragraph after it.
 *
 * Skips tables whose heading can't be found — we leave them out rather than
 * risk inserting at the wrong location. (Future improvement: fuzzy match on
 * first-paragraph-text when no heading matches.)
 *
 * Returns `{ md, matched, skipped }` so the caller can flag partial splices.
 */
function spliceDeepwikiTables(md: string, tables: DeepwikiTable[]): { md: string; matched: number; skipped: number } {
  if (tables.length === 0) return { md, matched: 0, skipped: 0 };
  let current = md;
  let matched = 0;
  let skipped = 0;
  for (const t of tables) {
    if (!t.precedingHeading || t.rows.length === 0) { skipped++; continue; }

    // Escape regex chars in the heading
    const esc = t.precedingHeading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^(#{1,6}\\s+${esc}\\s*)$`, "m");
    const match = re.exec(current);
    if (!match) { skipped++; continue; }
    const insertAt = (match.index ?? 0) + match[0].length;
    matched++;

    // Remove the plain-text cell-run corresponding to this table. opencli's
    // DOM-to-markdown converter renders each table cell as its own paragraph
    // (blank-line separated, sometimes with **bold** cell emphasis from the
    // source styling). On deepwiki.com the cell-run often appears AFTER a
    // mermaid diagram or intro paragraph, not immediately after the heading —
    // so we search within [insertAt, nextHeadingOrEnd) for the cell-run and
    // remove the matched span (not a prefix from insertAt).
    const totalCells = t.rows.length * (t.rows[0]?.length ?? 0);
    const sectionEnd = findNextHeadingOffset(current, insertAt);
    const runSpan = findPlainTextCellRunSpan(current, insertAt, sectionEnd, t.rows);
    if (runSpan && totalCells > 0) {
      // Extend removal to swallow an orphan bold lead-in like
      // `**Component Roles:**` that often precedes the cell-run and
      // becomes pointless once the cells themselves are stripped.
      const leadInStart = findOrphanLeadInStart(current, runSpan.start);
      const removeFrom = leadInStart ?? runSpan.start;
      current = current.slice(0, removeFrom) + current.slice(runSpan.end);
    }

    // Re-find the heading after the removal; its offset may have changed.
    const reMatch = re.exec(current);
    const newInsertAt = reMatch ? (reMatch.index ?? 0) + reMatch[0].length : insertAt;
    // Insert the table with a single leading \n (the heading line already
    // ends with \n, so one \n gives a blank line; two would stack into a
    // double blank). Trailing \n ensures the table is followed by content
    // at paragraph distance.
    const tableMd = renderMarkdownTable(t.rows);
    const insertion = "\n" + tableMd + "\n";
    current = current.slice(0, newInsertAt) + insertion + current.slice(newInsertAt);
  }
  return { md: current, matched, skipped };
}

/**
 * If the paragraph immediately before `runStart` is a short bold lead-in
 * like `**Label:**` with no body text of its own, return the offset where
 * that lead-in begins (so the caller can remove it along with the cell-run).
 * Returns null if no orphan lead-in is present.
 */
function findOrphanLeadInStart(md: string, runStart: number): number | null {
  // Walk backwards over whitespace to find the previous non-blank line.
  let end = runStart;
  while (end > 0 && /\s/.test(md[end - 1])) end--;
  if (end === 0) return null;
  // Find the start of the line containing `end`.
  let start = end;
  while (start > 0 && md[start - 1] !== "\n") start--;
  const line = md.slice(start, end);
  // Orphan lead-in shape: 1–6 words, wrapped in ** and ending with `:**`.
  // Keep it tight — we don't want to accidentally swallow a real paragraph.
  if (/^\*\*[^*\n]{1,60}:\*\*$/.test(line.trim()) && line.length < 80) {
    return start;
  }
  return null;
}

/**
 * Offset of the next `^#{1,6} ` heading after `start`, or `md.length` if none.
 * Used to bound cell-run search to the current section.
 */
function findNextHeadingOffset(md: string, start: number): number {
  const re = /^#{1,6}\s+\S/m;
  re.lastIndex = 0;
  const sub = md.slice(start);
  const m = sub.match(re);
  if (!m || m.index === undefined) return md.length;
  return start + m.index;
}

/**
 * Search `[start, end)` of `md` for a contiguous run of paragraphs that match
 * the given table's cells (one paragraph per cell, blank-line separated, in
 * row-major order). Returns `{start, end}` of the matched span, or `null` if
 * no run of sufficient fidelity is found.
 *
 * Soft matching: strips `**bold**`, `` `code` ``, and whitespace so minor
 * DOM-rendering artifacts (e.g. `**AICB**` vs `AICB`, `` `busbw.yaml` ``
 * vs `busbw.yaml`) still match.
 *
 * Unlike the old `findPlainTextCellRunEnd`, this searches the whole section
 * — it doesn't require the cell-run to start immediately after the heading.
 * Needed because deepwiki.com often places an intro paragraph + mermaid
 * diagram between the heading and the cell-run.
 */
function findPlainTextCellRunSpan(
  md: string,
  start: number,
  end: number,
  rows: string[][],
): { start: number; end: number } | null {
  const expectedCells: string[] = [];
  for (const row of rows) {
    for (const cell of row) expectedCells.push(cell.trim());
  }
  if (expectedCells.length === 0) return null;
  const firstWant = expectedCells[0];
  const minMatches = Math.ceil(expectedCells.length * 0.7);

  const normalize = (s: string) => s
    .replace(/\*\*([^*]+)\*\*/g, "$1")       // strip **bold**
    .replace(/`([^`]+)`/g, "$1")             // strip `code` anywhere
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // unwrap [text](url) → text
    .replace(/\\([._\-*])/g, "$1")           // unescape \\_ \\. \\- \\*
    .replace(/\s+/g, " ")                    // collapse whitespace
    .replace(/^\s+|\s+$/g, "");              // trim

  // Walk paragraphs in [start, end). For each paragraph whose normalized text
  // is compatible with the first expected cell, attempt a sequential match.
  let probe = start;
  while (probe < end) {
    // Skip to next non-blank paragraph start
    while (probe < end && /\s/.test(md[probe])) probe++;
    if (probe >= end) break;
    // Don't start scan inside a code fence
    if (md.slice(probe, probe + 3) === "```") {
      // Skip past fence
      const fenceEnd = md.indexOf("\n```", probe + 3);
      probe = fenceEnd < 0 ? end : fenceEnd + 4;
      continue;
    }
    // Attempt match starting at probe
    const candidate = tryMatchCellRun(md, probe, end, expectedCells, minMatches, normalize);
    if (candidate) return candidate;
    // No match — advance to next paragraph boundary
    const nextBlank = md.indexOf("\n\n", probe);
    probe = nextBlank < 0 || nextBlank >= end ? end : nextBlank + 2;
  }
  return null;
}

function tryMatchCellRun(
  md: string,
  start: number,
  end: number,
  expectedCells: string[],
  minMatches: number,
  normalize: (s: string) => string,
): { start: number; end: number } | null {
  let cursor = start;
  let matchedCount = 0;
  const runStart = cursor;
  for (const want of expectedCells) {
    // Skip blank lines/whitespace between paragraphs
    while (cursor < end && /\s/.test(md[cursor])) cursor++;
    if (cursor >= end) break;
    const wantNorm = normalize(want);

    // Greedy concat: opencli sometimes splits one DOM cell across multiple
    // paragraphs (e.g. `**base** \`base\` + \`cuBLAS\`, ...` becomes 3 paragraphs).
    // Read paragraphs one at a time, accumulating, until either we match the
    // wanted cell or we diverge (accumulator is no longer a prefix/substring
    // of the wanted text).
    let probe = cursor;
    let accNorm = "";
    let cellMatched = false;
    let consumedEnd = cursor;
    while (probe < end) {
      while (probe < end && /\s/.test(md[probe])) probe++;
      if (probe >= end) break;
      let pEnd = probe;
      while (pEnd < end) {
        if (md[pEnd] === "\n" && pEnd + 1 < end && md[pEnd + 1] === "\n") break;
        pEnd++;
      }
      const segNorm = normalize(md.slice(probe, pEnd));
      const newAcc = accNorm ? (accNorm + " " + segNorm).replace(/\s+/g, " ") : segNorm;
      if (newAcc === wantNorm || newAcc.includes(wantNorm)) {
        cellMatched = true;
        consumedEnd = pEnd;
        break;
      }
      if (wantNorm.startsWith(newAcc) || wantNorm.includes(newAcc)) {
        accNorm = newAcc;
        consumedEnd = pEnd;
        probe = pEnd;
      } else {
        break;
      }
    }
    if (cellMatched) {
      matchedCount++;
      cursor = consumedEnd;
    } else {
      break;
    }
  }
  if (matchedCount < minMatches) return null;
  // Include trailing newlines so we don't leave orphaned blank lines
  while (cursor < end && md[cursor] === "\n") cursor++;
  return { start: runStart, end: cursor };
}

/**
 * Splice mermaid sources into a deepwiki markdown output. Walks the markdown
 * looking for "diagram-node runs" (runs of consecutive short lines that
 * aren't markdown-formatted — the signature of an exploded mermaid diagram)
 * and replaces each such run with the Nth entry from `mermaidSources`.
 *
 * The minimum run length is adaptive: derived from the smallest extracted
 * source's node count (clamped to [3, 6]). This keeps us from mis-splicing
 * into non-diagram short-line clusters while still catching small diagrams
 * (sequence, state, ER) that have as few as 3–4 exploded labels.
 *
 * Returns `{ md, placed, total }` so the caller can flag when we placed
 * fewer diagrams than were extracted (silent-miss guard).
 */
function spliceDeepwikiMermaid(md: string, mermaidSources: string[]): { md: string; placed: number; total: number } {
  if (mermaidSources.length === 0) return { md, placed: 0, total: 0 };
  // Adaptive threshold: smallest source's identifier-line count, clamped to [3, 6].
  // A mermaid source like `graph LR\n  A --> B\n  B --> C` has ~3 content lines;
  // opencli's exploded rendering produces one line per node label, so the run
  // should have at least that many short lines.
  const sourceLineCounts = mermaidSources.map((s) =>
    s.split("\n").filter((l) => l.trim().length > 0).length,
  );
  const smallest = Math.min(...sourceLineCounts);
  const minRun = Math.max(3, Math.min(6, Math.floor(smallest / 2) || 3));
  const lines = md.split("\n");
  const out: string[] = [];
  const isDiagramNode = (t: string): boolean => {
    if (t.length === 0) return false;
    // Presence of literal `\\n` is a strong mermaid-label signal — mermaid
    // uses `\n` inside node labels for manual line breaks, which opencli
    // renders as the escaped literal `\\n` in markdown. Normal prose never
    // contains this. Accept any length when seen.
    if (/\\n|\\_/.test(t)) {
      if (t.length > 200) return false;  // sanity cap
      return true;
    }
    // Tightened generic rules: short lines with few words, no markdown markers.
    // Previous caps (40 chars / 5 words) were too strict for mermaid labels
    // like `Critic slice (optional)\n[actor_num_gpus : actor+critic_num_gpus]`
    // which split into 7+ tokens and exceed 40 chars. Widened to 80/10.
    if (t.length > 80) return false;
    if (t.split(/\s+/).length > 10) return false;
    if (/^[#\-*>![|`]/.test(t)) return false;
    if (/^\d+\./.test(t)) return false;
    if (/^(?:image|img)\//i.test(t)) return false;
    if (/^https?:\/\//.test(t)) return false;
    return true;
  };
  let i = 0;
  let mermaidIdx = 0;
  let inCodeFence = false;  // track fence state so we don't splice INSIDE a ```python etc. block
  while (i < lines.length) {
    // Pass through fence open/close + fence contents verbatim
    if (/^```/.test(lines[i].trim())) {
      out.push(lines[i]);
      i++;
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) {
      out.push(lines[i]);
      i++;
      continue;
    }
    const runStart = i;
    const collected: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (/^```/.test(t)) break;  // don't consume into a fence
      if (t === "") { i++; continue; }
      if (isDiagramNode(t)) { collected.push(t); i++; continue; }
      break;
    }
    if (collected.length >= minRun && mermaidIdx < mermaidSources.length) {
      // Ensure a blank line separates the fence from any preceding paragraph
      // (a lone `\`\`\`mermaid` immediately after prose renders poorly and can
      // even be mis-parsed as a continuation by some markdown engines).
      if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("");
      out.push("```mermaid");
      out.push(mermaidSources[mermaidIdx].trim());
      out.push("```");
      out.push("");
      mermaidIdx++;
    } else {
      // Scan didn't find a long-enough diagram run. Emit lines [runStart, i)
      // EXCLUSIVE of i — if i is now at a fence line, we must let the outer
      // loop process it so inCodeFence toggles correctly. If the scan didn't
      // advance at all (runStart === i), we'd infinite-loop; force-advance.
      for (let j = runStart; j < i && j < lines.length; j++) out.push(lines[j]);
      if (i === runStart) {
        out.push(lines[i]);
        i++;
      }
    }
  }
  return { md: out.join("\n").replace(/\n{3,}/g, "\n\n"), placed: mermaidIdx, total: mermaidSources.length };
}

/**
 * Generic `opencli web read` — works for any URL the user can read in their
 * logged-in Chrome. `--wait` is bumped to 10s (vs the default 3) so
 * client-rendered SPAs (DeepWiki, Vercel docs, Notion pages) have time to
 * hydrate before content is scraped. Adds ~7s per fetch — tolerable at v1
 * scale, and we auto-retry with 60s on short-body / loading-skeleton flags
 * (empirically: DeepWiki needs ~60s for its article body to fully render).
 *
 * DeepWiki special-case: after the web-read call, we do an extra browser
 * navigation to extract mermaid source from each `.mermaid[data-original-text]`
 * element and splice proper ```mermaid code blocks into the markdown
 * replacing the exploded node-list runs opencli produces. Costs an extra
 * ~15s per deepwiki page; worth it for diagram fidelity.
 */
function fetchWebReadViaAdapter(url: string, slugDir: string, downloadImages: boolean, waitSeconds = 10): AdapterResult {
  const beforeMtime = Date.now();
  mkdirSync(slugDir, { recursive: true });
  const stdout = runOpencli(
    [
      "web", "read",
      "--url", url,
      "--output", slugDir,
      "--download-images", downloadImages ? "true" : "false",
      "--wait", String(waitSeconds),
      "-f", "json",
    ],
    { timeoutMs: 120_000 + waitSeconds * 1000 },
  );
  const h = harvestAdapterOutput(slugDir, beforeMtime);
  let resultMarkdown = h.content;
  const adapterNotesLocal: string[] = [];
  const adapterFlagsLocal: string[] = [];

  // Propagate any filesystem-level harvest issues (failed renames, stat
  // errors) as quality flags. Content is still usable — but the user
  // should know some assets may have been dropped.
  if (h.errors.length > 0) {
    adapterFlagsLocal.push("adapter-output-partial");
    for (const e of h.errors) adapterNotesLocal.push(`harvest: ${e}`);
  }

  // DeepWiki: after web-read, do an extra browser pass to extract BOTH
  // mermaid diagrams AND tables from the rendered DOM (which opencli's
  // DOM-to-markdown converter frequently drops). One browser session
  // serves both extractions to halve the navigation cost.
  if (/^(?:wiki\.litenext\.digital|deepwiki\.com)$/.test(hostnameOf(url))) {
    // Strip deepwiki nav chrome (top sidebar, dup H1 block, trailing TOC)
    // at the adapter layer so raw/*/content.md is already clean — splicer
    // then works on the cleaned markdown. Previously this ran only during
    // the downstream post-processor pass, which left raw/ files ugly when
    // inspected directly.
    try {
      const stripResult = deepwikiStripNav.transform(resultMarkdown, url);
      if (stripResult.md !== resultMarkdown) {
        resultMarkdown = stripResult.md;
        for (const n of stripResult.notes) adapterNotesLocal.push(n);
      }
    } catch (e) {
      adapterNotesLocal.push(`deepwiki: nav-strip failed (${e instanceof Error ? e.message : e})`);
    }
    const mermaidResult = extractDeepwikiMermaidSources(url);
    if (mermaidResult.error) {
      adapterFlagsLocal.push("deepwiki-mermaid-extraction-failed");
      adapterNotesLocal.push(`deepwiki: mermaid extraction failed (${mermaidResult.error.slice(0, 120)})`);
    } else if (mermaidResult.sources.length > 0) {
      const { md: spliced, placed, total } = spliceDeepwikiMermaid(resultMarkdown, mermaidResult.sources);
      if (spliced !== resultMarkdown) {
        resultMarkdown = spliced;
        adapterNotesLocal.push(`deepwiki: spliced ${placed}/${total} mermaid source(s) from rendered DOM`);
      }
      if (placed < total) {
        adapterFlagsLocal.push("deepwiki-mermaid-splice-incomplete");
        adapterNotesLocal.push(`deepwiki: WARNING — extracted ${total} mermaid sources but only placed ${placed}`);
      }
    }
    const tablesResult = extractDeepwikiTables(url);
    if (tablesResult.error) {
      adapterFlagsLocal.push("deepwiki-table-extraction-failed");
      adapterNotesLocal.push(`deepwiki: table extraction failed (${tablesResult.error.slice(0, 120)})`);
    } else if (tablesResult.tables.length > 0) {
      const { md: spliced, matched, skipped } = spliceDeepwikiTables(resultMarkdown, tablesResult.tables);
      if (spliced !== resultMarkdown) {
        resultMarkdown = spliced;
        adapterNotesLocal.push(`deepwiki: spliced ${matched}/${tablesResult.tables.length} table(s) from rendered DOM`);
      }
      if (skipped > 0) {
        adapterFlagsLocal.push("deepwiki-table-splice-incomplete");
        adapterNotesLocal.push(`deepwiki: WARNING — ${skipped}/${tablesResult.tables.length} table(s) could not be spliced (heading not found)`);
      }
    }
  }

  const result: AdapterResult = {
    markdown: resultMarkdown,
    imageFiles: h.images,
    rawMetadata: tryParseJsonLines(stdout),
    adapterNotes: adapterNotesLocal.length > 0 ? adapterNotesLocal : undefined,
    extraFlags: adapterFlagsLocal.length > 0 ? adapterFlagsLocal : undefined,
  };

  // Heuristic retry: if we got a suspiciously-short result or explicit
  // "Loading…" skeleton (common on client-rendered SPAs), retry ONCE with
  // a 60-second wait. Bounded to one retry — avoids pathological delays.
  if (waitSeconds < 60) {
    const q = classifyQuality(result.markdown, { originUrl: url });
    const suspiciousForRetry =
      q.flags.includes("short-body") ||
      q.flags.includes("loading-skeleton") ||
      q.flags.includes("below-host-expected-size");
    if (suspiciousForRetry) {
      // Clear harvested files so the retry has a clean slate (but keep source.json if already written)
      try {
        for (const f of readdirSync(slugDir, { withFileTypes: true })) {
          if (f.name === "source.json") continue;
          rmSync(join(slugDir, f.name), { recursive: true, force: true });
        }
      } catch {}
      return fetchWebReadViaAdapter(url, slugDir, downloadImages, 60);
    }
  }

  // Final fallback for HuggingFace blog posts: every HF blog post has its
  // source markdown committed to github.com/huggingface/blog (the "Update on
  // GitHub" button on the rendered page links to it). If opencli extraction
  // still misfired after the 60-second retry, bypass the DOM entirely and
  // pull the authoritative markdown source from GitHub's raw endpoint.
  //
  // This covers cases like `huggingface.co/blog/moe` where a prominent
  // "Collections" sidebar card above the article body confuses opencli's
  // readability heuristic and it returns the card's description instead of
  // `.blog-content`.
  if (waitSeconds >= 60 && /^https?:\/\/huggingface\.co\/blog\/[^?#/]+/.test(url)) {
    const q = classifyQuality(result.markdown, { originUrl: url });
    const stillBad =
      q.flags.includes("short-body") ||
      q.flags.includes("below-host-expected-size");
    if (stillBad) {
      const ghResult = fetchHuggingFaceBlogFromGithub(url, slugDir, downloadImages);
      if (ghResult) {
        // Clear any partial opencli harvest before replacing with GitHub source.
        // (Preserve the images dir the GH adapter just populated, if any.)
        try {
          for (const f of readdirSync(slugDir, { withFileTypes: true })) {
            if (f.name === "source.json" || ghResult.imageFiles.includes(f.name)) continue;
            rmSync(join(slugDir, f.name), { recursive: true, force: true });
          }
        } catch {}
        return ghResult;
      }
    }
  }

  // GitHub URLs are now handled by `tools/sites/github/` via the sites
  // router (intercepted before the legacy switch reaches this function);
  // the previous fallback ladder (release API, raw file, PR/issue REST
  // augmentation) is gone. See commits introducing tools/sites/github/
  // for the migration.

  return result;
}


/**
 * HuggingFace-blog-specific fallback: fetch the authoritative markdown source
 * from github.com/huggingface/blog. Returns null when the GitHub copy isn't
 * available (404, network error, or URL isn't an HF blog post).
 *
 * Image paths in the GitHub source are typically site-relative
 * (`/blog/assets/moe/foo.png`); they get resolved to absolute HF URLs by
 * `resolveRelativeImageUrls` downstream, then downloaded by `processImages`.
 * YAML frontmatter is stripped and its `title` / `authors` fields are
 * rewritten as the content's H1 and a `> **Authors:** ...` callout, matching
 * the shape produced by the opencli-path `huggingfaceBlogReformat` processor
 * (so the downstream post-processing pipeline sees a consistent format).
 */
function fetchHuggingFaceBlogFromGithub(
  url: string,
  slugDir: string,
  downloadImages: boolean,
): AdapterResult | null {
  const m = url.match(/^https?:\/\/huggingface\.co\/blog\/([^?#/]+)/);
  if (!m) return null;
  const slug = m[1];
  const ghUrl = `https://raw.githubusercontent.com/huggingface/blog/main/${slug}.md`;
  const res = spawnSync("curl", ["-sfL", "-A", "Mozilla/5.0", ghUrl], {
    encoding: "utf8",
    timeout: 30_000,
  });
  if (res.status !== 0 || !res.stdout || res.stdout.length < 500) return null;

  let body = res.stdout;
  let title: string | undefined;
  const authorHandles: string[] = [];

  // Parse YAML frontmatter if present (opening `---` on the first line).
  const fmMatch = body.match(/^---\n([\s\S]*?)\n---\n/);
  if (fmMatch) {
    body = body.slice(fmMatch[0].length);
    const fm = fmMatch[1];
    const titleMatch = fm.match(/^title:\s*["']?(.+?)["']?\s*$/m);
    if (titleMatch) title = titleMatch[1].trim();
    for (const line of fm.split("\n")) {
      const am = line.match(/^\s*-\s*user:\s*(\S+)/);
      if (am) authorHandles.push(am[1]);
    }
  }

  let bodyMd = body.trim() + "\n";
  // Strip the body's leading H1 if present — we'll emit our own preamble H1.
  bodyMd = bodyMd.replace(/^#\s+[^\n]+\n+/, "");

  // Build the standard preamble: # title \n\n > 原文链接 \n (optional > Authors)
  // \n\n --- \n\n (body). Matches §2 output contract so enforceSingleH1
  // and the downstream checks have a real `\n---\n` anchor.
  const finalTitle = title || "HuggingFace Blog Post";
  const preambleLines: string[] = [`# ${finalTitle}`, "", `> 原文链接: ${url}`];
  if (authorHandles.length > 0) {
    const label = authorHandles.length === 1 ? "Author" : "Authors";
    const rendered = authorHandles
      .map((h) => `[@${h}](https://huggingface.co/${h})`)
      .join(", ");
    preambleLines.push(`> **${label}:** ${rendered}`);
  }
  preambleLines.push("", "---", "", "");
  let markdown = preambleLines.join("\n") + bodyMd;

  // Resolve site-relative image paths (/blog/assets/...) to absolute HF URLs so
  // processImages can download them. Matches both markdown `![](/path)` and
  // HTML `<img src="/path">` forms.
  markdown = markdown.replace(
    /(!\[[^\]]*\]\()(\/[^)\s]+)(\))/g,
    (_m, pre, path, post) => `${pre}https://huggingface.co${path}${post}`,
  );
  markdown = markdown.replace(
    /(<img\b[^>]*\bsrc=["'])(\/[^"']+)(["'])/g,
    (_m, pre, path, post) => `${pre}https://huggingface.co${path}${post}`,
  );

  // Download the images referenced in the markdown. processImages extracts
  // both `![](url)` and `<img src="url">`, filters to http(s), downloads via
  // curl, and rewrites each URL in-place to the local filename.
  const imageFiles: string[] = [];
  if (downloadImages) {
    const r = processImages(markdown, slugDir, true);
    markdown = r.content;
    for (const rec of r.images) imageFiles.push(rec.local);
  }

  return {
    markdown,
    title,
    imageFiles,
    rawMetadata: { source: "github-raw", ghUrl, slug },
    adapterNotes: [
      `huggingface: opencli extraction failed; fell back to GitHub raw (${res.stdout.length} chars, ${authorHandles.length} author(s), ${imageFiles.length} image(s))`,
    ],
  };
}

// ---------------------------------------------------------------------------
// fetcher: lark-hirono
// ---------------------------------------------------------------------------

function fetchViaLarkHirono(nodeToken: string): { content: string; title?: string } {
  // Write to a temp file since lark-hirono fetch outputs to stdout or --output
  const tmp = `/tmp/fetch-raw-lark-${Date.now()}-${Math.floor(Math.random() * 1e6)}.md`;
  const res = spawnSync(
    "lark-hirono",
    ["fetch", "--doc", nodeToken, "--output", tmp],
    { encoding: "utf8", timeout: 60_000 },
  );
  if (res.status !== 0) {
    throw makeError(
      "lark-hirono-error", "L3",
      `lark-hirono fetch failed: ${res.stderr.slice(0, 200)}`,
    );
  }
  if (!existsSync(tmp)) {
    throw makeError("lark-hirono-error", "L3", "lark-hirono produced no output file");
  }
  const content = readFileSync(tmp, "utf8");
  try { execSync(`rm -f ${tmp}`); } catch {}
  return { content };
}

// ---------------------------------------------------------------------------
// high-level fetch-url orchestration
// ---------------------------------------------------------------------------

export interface FetchUrlOpts {
  slug: string;
  url: string;
  viaBrowser: boolean;
  downloadImages: boolean;
  force: boolean;
  /**
   * Optional title (from Raindrop bookmark) used as a fallback stub when
   * content fetch degrades (e.g. xhs `note` rejection → image-only mode).
   */
  titleHint?: string;
  /**
   * Optional markdown transform hook. Runs BETWEEN adapter output and
   * writeRawArchive. Used by hirono's post-processor pipeline to strip
   * site-specific UI chrome, resolve relative image URLs (which may then
   * be downloaded separately via the returned `extraImageUrls`), and
   * similar cleanups.
   */
  transformMarkdown?: (md: string, originUrl: string) => {
    md: string;
    extraFlags?: string[];
    extraNotes?: string[];
    extraImageUrls?: string[];
  };
}

/**
 * URLs we refuse to fetch. An L2 error (queue-and-continue) fires at the
 * fetchUrlAndStore entry so bulk jobs skip cleanly without writing anything
 * to disk. Single-URL callers (`hirono raindrop export <url>`) see the
 * specific `auto-skipped-*` code so they can decide whether to proceed.
 *
 * HuggingFace Spaces are auto-skipped: their UI is client-rendered so there
 * is no meaningful static content to archive. READMEs are often just one-
 * line descriptions that don't justify the fetch.
 */
const AUTO_SKIP_RULES: Array<{
  match: (url: string) => boolean;
  code: string;
  reason: string;
}> = [
  {
    match: (u) => /^https?:\/\/huggingface\.co\/spaces\/[^/]+\/[^/?#]+/.test(u),
    code: "auto-skipped-hf-space",
    reason: "HuggingFace Spaces are interactive apps with no static content to archive",
  },
];

export function fetchUrlAndStore(opts: FetchUrlOpts): SourceJson {
  for (const rule of AUTO_SKIP_RULES) {
    if (rule.match(opts.url)) {
      throw makeError(rule.code, "L2", rule.reason, { domain: hostnameOf(opts.url) });
    }
  }

  if (!opencliDoctorOk()) {
    throw makeError(
      "extension-offline", "L3",
      "opencli Chrome extension not connected",
      { remediation: "run `opencli doctor`, install / re-enable the extension, retry" },
    );
  }

  const slugDir = rawDirFor(opts.slug);
  mkdirSync(slugDir, { recursive: true });

  const dispatch = lookupDispatch(opts.url);
  const adapter: OpencliAdapter = dispatch ? dispatch.adapter : "web-read";
  const fetcherReason: FetcherReason = opts.viaBrowser
    ? "forced-via-browser"
    : dispatch
    ? "domain-override"
    : "direct";

  // Acquire the per-slug fetch lock BEFORE the machine-wide browser lock.
  // This catches the case where two processes both target the same slug —
  // they'd both pass the browser-lock check (if releases interleave) but
  // still corrupt each other's raw/<slug>/ writes. Release order: slug
  // lock released last, after the browser lock is free (LIFO pattern is
  // cleanest; we implement via the finally ordering below).
  const releaseSlugLock = acquireSlugLock(slugDir, opts.slug);
  try {

  // Acquire the machine-wide opencli browser lock. opencli drives ONE shared
  // Chrome tab per machine via the extension; two concurrent fetchers would
  // corrupt each other's navigation. Fail-fast on contention per plan H1.2.
  // Release happens in the outer finally below so even a throw in an adapter
  // cleanly frees the lock for the next caller.
  const releaseBrowserLock = acquireBrowserLock(`fetchUrlAndStore:${adapter}`, opts.slug);
  try {

  let result: AdapterResult;
  const extraNotes: string[] = [];
  if (dispatch) extraNotes.push(`opencli adapter: ${dispatch.friendlyName}`);

  // Check sites router FIRST. If a per-host site module matches the URL,
  // use it and skip the legacy switch below. This is the migration path
  // for the universal pattern (CLAUDE.md §5a) — each host that gets a
  // tools/sites/<host>/ module starts being routed here. The switch
  // continues to serve unmigrated hosts.
  const matchedSite = routeSite(opts.url);
  const skipLegacyDispatch = matchedSite && matchedSite.name !== "xhs";
  // Note: xhs is already handled inside `case "xiaohongshu"` below for
  // historical reasons (the dispatch case was migrated incrementally);
  // we leave that path so the existing routing still works.

  switch (adapter) {
    case "xiaohongshu": {
      // Routed through the new sites/ router (xhs is the first per-host
      // site module migrated to the target architecture). The legacy
      // `fetchXhsViaAdapter` body now lives in tools/sites/xhs/index.ts.
      const matchedSite = routeSite(opts.url);
      if (!matchedSite) {
        throw makeError("dispatch-mismatch", "L3",
          `xiaohongshu adapter dispatch did not find matching site for ${opts.url}`);
      }
      const sr = matchedSite.fetch(opts.url, { slugDir, titleHint: opts.titleHint });
      result = {
        markdown: sr.markdown,
        title: sr.title,
        imageFiles: sr.images,
        rawMetadata: sr.metadata,
        extraFlags: sr.flags.length > 0 ? sr.flags : undefined,
        adapterNotes: sr.notes,
      };
      break;
    }
    case "zhihu-article": {
      // Routed through sites/zhihu/ (universal pattern — opencli for browser
      // session only, conversion owned by us). Replaces the previous
      // fetchZhihuArticleViaAdapter which consumed opencli's lossy MD.
      const matchedSite = routeSite(opts.url);
      if (!matchedSite) {
        throw makeError("dispatch-mismatch", "L3",
          `zhihu-article adapter dispatch did not find matching site for ${opts.url}`);
      }
      const sr = matchedSite.fetch(opts.url, { slugDir, titleHint: opts.titleHint });
      result = {
        markdown: sr.markdown,
        title: sr.title,
        imageFiles: sr.images,
        rawMetadata: sr.metadata,
        extraFlags: sr.flags.length > 0 ? sr.flags : undefined,
        adapterNotes: sr.notes,
      };
      break;
    }
    case "zhihu-question": result = fetchZhihuQuestionViaAdapter(opts.url); break;
    case "weixin":         result = fetchWechatViaAdapter(opts.url, slugDir); break;
    case "web-read": {
      if (skipLegacyDispatch && matchedSite) {
        // Site router matched (e.g. github.com). Use it instead of web-read.
        const sr = matchedSite.fetch(opts.url, { slugDir, titleHint: opts.titleHint });
        result = {
          markdown: sr.markdown,
          title: sr.title,
          imageFiles: sr.images,
          rawMetadata: sr.metadata,
          extraFlags: sr.flags.length > 0 ? sr.flags : undefined,
          adapterNotes: sr.notes,
        };
        break;
      }
      // Domain-aware initial wait. Known SPAs get more time so the default
      // first attempt succeeds; the 60s auto-retry inside fetchWebReadViaAdapter
      // is still the safety net for everything else.
      const wait = getPreferredWaitSeconds(opts.url);
      if (wait !== DEFAULT_WEB_READ_WAIT_SECONDS) {
        extraNotes.push(`web-read: used domain-override wait=${wait}s`);
      }
      result = fetchWebReadViaAdapter(opts.url, slugDir, opts.downloadImages, wait);
      break;
    }
  }

  // Images are already on disk (the adapter saved them). Convert to our ImageRecord shape.
  const images: ImageRecord[] = result.imageFiles.map((basename) => ({
    local: basename,
    remote: "",  // adapters don't expose the origin URL of each asset cleanly; leave blank
    bytes: (() => {
      try { return statSync(join(slugDir, basename)).size; } catch { return 0; }
    })(),
  }));

  // Adapter-issued flags (e.g. xhs-download-silent-fail) + any adapter-level notes
  // pass through to writeRawArchive, which merges them with content-based
  // flags in classifyQuality for final quality_status.
  const adapterFlags = result.extraFlags ?? [];
  const adapterNotes = result.adapterNotes ?? [];

  // Apply optional post-process hook (hirono's POST_PROCESSORS pipeline).
  // The hook runs on the adapter's raw markdown output BEFORE we write to
  // disk. It may rewrite relative image URLs to absolute ones; the
  // resulting absolute URLs come back in extraImageUrls and get downloaded
  // via processImages.
  let finalMarkdown = result.markdown;
  const postProcessFlags: string[] = [];
  const postProcessNotes: string[] = [];
  const extraAbsoluteImageUrls: string[] = [];
  if (opts.transformMarkdown) {
    const r = opts.transformMarkdown(result.markdown, opts.url);
    finalMarkdown = r.md;
    if (r.extraFlags) postProcessFlags.push(...r.extraFlags);
    if (r.extraNotes) postProcessNotes.push(...r.extraNotes);
    if (r.extraImageUrls) extraAbsoluteImageUrls.push(...r.extraImageUrls);
  }

  // Unconditionally run processImages on the finalized markdown to catch
  // any remote `![](https://...)` refs the opencli adapter missed and
  // any new absolute URLs surfaced by the post-processor. Idempotent
  // (skips non-http refs; already-local paths). Previously this only
  // ran when the post-processor explicitly flagged new URLs, which left
  // systemic remote-ref leakage on lmsys / sspai / semianalysis / csdn
  // fetches where opencli's own --download-images is incomplete.
  const additionalImages: ImageRecord[] = [];
  if (opts.downloadImages) {
    const r = processImages(finalMarkdown, slugDir, true, opts.url);
    finalMarkdown = r.content;
    additionalImages.push(...r.images);
    if (r.notes.length > 0) postProcessNotes.push(...r.notes);
  }

  // Write content.md (or content-revN.md if append-only kicks in) + source.json.
  // Images are already in slugDir from the adapter — skip our own image download.
  return writeRawArchive({
    slug: opts.slug,
    origin: `url:${opts.url}`,
    originUrl: opts.url,
    rawMarkdown: finalMarkdown,
    title: result.title,
    fetcher: "opencli",
    fetcherReason,
    qualityFlags: [...adapterFlags, ...postProcessFlags],
    extraNotes: [
      ...extraNotes,
      ...adapterNotes,
      ...postProcessNotes,
      ...(images.length > 0 ? [`${images.length} images downloaded by adapter`] : []),
      ...(additionalImages.length > 0 ? [`${additionalImages.length} images downloaded by post-processor`] : []),
    ],
    downloadImages: false,  // already handled above
    force: opts.force,
    preExistingImages: [...images, ...additionalImages],
  });
  } finally {
    releaseBrowserLock();
  }
  } finally {
    releaseSlugLock();
  }
}

// ---------------------------------------------------------------------------
// Meta/fetch-decisions.md parser
// ---------------------------------------------------------------------------

const DECISIONS_PATH = join(REPO_ROOT, "Meta", "fetch-decisions.md");

/**
 * Parse `Meta/fetch-decisions.md` for accepted-as-is slug exceptions.
 *
 * The file format is markdown with H2 date sections; each bullet under any
 * H2 that looks like `- <slug> — <reason>` contributes one entry. We match
 * any em-dash, en-dash, or double-hyphen separator between slug and reason
 * to stay tolerant of how the user actually writes it. Anything else in
 * the file (narrative, examples in HTML comments, etc.) is ignored.
 *
 * Returns a Map<slug, reason> — useful for the status command which prints
 * the rationale alongside each decision.
 */
export function parseFetchDecisions(content: string): Map<string, string> {
  const decisions = new Map<string, string>();
  let inHtmlComment = false;
  for (const rawLine of content.split("\n")) {
    const line = rawLine;
    // Track HTML-comment blocks so the examples inside <!-- ... --> don't count.
    if (inHtmlComment) {
      if (/-->/.test(line)) inHtmlComment = false;
      continue;
    }
    if (/<!--/.test(line) && !/-->/.test(line)) {
      inHtmlComment = true;
      continue;
    }
    if (/<!--.*-->/.test(line)) continue;  // single-line comment

    // Bullet pattern: `- <slug> — <reason>` (em/en-dash or --)
    const m = line.match(/^\s*-\s+([A-Za-z0-9][A-Za-z0-9_.-]*)\s*(?:—|–|--)\s*(.+?)\s*$/);
    if (!m) continue;
    const slug = m[1];
    const reason = m[2];
    // Sanity: only accept slug-shaped strings (kebab-case, at least one hyphen or date-like)
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/i.test(slug)) continue;
    if (!decisions.has(slug)) decisions.set(slug, reason);
  }
  return decisions;
}

export function loadFetchDecisions(path: string = DECISIONS_PATH): Map<string, string> {
  if (!existsSync(path)) return new Map();
  try {
    return parseFetchDecisions(readFileSync(path, "utf8"));
  } catch {
    return new Map();
  }
}

// ---------------------------------------------------------------------------
// raw/ directory scan + source.json readers
// ---------------------------------------------------------------------------

export interface RawSlugInfo {
  slug: string;
  year: string;
  slugDir: string;
  source: SourceJson | null;      // null if source.json missing/unparseable
  hasContent: boolean;
  quality_status: QualityStatus;  // derived: "failed" if hasContent=false; else source.quality_status ?? classify live
}

/** Walk raw/<year>/<slug>/ dirs; return one RawSlugInfo per slug. */
export function listRawSlugs(rawRoot: string = RAW_DIR): RawSlugInfo[] {
  if (!existsSync(rawRoot)) return [];
  const out: RawSlugInfo[] = [];
  for (const year of readdirSync(rawRoot).sort()) {
    const yearDir = join(rawRoot, year);
    try {
      if (!statSync(yearDir).isDirectory()) continue;
    } catch { continue; }
    for (const slug of readdirSync(yearDir).sort()) {
      const slugDir = join(yearDir, slug);
      try {
        if (!statSync(slugDir).isDirectory()) continue;
      } catch { continue; }
      const contentPath = join(slugDir, "content.md");
      const sourcePath = join(slugDir, "source.json");
      const hasContent = existsSync(contentPath);
      let source: SourceJson | null = null;
      if (existsSync(sourcePath)) {
        try {
          source = JSON.parse(readFileSync(sourcePath, "utf8")) as SourceJson;
        } catch {
          source = null;
        }
      }
      let quality_status: QualityStatus;
      if (!hasContent) {
        quality_status = "failed";
      } else if (source?.quality_status) {
        quality_status = source.quality_status;
      } else {
        // Legacy source.json without quality_status — classify on the fly.
        try {
          const md = readFileSync(contentPath, "utf8");
          quality_status = classifyQuality(md).quality_status;
        } catch {
          quality_status = "flagged";
        }
      }
      out.push({ slug, year, slugDir, source, hasContent, quality_status });
    }
  }
  return out;
}

/**
 * Re-run classifyQuality over a raw/<slug>/content.md and rewrite source.json
 * with fresh quality_flags + quality_status. Leaves content.md + images
 * untouched — purely a metadata refresh. Returns the updated SourceJson.
 *
 * Used by the status / sync commands when the classifier logic itself
 * changes (e.g. new flag added) — picks up retroactive classifications
 * without an expensive re-fetch.
 */
export function reclassifyRawSlug(slug: string): SourceJson | null {
  const slugDir = rawDirFor(slug);
  const contentPath = join(slugDir, "content.md");
  const sourcePath = join(slugDir, "source.json");
  if (!existsSync(contentPath) || !existsSync(sourcePath)) return null;
  let src: SourceJson;
  try {
    src = JSON.parse(readFileSync(sourcePath, "utf8")) as SourceJson;
  } catch {
    return null;
  }
  const md = readFileSync(contentPath, "utf8");
  const declaredImageCount = extractImageUrls(md).length;
  const downloadedImageCount = src.images?.length ?? 0;
  // Preserve any adapter-only flags that classifyQuality can't re-derive
  // (xhs-download-silent-fail, image-download-failed from earlier runs).
  const preservedFlags = (src.quality_flags ?? []).filter((f) =>
    f === "xhs-download-silent-fail" || f === "image-download-failed"
  );
  const { flags, quality_status } = classifyQuality(md, {
    declaredImageCount,
    downloadedImageCount,
    extraFlags: preservedFlags,
    originUrl: src.origin_url,
  });
  src.quality_flags = flags;
  src.quality_status = quality_status;
  writeFileAtomic(sourcePath, JSON.stringify(src, null, 2) + "\n");
  return src;
}

// ---------------------------------------------------------------------------
// remediation hints — mapping flags to one-line user-actionable advice
// ---------------------------------------------------------------------------

/** Return the first actionable remediation hint for a set of quality_flags. */
export function remediationFor(flags: string[], originUrl: string = ""): string {
  const host = hostnameOf(originUrl);
  if (flags.includes("login-wall-keyword")) {
    if (/xiaohongshu|xhslink/.test(host)) {
      return "log into xiaohongshu.com in the opencli-connected Chrome, verify `opencli doctor`, then `fetch-raw.ts refetch <slug>`";
    }
    if (/zhihu/.test(host)) {
      return "log into zhihu.com in that Chrome and retry";
    }
    if (/weixin/.test(host)) {
      return "wechat requires app-scan login; open the URL in the opencli Chrome once, then retry";
    }
    return "log into the target site in the opencli-connected Chrome, then retry";
  }
  if (flags.includes("xhs-download-silent-fail")) {
    return "xhs image session exhausted — wait ~10 min, or refresh the xhs login cookie, then refetch";
  }
  if (flags.includes("loading-skeleton")) {
    return "SPA didn't fully render — either add a domain override in WEB_READ_WAIT_OVERRIDES, or refetch (auto-retries at 60s)";
  }
  if (flags.includes("short-body")) {
    return "content looks truncated — check the source URL in a browser; if genuinely short, add the slug to Meta/fetch-decisions.md";
  }
  if (flags.includes("images-declared-but-none-downloaded")) {
    return "adapter left image references but downloaded none — refetch, or add a domain selector in DISPATCH_RULES";
  }
  if (flags.includes("app-only-url")) {
    return "content is app-only and can't be fetched — add slug to Meta/fetch-decisions.md to suppress";
  }
  if (flags.includes("dead-link")) {
    return "origin URL is dead (404/410) — add slug to Meta/fetch-decisions.md or find an archive.org mirror";
  }
  return "inspect raw/<slug>/ and flag manually";
}

// ---------------------------------------------------------------------------
// commands: status + sync + refetch
// ---------------------------------------------------------------------------

export interface StatusReport {
  needsAttention: RawSlugInfo[];   // flagged OR failed, not accepted in decisions
  acceptedAsIs: Array<{ info: RawSlugInfo; reason: string }>;
  good: RawSlugInfo[];
}

export function buildStatusReport(
  rawRoot: string = RAW_DIR,
  decisionsPath: string = DECISIONS_PATH,
): StatusReport {
  const decisions = loadFetchDecisions(decisionsPath);
  const all = listRawSlugs(rawRoot);
  const needsAttention: RawSlugInfo[] = [];
  const acceptedAsIs: Array<{ info: RawSlugInfo; reason: string }> = [];
  const good: RawSlugInfo[] = [];
  for (const info of all) {
    if (info.quality_status === "good") {
      if (decisions.has(info.slug)) {
        // A "good" slug listed in decisions stays listed; harmless.
        acceptedAsIs.push({ info, reason: decisions.get(info.slug)! });
      } else {
        good.push(info);
      }
      continue;
    }
    // flagged or failed
    if (decisions.has(info.slug)) {
      acceptedAsIs.push({ info, reason: decisions.get(info.slug)! });
    } else {
      needsAttention.push(info);
    }
  }
  return { needsAttention, acceptedAsIs, good };
}

function printStatusReport(r: StatusReport): void {
  const na = r.needsAttention;
  const good = r.good;
  const accepted = r.acceptedAsIs;

  if (na.length === 0 && accepted.length === 0 && good.length === 0) {
    console.log("[status] raw/ is empty — no sources fetched yet");
    return;
  }

  console.log(`[status] ${good.length} good · ${na.length} needs-attention · ${accepted.length} accepted-as-is`);

  if (na.length > 0) {
    console.log("\n## needs attention");
    for (const info of na) {
      const flags = info.source?.quality_flags ?? [];
      const origin = info.source?.origin_url ?? "(no source.json)";
      const flagStr = info.quality_status === "failed" ? "failed" : flags.join(",") || "(unflagged but marked " + info.quality_status + ")";
      console.log(`  ${info.slug}`);
      console.log(`    status: ${info.quality_status}  flags: ${flagStr}`);
      console.log(`    origin: ${origin}`);
      console.log(`    fix:    ${remediationFor(flags, origin)}`);
    }
  }

  if (accepted.length > 0) {
    console.log("\n## accepted-as-is (Meta/fetch-decisions.md)");
    for (const { info, reason } of accepted) {
      console.log(`  ${info.slug} — ${reason}`);
    }
  }

  if (good.length > 0 && process.env.FETCH_RAW_STATUS_QUIET !== "1") {
    console.log(`\n## good (${good.length})`);
    if (good.length <= 20) {
      for (const info of good) console.log(`  ${info.slug}`);
    } else {
      console.log(`  (${good.length} slugs; set FETCH_RAW_STATUS_QUIET=1 to hide, or this section is elided at >20)`);
      for (const info of good.slice(0, 10)) console.log(`  ${info.slug}`);
      console.log(`  ... +${good.length - 10} more`);
    }
  }
}

/**
 * Sync strategy:
 *
 *   For each candidate slug (union of existing raw/ dirs + ingest_batch pending
 *   entries that carry a slug field), decide whether to (re)fetch based on:
 *     - quality_status  (good → skip unless --only or --retry-flagged on flagged)
 *     - decisions file  (listed → skip unless --only)
 *     - --only filter   (whitelist)
 *     - --limit         (cap total fetches per run)
 *
 *   The intent: make `sync` safe to re-run repeatedly. First run pays for
 *   everything that needs attention; subsequent runs do zero work unless
 *   new candidates arrived or flagged slugs are being retried.
 */
export interface SyncOpts {
  limit?: number;
  retryFlagged: boolean;
  only?: Set<string>;
  dryRun: boolean;
  reclassify: boolean;    // re-run classifier over existing raw/ before deciding
  ingestBatchPath?: string;  // override for tests
  decisionsPath?: string;
  rawRoot?: string;
}

export interface SyncPlanItem {
  slug: string;
  action: "fetch" | "skip-good" | "skip-decisioned" | "skip-no-origin" | "skip-not-in-only" | "skip-over-limit";
  origin?: string;
  originUrl?: string;
  reason: string;
}

export function buildSyncPlan(opts: SyncOpts): SyncPlanItem[] {
  const decisions = loadFetchDecisions(opts.decisionsPath ?? DECISIONS_PATH);
  const rawRoot = opts.rawRoot ?? RAW_DIR;

  if (opts.reclassify) {
    for (const info of listRawSlugs(rawRoot)) {
      if (info.hasContent) reclassifyRawSlug(info.slug);
    }
  }

  const existing = listRawSlugs(rawRoot);
  const bySlug = new Map<string, RawSlugInfo>();
  for (const info of existing) bySlug.set(info.slug, info);

  // Merge in ingest_batch pending entries (if any) that have a slug
  let batchEntries: Array<{ slug: string; origin?: string; url?: string }> = [];
  const batchPath = opts.ingestBatchPath ?? join(REPO_ROOT, ".wiki-batch-state.json");
  if (existsSync(batchPath)) {
    try {
      const state = JSON.parse(readFileSync(batchPath, "utf8")) as {
        entries?: Record<string, { id: string; url: string; status: string; slug?: string }>;
      };
      for (const e of Object.values(state.entries ?? {})) {
        if (e.status !== "pending" || !e.slug) continue;
        batchEntries.push({ slug: e.slug, origin: e.id, url: e.url });
      }
    } catch {}
  }

  const plan: SyncPlanItem[] = [];
  const seenSlugs = new Set<string>();

  // Existing raw/ slugs first
  for (const info of existing) {
    seenSlugs.add(info.slug);
    if (opts.only && !opts.only.has(info.slug)) {
      plan.push({ slug: info.slug, action: "skip-not-in-only", reason: "not in --only filter" });
      continue;
    }
    if (decisions.has(info.slug)) {
      plan.push({
        slug: info.slug,
        action: "skip-decisioned",
        reason: `accepted-as-is: ${decisions.get(info.slug)}`,
      });
      continue;
    }
    if (info.quality_status === "good") {
      if (opts.only && opts.only.has(info.slug)) {
        // explicit --only → fetch anyway (user asked)
        plan.push({
          slug: info.slug,
          action: "fetch",
          origin: info.source?.origin,
          originUrl: info.source?.origin_url,
          reason: "forced by --only",
        });
      } else {
        plan.push({ slug: info.slug, action: "skip-good", reason: "quality_status=good" });
      }
      continue;
    }
    // flagged or failed
    if (info.quality_status === "flagged" && !opts.retryFlagged && !opts.only) {
      plan.push({ slug: info.slug, action: "skip-good", reason: "flagged (pass --retry-flagged to re-fetch)" });
      continue;
    }
    if (!info.source?.origin || !info.source?.origin_url) {
      plan.push({ slug: info.slug, action: "skip-no-origin", reason: "source.json missing origin info" });
      continue;
    }
    plan.push({
      slug: info.slug,
      action: "fetch",
      origin: info.source.origin,
      originUrl: info.source.origin_url,
      reason: info.quality_status === "failed" ? "no content on disk" : "flagged; retrying",
    });
  }

  // Then ingest_batch pending entries we haven't already seen
  for (const be of batchEntries) {
    if (seenSlugs.has(be.slug)) continue;
    if (opts.only && !opts.only.has(be.slug)) {
      plan.push({ slug: be.slug, action: "skip-not-in-only", reason: "not in --only filter" });
      continue;
    }
    if (decisions.has(be.slug)) {
      plan.push({
        slug: be.slug,
        action: "skip-decisioned",
        reason: `accepted-as-is: ${decisions.get(be.slug)}`,
      });
      continue;
    }
    if (!be.url) {
      plan.push({ slug: be.slug, action: "skip-no-origin", reason: "ingest_batch entry has no URL" });
      continue;
    }
    plan.push({
      slug: be.slug,
      action: "fetch",
      origin: be.origin,
      originUrl: be.url,
      reason: "new from ingest_batch pending queue",
    });
  }

  // Apply --limit to the fetch actions only
  if (typeof opts.limit === "number" && opts.limit >= 0) {
    let fetched = 0;
    for (const item of plan) {
      if (item.action !== "fetch") continue;
      if (fetched >= opts.limit) {
        item.action = "skip-over-limit";
        item.reason = `--limit ${opts.limit} reached`;
      } else {
        fetched++;
      }
    }
  }

  return plan;
}

/** Execute a single fetch plan item. Dispatches by origin prefix. Returns the SourceJson written, or null on caller-visible error. */
function executeFetchPlanItem(item: SyncPlanItem, downloadImages: boolean): SourceJson | null {
  if (item.action !== "fetch" || !item.origin || !item.originUrl) return null;
  const origin = item.origin;
  const originUrl = item.originUrl;

  if (origin.startsWith("lark:")) {
    const token = origin.slice("lark:".length);
    const r = fetchViaLarkHirono(token);
    return writeRawArchive({
      slug: item.slug,
      origin,
      originUrl,
      rawMarkdown: r.content,
      fetcher: "lark-hirono",
      fetcherReason: "direct",
      larkMeta: { node_token: token, title: r.title },
      downloadImages,
      force: true,
    });
  }

  // Raindrop origins need caller-side MCP fetch — we can't do that from here.
  // If the URL points to an article-like page we can scrape, use the URL path.
  if (origin.startsWith("raindrop:")) {
    // We still have the URL; fall through to url-based fetch.
    return fetchUrlAndStore({
      slug: item.slug,
      url: originUrl,
      viaBrowser: false,
      downloadImages,
      force: true,
    });
  }

  // url: origin OR any other — treat as web URL.
  return fetchUrlAndStore({
    slug: item.slug,
    url: originUrl,
    viaBrowser: false,
    downloadImages,
    force: true,
  });
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function argVal(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function argFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function usage(): never {
  console.error(`usage:
  tsx fetch-raw.ts store <slug> --origin <origin> --origin-url <url> \\
       [--input <path> | (default stdin)] [--title <title>] \\
       [--raindrop-meta <path>] [--lark-meta <path>] [--no-images] [--force]
  tsx fetch-raw.ts fetch-lark <node-token> --slug <slug> [--no-images] [--force]
  tsx fetch-raw.ts fetch-url <url> --slug <slug> [--via-browser] [--no-images] [--force]
  tsx fetch-raw.ts verify <slug>
  tsx fetch-raw.ts status [--quiet]
       Walk raw/ + Meta/fetch-decisions.md; group slugs by quality; print
       actionable remediation hints.
  tsx fetch-raw.ts sync [--limit N] [--retry-flagged] [--only <slug,...>] \\
       [--dry-run] [--reclassify] [--no-images]
       Idempotent (re)fetch over raw/ + ingest_batch pending queue.
       Skips good slugs + decisions; only --retry-flagged touches flagged
       slugs that have no decision. --dry-run shows the plan.
  tsx fetch-raw.ts refetch <slug> [--no-images]
       Force single-slug re-fetch using the origin recorded in source.json.
       Preserves append-only semantics (writes content-rev2.md, etc.).`);
  process.exit(2);
}

function readAll(path: string | undefined): string {
  if (path) return readFileSync(resolve(path), "utf8");
  // stdin
  const chunks: Buffer[] = [];
  let data: Buffer | null;
  const fs = require("node:fs") as typeof import("node:fs");
  const fd = 0;
  try {
    const buf = Buffer.alloc(65536);
    while (true) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (n === 0) break;
      chunks.push(Buffer.from(buf.subarray(0, n)));
    }
  } catch {}
  return Buffer.concat(chunks).toString("utf8");
}

function cmdStore(positional: string[], args: string[]): void {
  const slug = positional[0];
  if (!slug) usage();
  const origin = argVal(args, "--origin");
  const originUrl = argVal(args, "--origin-url");
  if (!origin || !originUrl) usage();
  const input = argVal(args, "--input");
  const title = argVal(args, "--title");
  const raindropMetaPath = argVal(args, "--raindrop-meta");
  const larkMetaPath = argVal(args, "--lark-meta");
  const downloadImages = !argFlag(args, "--no-images");
  const force = argFlag(args, "--force");

  const rawMarkdown = readAll(input);
  if (!rawMarkdown.trim()) {
    console.error("fetch-raw store: empty input — nothing to write");
    process.exit(2);
  }

  const raindropMeta = raindropMetaPath
    ? (JSON.parse(readFileSync(resolve(raindropMetaPath), "utf8")) as RaindropMeta)
    : undefined;
  const larkMeta = larkMetaPath
    ? (JSON.parse(readFileSync(resolve(larkMetaPath), "utf8")) as LarkMeta)
    : undefined;

  const fetcher: FetcherKind = origin.startsWith("raindrop:")
    ? "raindrop-mcp-piped"
    : origin.startsWith("lark:")
    ? "lark-hirono"
    : "url-static";
  const src = writeRawArchive({
    slug,
    origin: origin!,
    originUrl: originUrl!,
    rawMarkdown,
    title,
    fetcher,
    fetcherReason: "direct",
    raindropMeta,
    larkMeta,
    downloadImages,
    force,
  });
  console.log(`[store] raw/${yearForSlug(slug)}/${slug}/ (${src.content_length} chars, ${src.images.length} images, flags=${src.quality_flags.join(",") || "none"})`);
}

function cmdFetchLark(positional: string[], args: string[]): void {
  const nodeToken = positional[0];
  if (!nodeToken) usage();
  const slug = argVal(args, "--slug");
  if (!slug) usage();
  const downloadImages = !argFlag(args, "--no-images");
  const force = argFlag(args, "--force");

  const r = fetchViaLarkHirono(nodeToken);
  const src = writeRawArchive({
    slug,
    origin: `lark:${nodeToken}`,
    originUrl: `https://my.feishu.cn/wiki/${nodeToken}`,
    rawMarkdown: r.content,
    fetcher: "lark-hirono",
    fetcherReason: "direct",
    larkMeta: { node_token: nodeToken, title: r.title },
    downloadImages,
    force,
  });
  console.log(`[fetch-lark] raw/${yearForSlug(slug)}/${slug}/ (${src.content_length} chars, ${src.images.length} images)`);
}

function cmdFetchUrl(positional: string[], args: string[]): void {
  const url = positional[0];
  if (!url) usage();
  const slug = argVal(args, "--slug");
  if (!slug) usage();
  const viaBrowser = argFlag(args, "--via-browser");
  const downloadImages = !argFlag(args, "--no-images");
  const force = argFlag(args, "--force");

  const src = fetchUrlAndStore({ slug, url, viaBrowser, downloadImages, force });
  console.log(
    `[fetch-url] raw/${yearForSlug(slug)}/${slug}/ ` +
    `(fetcher=${src.fetcher} reason=${src.fetcher_reason} ${src.content_length} chars, ${src.images.length} images, flags=${src.quality_flags.join(",") || "none"})`,
  );
}

function cmdVerify(positional: string[]): void {
  const slug = positional[0];
  if (!slug) usage();
  const dir = rawDirFor(slug);
  const probs: string[] = [];
  if (!existsSync(dir)) probs.push(`dir missing: ${dir}`);
  if (!existsSync(join(dir, "content.md"))) probs.push(`content.md missing`);
  if (!existsSync(join(dir, "source.json"))) probs.push(`source.json missing`);
  else {
    try {
      const src = JSON.parse(readFileSync(join(dir, "source.json"), "utf8"));
      if (!src.origin || !src.fetcher) probs.push(`source.json missing required fields`);
    } catch (err) {
      probs.push(`source.json unparseable: ${(err as Error).message}`);
    }
  }
  if (probs.length === 0) {
    console.log(`[verify] ✓ ${slug}`);
    return;
  }
  for (const p of probs) console.log(`[verify] ✗ ${slug}: ${p}`);
  process.exit(1);
}

function cmdStatus(args: string[]): void {
  if (argFlag(args, "--quiet")) process.env.FETCH_RAW_STATUS_QUIET = "1";
  // Always re-classify on status — cheap, and makes the report reflect any
  // classifier-logic changes since last fetch.
  for (const info of listRawSlugs()) {
    if (info.hasContent) reclassifyRawSlug(info.slug);
  }
  const report = buildStatusReport();
  printStatusReport(report);
  // Exit non-zero if anything needs attention — caller can treat this like
  // lint: any needsAttention → fail the batch close.
  if (report.needsAttention.length > 0) process.exit(1);
}

function cmdSync(args: string[]): void {
  const limitStr = argVal(args, "--limit");
  const limit = limitStr !== undefined ? parseInt(limitStr, 10) : undefined;
  const retryFlagged = argFlag(args, "--retry-flagged");
  const onlyStr = argVal(args, "--only");
  const only = onlyStr
    ? new Set(onlyStr.split(",").map((s) => s.trim()).filter(Boolean))
    : undefined;
  const dryRun = argFlag(args, "--dry-run");
  const downloadImages = !argFlag(args, "--no-images");
  const reclassify = !argFlag(args, "--no-reclassify");  // default on

  const plan = buildSyncPlan({
    limit: typeof limit === "number" && !isNaN(limit) ? limit : undefined,
    retryFlagged,
    only,
    dryRun,
    reclassify,
  });

  const toFetch = plan.filter((p) => p.action === "fetch");
  const skipped = plan.length - toFetch.length;
  console.log(`[sync] plan: ${toFetch.length} fetch, ${skipped} skip`);

  if (toFetch.length > 0) {
    console.log("\n## will fetch");
    for (const item of toFetch) {
      console.log(`  ${item.slug}  ←  ${item.originUrl ?? "(no url)"}  (${item.reason})`);
    }
  }
  if (skipped > 0 && argFlag(args, "--verbose")) {
    console.log("\n## will skip");
    for (const item of plan.filter((p) => p.action !== "fetch")) {
      console.log(`  ${item.action.padEnd(18)} ${item.slug}  (${item.reason})`);
    }
  }

  if (dryRun) {
    console.log("\n[sync] --dry-run: no side effects");
    return;
  }

  if (toFetch.length === 0) {
    console.log("\n[sync] nothing to do ✓");
    return;
  }

  let ok = 0;
  let failed = 0;
  for (const item of toFetch) {
    console.log(`\n[sync] fetching ${item.slug} …`);
    try {
      const src = executeFetchPlanItem(item, downloadImages);
      if (src) {
        const flagStr = src.quality_flags.length ? src.quality_flags.join(",") : "none";
        console.log(`[sync] ✓ ${item.slug} (status=${src.quality_status}, flags=${flagStr})`);
        ok++;
      } else {
        console.log(`[sync] skipped ${item.slug} (no executor for origin)`);
      }
    } catch (err) {
      failed++;
      const fe = err as FetchError;
      if (fe.level && fe.code) {
        console.error(`[sync] ✗ ${item.slug} — ${fe.level} ${fe.code}: ${fe.message}`);
        if (fe.remediation) console.error(`  remediation: ${fe.remediation}`);
        if (fe.level === "L3") {
          console.error(`[sync] L3 halts batch — exiting`);
          process.exit(1);
        }
      } else {
        console.error(`[sync] ✗ ${item.slug} — ${(err as Error).message}`);
      }
    }
  }
  console.log(`\n[sync] done: ${ok} ok, ${failed} failed, ${skipped} skipped`);
}

function cmdRefetch(positional: string[], args: string[]): void {
  const slug = positional[0];
  if (!slug) usage();
  const downloadImages = !argFlag(args, "--no-images");
  const slugDir = rawDirFor(slug);
  const sourcePath = join(slugDir, "source.json");
  if (!existsSync(sourcePath)) {
    console.error(`[refetch] no source.json at ${sourcePath} — use fetch-url / fetch-lark first`);
    process.exit(2);
  }
  const src = JSON.parse(readFileSync(sourcePath, "utf8")) as SourceJson;
  const item: SyncPlanItem = {
    slug,
    action: "fetch",
    origin: src.origin,
    originUrl: src.origin_url,
    reason: "forced refetch",
  };
  const out = executeFetchPlanItem(item, downloadImages);
  if (!out) {
    console.error(`[refetch] nothing produced (no executor matched origin "${src.origin}")`);
    process.exit(1);
  }
  console.log(
    `[refetch] raw/${yearForSlug(slug)}/${slug}/ ` +
    `(status=${out.quality_status}, ${out.content_length} chars, ${out.images.length} images, flags=${out.quality_flags.join(",") || "none"})`,
  );
}

function main(): void {
  const [cmd, ...rest] = process.argv.slice(2);
  const positional: string[] = [];
  const flags: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      flags.push(a);
      // Peek next arg — consume if not another flag
      if (i + 1 < rest.length && !rest[i + 1].startsWith("--")) {
        flags.push(rest[++i]);
      }
    } else {
      positional.push(a);
    }
  }

  try {
    switch (cmd) {
      case "store":       cmdStore(positional, flags); break;
      case "fetch-lark":  cmdFetchLark(positional, flags); break;
      case "fetch-url":   cmdFetchUrl(positional, flags); break;
      case "verify":      cmdVerify(positional); break;
      case "status":      cmdStatus(flags); break;
      case "sync":        cmdSync(flags); break;
      case "refetch":     cmdRefetch(positional, flags); break;
      default:            usage();
    }
  } catch (err) {
    const fe = err as FetchError;
    if (fe.level && fe.code) {
      console.error(`[fetch-raw] ${fe.level} ${fe.code}: ${fe.message}`);
      if (fe.remediation) console.error(`  remediation: ${fe.remediation}`);
      process.exit(fe.level === "L1" ? 2 : fe.level === "L2" ? 0 : 1);
    }
    throw err;
  }
}

const isEntryPoint =
  process.argv[1] !== undefined && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main();
