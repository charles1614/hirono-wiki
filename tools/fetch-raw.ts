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
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

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
  { match: (_u, h) => h === "wiki.litenext.digital", waitSeconds: 20 },
  // Notion (personal + team workspaces) — heavy client rendering
  { match: (_u, h) => h === "notion.so" || /\.notion\.so$/i.test(h), waitSeconds: 20 },
  // Vercel preview deployments — typically next.js SSG+hydration
  { match: (_u, h) => /\.vercel\.app$/i.test(h), waitSeconds: 20 },
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
}

export interface QualityResult {
  suspicious: boolean;
  flags: string[];
  quality_status: QualityStatus;
}

export function classifyQuality(content: string, ctx: QualityContext = {}): QualityResult {
  const flags: string[] = [];
  const trimmed = content.trim();
  if (trimmed.length < 500) flags.push("short-body");
  for (const kw of LOGIN_WALL_KEYWORDS) {
    if (trimmed.includes(kw)) {
      flags.push("login-wall-keyword");
      break;
    }
  }
  for (const kw of LOADING_SKELETON_KEYWORDS) {
    if (trimmed.includes(kw)) {
      flags.push("loading-skeleton");
      break;
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

/** Download one image via curl. Returns bytes downloaded, or -1 on failure. */
function downloadImage(url: string, destPath: string, maxBytes = 15 * 1024 * 1024): number {
  // curl with max-filesize, connect-timeout, and output to disk. Returns 0 on success.
  const res = spawnSync(
    "curl",
    [
      "-fsSL",
      "--max-filesize", String(maxBytes),
      "--connect-timeout", "10",
      "--max-time", "30",
      "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "-o", destPath,
      url,
    ],
    { encoding: "utf8", timeout: 40_000 },
  );
  if (res.status !== 0) return -1;
  try { return statSync(destPath).size; } catch { return -1; }
}

/** Download images + rewrite references in the markdown to local paths. */
export function processImages(content: string, slugDir: string, enabled: boolean): { content: string; images: ImageRecord[]; notes: string[] } {
  if (!enabled) return { content, images: [], notes: ["images: skipped (--no-images)"] };
  const urls = extractImageUrls(content).filter((u) => /^https?:\/\//i.test(u));
  if (urls.length === 0) return { content, images: [], notes: [] };
  const records: ImageRecord[] = [];
  const notes: string[] = [];
  let rewritten = content;
  urls.forEach((url, i) => {
    const local = localNameFor(url, i + 1);
    const dest = join(slugDir, local);
    const bytes = downloadImage(url, dest);
    if (bytes < 0) {
      notes.push(`image download failed: ${url}`);
      return;
    }
    records.push({ local, remote: url, bytes });
    // Rewrite all occurrences of the remote URL → local filename
    rewritten = rewritten.split(url).join(local);
  });
  return { content: rewritten, images: records, notes };
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

  writeFileSync(join(slugDir, contentFile), md, "utf8");

  // Derive declared-image count from the final markdown (after rewrites). If
  // the content references images but the images array is empty, that's
  // an adapter silently-failed download — classifyQuality flags it.
  const declaredImageCount = extractImageUrls(md).length;

  const { suspicious, flags: qualityFlags, quality_status } = classifyQuality(md, {
    declaredImageCount,
    downloadedImageCount: images.length,
    extraFlags: args.qualityFlags,
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
  writeFileSync(join(slugDir, "source.json"), JSON.stringify(src, null, 2) + "\n", "utf8");

  if (suspicious) {
    logL2Issue(args.slug, qualityFlags.join(","), args.originUrl);
  }
  return src;
}

// ---------------------------------------------------------------------------
// opencli native adapters
// ---------------------------------------------------------------------------

function runOpencli(args: string[], opts: { timeoutMs?: number } = {}): string {
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

function opencliDoctorOk(): boolean {
  const out = spawnSync("opencli", ["doctor"], { encoding: "utf8", timeout: 10_000 });
  return out.stdout.includes("[OK] Extension:") && out.stdout.includes("[OK] Connectivity:");
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
function harvestAdapterOutput(slugDir: string, afterMtime: number): { content: string; images: string[] } {
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
    } catch {}
  }

  if (mdSource && subdirs.length === 0) {
    // Flat; just read it.
    return {
      content: readFileSync(mdSource, "utf8"),
      images: flatImagesAtRoot,
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
    } catch {}
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
      try { renameSync(src, dst); } catch {}
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
  try { rmSync(target, { recursive: true, force: true }); } catch {}

  return {
    content,
    images: [...flatImagesAtRoot, ...imagesMoved],
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
function collectXhsAssets(slugDir: string, afterMtime: number): string[] {
  const files: string[] = [];
  for (const f of readdirSync(slugDir)) {
    try {
      const st = statSync(join(slugDir, f));
      if (
        st.isFile() &&
        st.mtimeMs >= afterMtime - 1000 &&
        /\.(jpe?g|png|webp|mp4|mov|gif|avif)$/i.test(f)
      ) {
        files.push(f);
      }
    } catch {}
  }
  return files;
}

/** Small blocking sleep (we're serial + deliberate here; no Node event-loop concerns). */
function sleepMs(ms: number): void {
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

function fetchXhsViaAdapter(url: string, slugDir: string): AdapterResult {
  const beforeMtime = Date.now();
  mkdirSync(slugDir, { recursive: true });

  // (1) Fetch markdown content
  const noteStdout = runOpencli(
    ["xiaohongshu", "note", url, "-f", "md"],
    { timeoutMs: 90_000 },
  );
  if (!noteStdout.trim()) {
    throw makeError(
      "parse-failure", "L3",
      `xiaohongshu note returned empty for ${url}`,
      { remediation: "verify URL has a valid xsec_token; try opening the URL in the opencli Chrome" },
    );
  }

  // (2) Download images/videos. Best-effort: a failure here is L2, not L3.
  //     xhs has a known silent-failure mode where the download subcommand
  //     exits 0 but produces zero files on repeat calls in the same session.
  //     Mitigation: if we see 0 assets after the first call, sleep 5s and
  //     retry once. Still zero → flag xhs-download-silent-fail (L2).
  const adapterNotes: string[] = [];
  const extraFlags: string[] = [];
  let imageFiles: string[] = [];
  let downloadCallSucceeded = false;
  try {
    runOpencli(
      ["xiaohongshu", "download", url, "--output", slugDir, "-f", "json"],
      { timeoutMs: 120_000 },
    );
    downloadCallSucceeded = true;
    imageFiles = collectXhsAssets(slugDir, beforeMtime);
  } catch {
    // First attempt errored. Keep going; note content still useful.
    adapterNotes.push("xhs download errored on first attempt");
  }

  if (downloadCallSucceeded && imageFiles.length === 0) {
    // Retry once after 5s — the xhs server occasionally drops repeat downloads
    // within a session; a short gap clears it.
    adapterNotes.push("xhs download produced 0 files; retrying once after 5s");
    sleepMs(5_000);
    const retryMtime = Date.now();
    try {
      runOpencli(
        ["xiaohongshu", "download", url, "--output", slugDir, "-f", "json"],
        { timeoutMs: 120_000 },
      );
      imageFiles = collectXhsAssets(slugDir, retryMtime);
    } catch {
      adapterNotes.push("xhs download retry errored");
    }
    if (imageFiles.length === 0) {
      extraFlags.push("xhs-download-silent-fail");
      adapterNotes.push("xhs download silently failed twice — accepting note-only content");
    } else {
      adapterNotes.push(`xhs download retry recovered ${imageFiles.length} files`);
    }
  }

  // (3) Remove any empty subdirectory the download command created
  for (const e of readdirSync(slugDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const subdir = join(slugDir, e.name);
    try {
      if (readdirSync(subdir).length === 0) rmSync(subdir, { recursive: true, force: true });
    } catch {}
  }

  // (4) Assemble final markdown: note stdout + image-list section
  let markdown = noteStdout.trim() + "\n";
  if (imageFiles.length > 0) {
    markdown += "\n## Images\n\n";
    imageFiles.sort();
    for (const f of imageFiles) markdown += `![${f}](${f})\n`;
    markdown += "\n";
  }

  return { markdown, imageFiles, rawMetadata: null, extraFlags, adapterNotes };
}

/** Native zhihu article adapter: zhuanlan.zhihu.com/p/<id> */
function fetchZhihuArticleViaAdapter(url: string, slugDir: string): AdapterResult {
  const beforeMtime = Date.now();
  mkdirSync(slugDir, { recursive: true });
  const stdout = runOpencli(
    ["zhihu", "download", "--url", url, "--output", slugDir, "--download-images", "true", "-f", "json"],
    { timeoutMs: 120_000 },
  );
  const h = harvestAdapterOutput(slugDir, beforeMtime);
  return { markdown: h.content, imageFiles: h.images, rawMetadata: tryParseJsonLines(stdout) };
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

/** Native WeChat adapter: mp.weixin.qq.com/s/<id> */
function fetchWechatViaAdapter(url: string, slugDir: string): AdapterResult {
  const beforeMtime = Date.now();
  mkdirSync(slugDir, { recursive: true });
  const stdout = runOpencli(
    ["weixin", "download", "--url", url, "--output", slugDir, "--download-images", "true", "-f", "json"],
    { timeoutMs: 120_000 },
  );
  const h = harvestAdapterOutput(slugDir, beforeMtime);
  return { markdown: h.content, imageFiles: h.images, rawMetadata: tryParseJsonLines(stdout) };
}

/**
 * Generic `opencli web read` — works for any URL the user can read in their
 * logged-in Chrome. `--wait` is bumped to 10s (vs the default 3) so
 * client-rendered SPAs (DeepWiki, Vercel docs, Notion pages) have time to
 * hydrate before content is scraped. Adds ~7s per fetch — tolerable at v1
 * scale, and we auto-retry with 60s on short-body / loading-skeleton flags
 * (empirically: DeepWiki needs ~60s for its article body to fully render).
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
  const result: AdapterResult = { markdown: h.content, imageFiles: h.images, rawMetadata: tryParseJsonLines(stdout) };

  // Heuristic retry: if we got a suspiciously-short result or explicit
  // "Loading…" skeleton (common on client-rendered SPAs), retry ONCE with
  // a 60-second wait. Bounded to one retry — avoids pathological delays.
  if (waitSeconds < 60) {
    const q = classifyQuality(result.markdown);
    const suspiciousForRetry = q.flags.includes("short-body") || q.flags.includes("loading-skeleton");
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
  return result;
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

interface FetchUrlOpts {
  slug: string;
  url: string;
  viaBrowser: boolean;
  downloadImages: boolean;
  force: boolean;
}

function fetchUrlAndStore(opts: FetchUrlOpts): SourceJson {
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

  let result: AdapterResult;
  const extraNotes: string[] = [];
  if (dispatch) extraNotes.push(`opencli adapter: ${dispatch.friendlyName}`);

  switch (adapter) {
    case "xiaohongshu":    result = fetchXhsViaAdapter(opts.url, slugDir); break;
    case "zhihu-article":  result = fetchZhihuArticleViaAdapter(opts.url, slugDir); break;
    case "zhihu-question": result = fetchZhihuQuestionViaAdapter(opts.url); break;
    case "weixin":         result = fetchWechatViaAdapter(opts.url, slugDir); break;
    case "web-read": {
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

  // Write content.md (or content-revN.md if append-only kicks in) + source.json.
  // Images are already in slugDir from the adapter — skip our own image download.
  return writeRawArchive({
    slug: opts.slug,
    origin: `url:${opts.url}`,
    originUrl: opts.url,
    rawMarkdown: result.markdown,
    title: result.title,
    fetcher: "opencli",
    fetcherReason,
    qualityFlags: adapterFlags,
    extraNotes: [
      ...extraNotes,
      ...adapterNotes,
      ...(images.length > 0 ? [`${images.length} images downloaded by adapter`] : []),
    ],
    downloadImages: false,  // adapter already did this; don't double-dip
    force: opts.force,
    preExistingImages: images,
  });
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
  });
  src.quality_flags = flags;
  src.quality_status = quality_status;
  writeFileSync(sourcePath, JSON.stringify(src, null, 2) + "\n", "utf8");
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
