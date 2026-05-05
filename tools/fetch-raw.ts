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
import { acquireBrowserLock, acquireSlugLock } from "./shared/browser-lock.ts";
import { routeSite } from "./sites/index.ts";
import { extractJsonFromEvalStdout } from "./sites/_shared/browser-eval-json.ts";
import { convertGenericHtml } from "./sites/_shared/generic-converter.ts";

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
// hostname helpers
// ---------------------------------------------------------------------------

export function hostnameOf(url: string): string {
  try { return new URL(url).hostname; } catch { return ""; }
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

export function makeError(code: string, level: ErrorLevel, message: string, extras: Partial<FetchError> = {}): FetchError {
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
   * Omitted for callers that only have markdown without URL.
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
export function downloadImage(url: string, destPath: string, maxBytes = 15 * 1024 * 1024, referer?: string): number {
  const tmpPath = `${destPath}.part`;
  // curl with max-filesize, connect-timeout, and output to disk. Returns 0 on success.
  // Some CDNs (sspai's cdnfile.sspai.com, weixin's mmbiz, etc.) reject
  // requests without a Referer matching the article's origin — pass `referer`
  // to satisfy hotlink protection.
  const args = [
    "-fsSL",
    "--max-filesize", String(maxBytes),
    "--connect-timeout", "10",
    "--max-time", "30",
    "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  ];
  if (referer) args.push("-e", referer);
  args.push("-o", tmpPath, url);
  const res = spawnSync("curl", args, { encoding: "utf8", timeout: 40_000 });
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
function processImages(content: string, slugDir: string, enabled: boolean, originUrl?: string): { content: string; images: ImageRecord[]; notes: string[] } {
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


/**
 * Internal shape used by `fetchUrlAndStore` to bridge the site-module
 * `Result` into the format `writeRawArchive` consumes (with image
 * basenames + extra flags surfaced separately for `classifyQuality`).
 */
interface AdapterResult {
  markdown: string;
  title?: string;
  imageFiles: string[];   // assets saved alongside the markdown (basenames, relative to slugDir)
  rawMetadata: unknown;   // whatever the site module's metadata field carried
  /** Optional site-module quality flags to merge into classifyQuality. */
  extraFlags?: string[];
  /** Optional human-readable notes (e.g. "xhs Layer-4: 5 paragraphs"). */
  adapterNotes?: string[];
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

  const slugDir = rawDirFor(opts.slug);
  mkdirSync(slugDir, { recursive: true });

  // Routing is total: every URL maps to a site module under
  // `tools/sites/<host>/`, with `tools/sites/_default/` catching
  // anything no host-specific module claimed. See
  // `docs/fetcher-architecture.md` for the architectural rationale.
  const matchedSite = routeSite(opts.url);
  const fetcherReason: FetcherReason = opts.viaBrowser
    ? "forced-via-browser"
    : matchedSite.name === "_default"
    ? "direct"
    : "domain-override";

  // Acquire the per-slug fetch lock BEFORE the machine-wide browser lock.
  // This catches the case where two processes both target the same slug —
  // they'd both pass the browser-lock check (if releases interleave) but
  // still corrupt each other's raw/<slug>/ writes. Release order: slug
  // lock released last, after the browser lock is free (LIFO pattern is
  // cleanest; we implement via the finally ordering below).
  const releaseSlugLock = acquireSlugLock(slugDir, opts.slug);
  try {

  // Acquire the machine-wide opencli browser lock. Site modules that use
  // browser-eval (xhs, weixin, zhihu) drive one shared Chrome tab via the
  // opencli extension; concurrent runs would corrupt each other's
  // navigation. Modules that use plain curl don't need it but acquiring
  // is cheap. Released in the outer finally below.
  const releaseBrowserLock = acquireBrowserLock(`fetchUrlAndStore:${matchedSite.name}`, opts.slug);
  try {

  let result: AdapterResult;
  const extraNotes: string[] = [`site module: ${matchedSite.name}`];

  // Single dispatch point. The site module owns the full pipeline
  // (fetch + convert + image download) and returns a §2-shaped Result.
  {
    const sr = matchedSite.fetch(opts.url, { slugDir, titleHint: opts.titleHint });
    result = {
      markdown: sr.markdown,
      title: sr.title,
      imageFiles: sr.images,
      rawMetadata: sr.metadata,
      extraFlags: sr.flags.length > 0 ? sr.flags : undefined,
      adapterNotes: sr.notes,
    };
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
  // any remote `![](https://...)` refs that survived the site module's
  // own image localization, and any new absolute URLs surfaced by the
  // transformMarkdown hook. Idempotent (skips non-http refs and
  // already-local paths).
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
function reclassifyRawSlug(slug: string): SourceJson | null {
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
    return "SPA didn't fully render — promote the host to a dedicated site module under tools/sites/<host>/ that uses opencli browser-eval (see xhs/weixin/zhihu for reference)";
  }
  if (flags.includes("short-body")) {
    return "content looks truncated — check the source URL in a browser; if genuinely short, add the slug to Meta/fetch-decisions.md";
  }
  if (flags.includes("images-declared-but-none-downloaded")) {
    return "site module emitted image refs but downloaded none — refetch, or fix the module's image-download loop";
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
