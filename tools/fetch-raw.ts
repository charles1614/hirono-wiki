/**
 * fetch-raw: library for raw-source acquisition and archive layout.
 *
 * Provides:
 *   - `fetchUrlAndStore(opts)` — the main dispatch. Routes URL through
 *     `routeSite()` (always total via the catch-all `_default` module),
 *     runs the result through `processImages` + `applyPostCleanups`,
 *     writes to raw/<year>/<slug>/.
 *   - `writeRawArchive(args)` — write pre-fetched markdown + images.
 *   - `classifyQuality(content, ctx)` — flag short bodies, login walls,
 *     loading skeletons; surface `intentional-stub` correctly.
 *   - Status reporting helpers: `listRawSlugs`, `parseFetchDecisions`,
 *     `buildStatusReport`, `buildSyncPlan`, `executeFetchPlanItem`,
 *     `printStatusReport`, `remediationFor`.
 *   - Type contracts: `SourceJson`, `FetcherKind`, `ImageRecord`,
 *     `FetchUrlOpts`, `StatusReport`, etc.
 *
 * Invoked from the CLI via `hirono raindrop <subcommand>` (see
 * `tools/bin/hirono.ts` + `tools/fetch-raw-handlers.ts`). The
 * standalone `tools/bin/fetch-raw.ts` binary was removed when the
 * fetch pipeline was consolidated under the hirono namespace.
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
import { appendRevision, nextRev, type RevisionRow } from "./shared/revisions.ts";
import { routeSite } from "./sites/index.ts";
import { extractJsonFromEvalStdout } from "./sites/_shared/browser-eval-json.ts";
import { applyPostCleanups } from "./sites/_shared/post-cleanup.ts";
import { convertGenericHtml } from "./sites/_shared/generic-converter.ts";
import { unwrapShareUrl } from "./sites/_shared/url-unwrap.ts";
import { normalizeUrl } from "./bin/build-sources-index.ts";
import { classifyFromInput } from "./hirono/raindrop/failure-kind.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..");
const ISSUES_LOG = join(REPO_ROOT, ".wiki-fetch-issues.md");
const RAW_DIR = join(REPO_ROOT, "raw");
/**
 * Raw archive root for raindrop-driven fetches. Layout:
 *
 *   raw/raindrop/
 *     _index.json                       — slug → bookmark metadata
 *     <hostname>/<slug>/
 *       content.md, source.json, ...
 *
 * Hostname is derived deterministically from origin_url; this is the only
 * metadata stable enough to serve as a path component (collection_id and
 * tags are mutable in the Raindrop UI). All other classifiers
 * (collection_id, tags, created) live in `_index.json`, queryable via jq.
 */
const RAINDROP_DIR = join(RAW_DIR, "raindrop");
const RAW_INDEX_PATH = join(RAINDROP_DIR, "_index.json");
const RAINDROP_CACHE_PATH = join(REPO_ROOT, ".wiki-raindrop-cache.json");

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

/**
 * Marker flags — informational, not quality problems. A slug whose
 * ONLY flags are markers stays `quality_status=good`. Also consumed
 * by the kind classifier (failure-kind.ts) to mean "extraction was
 * NOT sub-good for app-only-classification purposes" — bare-domain
 * URLs with only-marker flags shouldn't reclassify as app-only.
 *
 *   - `intentional-stub`: stub content is the deliberate output.
 *   - `pdf-rendered`: PDF rendered to image-bearing markdown (P-36).
 *   - `structured-summary`: deliberate metadata-shape document
 *     (github commit / compare summaries) where short-body floors
 *     don't apply.
 *   - `v2ex-image-rescued-via-wayback`: imgur images that 429'd were
 *     rescued from the Wayback Machine. Audit-only.
 *   - `_default-used-browser-fallback`: records that browser-eval
 *     was the path that won. Informational; not a defect.
 */
export const NON_PROBLEMATIC_FLAGS_SET: ReadonlySet<string> = new Set([
  "intentional-stub",
  "pdf-rendered",
  "structured-summary",
  "v2ex-image-rescued-via-wayback",
  "_default-used-browser-fallback",
]);

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
  /**
   * Upstream-change tracking. Populated by `sync --check-stale` when the
   * fetcher does a HEAD request before deciding to re-fetch. Optional —
   * legacy source.json without this field is treated as "no etag known"
   * and the next stale check populates it.
   */
  upstream?: {
    etag?: string;
    last_modified?: string;
    /** ISO of the last HEAD check (independent from fetched_at). */
    last_checked_at?: string;
  };
  /**
   * Structured diagnostic for stub / failure results, surfaced from
   * `Result.error_detail` produced by the site module. Format:
   *
   *   <one-line summary>\n\n<raw upstream trace>
   *
   * Capped at ~2KB by `tools/sites/_shared/stub.ts`. Omitted on clean
   * fetches.
   */
  error_detail?: string;
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

/**
 * Hosts where login-wall-keyword detection is suppressed because the
 * forum / Q&A format regularly produces threads whose titles or top
 * posts discuss login flows in prose. Without this allowlist, every
 * "how do I sign in to X" thread on linux.do or similar would be
 * flagged as if it were a wall page.
 */
export const LOGIN_WALL_HOST_DENYLIST = new Set([
  "linux.do",
  "stackoverflow.com",
  "v2ex.com",
]);

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
  // private feishu). `pdf-rendered` (P-36) signals that the markdown
  // body is intentionally image-bearing (each page is an `![Page N](…)`
  // reference) so text-length floors don't apply — the actual content
  // lives in the rendered PNGs alongside, not in the markdown body.
  // Skip the size- and structure-based flags in either case.
  const isStub = ctx.extraFlags?.includes("intentional-stub") ?? false;
  const isImageBearing = ctx.extraFlags?.includes("pdf-rendered") ?? false;
  // `structured-summary` signals that the markdown is a deliberate
  // metadata-shape document (commit summary + diff stat, compare-range
  // summary, etc.) where short-body floors don't apply — the value is
  // in the structure, not the prose count.
  const isStructured = ctx.extraFlags?.includes("structured-summary") ?? false;
  const skipTextSizeFlags = isStub || isImageBearing || isStructured;
  if (!skipTextSizeFlags && trimmed.length < 500) flags.push("short-body");

  // Per-host expected-size band: flag when body is above the generic 500-char
  // floor but still below what we expect for this host. Targets the case
  // where opencli returned *something* (so no generic `short-body`) but that
  // something is clearly a sidebar/card rather than the article body.
  if (!skipTextSizeFlags && ctx.originUrl) {
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

  // Login-wall keywords are very common in Chinese prose ("登录" /
  // "登陆" appear naturally in any article discussing user auth flows).
  // Only flag when ALL of:
  //   - body is thin (< 1500 chars — likely a real wall page) OR
  //     keyword appears in the first 500 chars (above the fold)
  //   - body has < 3 headings (real articles with hierarchy aren't walls)
  //   - origin host isn't on the LOGIN_WALL_HOST_DENYLIST — forum / Q&A
  //     hosts (linux.do, stackoverflow, github discussions) regularly
  //     have threads discussing login flows in their TITLES, which the
  //     keyword check would falsely flag.
  const loginScanRegion =
    trimmed.length < 1500 ? trimmed : trimmed.slice(0, 500);
  const headingCountForLoginCheck = (trimmed.match(/^#{1,6}\s+\S/gm) ?? []).length;
  const originHost = ctx.originUrl ? hostnameOf(ctx.originUrl) : "";
  const isLoginWallHostExempt = LOGIN_WALL_HOST_DENYLIST.has(originHost);
  if (!isLoginWallHostExempt && headingCountForLoginCheck < 3) {
    for (const kw of LOGIN_WALL_KEYWORDS) {
      if (loginScanRegion.includes(kw)) {
        flags.push("login-wall-keyword");
        break;
      }
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
      if (f && !flags.includes(f)) flags.push(f);
    }
  }
  // `intentional-stub` is a control signal consumed above (to skip
  // size-based flags). It is NOT a quality problem so it should not
  // cause `status=flagged` on its own — but we DO keep it in the
  // output flags list so downstream consumers (failure-kind classifier,
  // reclassifyRawSlug) can recognize stub-shaped slugs by inspecting
  // source.json without re-running every adapter. The suspiciousness
  // check below excludes it explicitly.
  // Dedupe (caller's extraFlags may overlap with our detections)
  const uniq = [...new Set(flags)];
  // Marker flags — informational, not quality problems. A slug whose
  // ONLY flags are markers stays `quality_status=good`.
  //   - `intentional-stub`: stub content is the deliberate output
  //   - `pdf-rendered`: PDF rendered to image-bearing markdown (P-36)
  //   - `structured-summary`: deliberate metadata-shape document
  //     (github commit / compare summaries) where short-body floors
  //     don't apply
  //   - `v2ex-image-rescued-via-wayback`: imgur images that 429'd were
  //     rescued from the Wayback Machine. The content is present;
  //     the flag exists for audit only.
  // Real quality flags (short-body, etc.) still flip to "flagged".
  const NON_PROBLEMATIC_FLAGS = NON_PROBLEMATIC_FLAGS_SET;
  const suspicious = uniq.some((f) => !NON_PROBLEMATIC_FLAGS.has(f));
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

/**
 * Display-only year extracted from the slug prefix. Kept for diagnostics
 * + index entries; NO LONGER a path component (paths are now keyed by
 * hostname under raw/raindrop/).
 */
export function yearForSlug(slug: string): string {
  const m = slug.match(/^(\d{4})-\d{2}-\d{2}-/);
  return m ? m[1] : new Date().getFullYear().toString();
}

/**
 * Canonical write path for a slug fetched from a known origin URL.
 *   raw/raindrop/<hostname>/<slug>/
 *
 * The hostname is derived from `originUrl` via `hostnameOf` (lowercased,
 * `www.` stripped). For lookups when the URL isn't known, use
 * `findRawDir(slug)` which scans the disk for an existing slug directory.
 */
export function rawDirFor(slug: string, originUrl: string, rawRoot: string = RAW_DIR): string {
  const host = hostnameOf(originUrl) || "_unknown";
  return join(rawRoot, "raindrop", host, slug);
}

/**
 * Look up the raw directory for an EXISTING slug by scanning
 * `raw/raindrop/* /<slug>/`. Returns null when no such directory exists.
 *
 * Used by read-side helpers (history, diff, export, reclassify) that
 * have a slug but no URL. O(hostnames) — cheap given ~126 hostnames.
 */
export function findRawDir(slug: string, rawRoot: string = RAW_DIR): string | null {
  const root = join(rawRoot, "raindrop");
  if (!existsSync(root)) return null;
  for (const host of readdirSync(root)) {
    const hostDir = join(root, host);
    let st;
    try { st = statSync(hostDir); } catch { continue; }
    if (!st.isDirectory()) continue;  // skip _index.json + other sidecar files
    const candidate = join(hostDir, slug);
    try {
      if (statSync(candidate).isDirectory()) return candidate;
    } catch { /* not a dir, keep looking */ }
  }
  return null;
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
  /**
   * Structured upstream error trace for stub results — surfaced from
   * `Result.error_detail` produced by the site module. Persisted as
   * `source.json.error_detail`.
   */
  errorDetail?: string;
}

export function writeRawArchive(args: WriteArgs): SourceJson {
  const slugDir = rawDirFor(args.slug, args.originUrl);
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
    ...(args.errorDetail ? { error_detail: args.errorDetail } : {}),
  };
  writeFileAtomic(join(slugDir, "source.json"), JSON.stringify(src, null, 2) + "\n");

  // Append a row to revisions.jsonl. Compute the next rev number from
  // the existing log; the content file we just wrote may be content.md
  // (first fetch) or content-revN.md (append-only refetch).
  try {
    const rev = nextRev(slugDir);
    let failureKind: string | undefined;
    try {
      failureKind = classifyFromInput({
        url: args.originUrl,
        quality_status: src.quality_status,
        flags: src.quality_flags,
        isFetched: true,
      });
    } catch { /* classifier never throws, but be defensive */ }
    const row: RevisionRow = {
      rev,
      fetched_at: src.fetched_at,
      content_file: contentFile,
      content_sha: src.content_sha,
      content_length: src.content_length,
      quality_status: src.quality_status,
      quality_flags: src.quality_flags,
      failure_kind: failureKind,
      image_count: images.length,
      fetcher: src.fetcher,
      fetcher_reason: src.fetcher_reason,
    };
    appendRevision(slugDir, row);
  } catch (e) {
    // Don't fail the whole fetch if the audit-log append breaks; just
    // log a warning. The canonical source.json + content.md are already
    // on disk.
    console.error(`[revisions] failed to append: ${e instanceof Error ? e.message : e}`);
  }

  if (suspicious) {
    logL2Issue(args.slug, qualityFlags.join(","), args.originUrl);
  }

  // Refresh the per-slug raindrop sidecar index. Cheap (one walk over
  // raw/raindrop/) and keeps the index in lockstep with disk state.
  try { rebuildRawIndex(); }
  catch (e) {
    console.error(`[raw-index] failed to refresh _index.json: ${e instanceof Error ? e.message : e}`);
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
  /** Optional structured error trace for stub results (Result.error_detail). */
  errorDetail?: string;
}






// ---------------------------------------------------------------------------
// fetcher: lark-hirono
// ---------------------------------------------------------------------------

export function fetchViaLarkHirono(nodeToken: string): { content: string; title?: string } {
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

/**
 * Write a stub source.json + content.md for a slug whose fetch threw
 * an L2 error (auto-skip rule, weixin-account-migrated, lark-cli
 * forbidden, etc.). Without this helper, L2 errors leave the slug
 * dir empty (or absent) and `hirono raindrop status` perpetually
 * shows the bookmark as `not-yet-fetched` — burying a real signal
 * (we tried + decided to give up) under "untried".
 *
 * The stub flag is the L2 error code itself (e.g.
 * `auto-skipped-hf-space`, `weixin-account-migrated`); the
 * failure-kind classifier maps known codes to the right kind
 * (HF Spaces → `intentional-stub-app-only`, weixin migrated →
 * `upstream-deleted`, etc.). Unknown codes fall through to
 * `upstream-fetch-failed` via the catchall regex.
 *
 * Best-effort — failures inside this helper are logged but never
 * mask the original L2 error (the caller still re-throws). See P-35
 * in `Meta/site-handling-patterns.md`.
 */
function writeL2ErrorAsStub(opts: FetchUrlOpts, errorCode: string, errorMessage: string): void {
  const slugDir = rawDirFor(opts.slug, opts.url);
  mkdirSync(slugDir, { recursive: true });
  const lines = [
    `# Auto-skipped: ${errorCode}`,
    ``,
    `> 原文链接: ${opts.url}`,
    `> Status: ${errorMessage}`,
    ``,
    `---`,
    ``,
    `*This URL was rejected during fetch with an L2 (skip-and-continue) error. ` +
      `Edit the bookmark, accept the stub via Meta/fetch-decisions.md, or fix the underlying upstream issue if applicable.*`,
    ``,
  ];
  writeRawArchive({
    slug: opts.slug,
    origin: `url:${opts.url}`,
    originUrl: opts.url,
    rawMarkdown: lines.join("\n"),
    title: `Auto-skipped: ${errorCode}`,
    fetcher: "opencli",
    fetcherReason: "direct",
    qualityFlags: ["intentional-stub", errorCode],
    extraNotes: [`L2-error stub: ${errorCode} — ${errorMessage}`],
    downloadImages: false,
    force: opts.force,
    errorDetail: errorMessage,
  });
}

export function fetchUrlAndStore(opts: FetchUrlOpts): SourceJson {
  // Pre-routing: unwrap share-aggregator URLs (e.g.
  // `share.google?link=https://linux.do/...`). Replaces opts.url so
  // routing, slug-dir placement, and the fetcher all see the real
  // target. The original (wrapper) URL is preserved as the bookmark
  // link via the cache; rebuildRawIndex inverts the unwrap to keep
  // the slug→bookmark join intact.
  const unwrap = unwrapShareUrl(opts.url);
  if (unwrap) {
    console.error(`[unwrap] ${unwrap.wrapperHost} → ${unwrap.unwrapped}`);
    opts = { ...opts, url: unwrap.unwrapped };
  }

  for (const rule of AUTO_SKIP_RULES) {
    if (rule.match(opts.url)) {
      try { writeL2ErrorAsStub(opts, rule.code, rule.reason); }
      catch (e) { console.error(`[l2-stub] ${opts.slug}: ${e instanceof Error ? e.message : e}`); }
      throw makeError(rule.code, "L2", rule.reason, { domain: hostnameOf(opts.url) });
    }
  }

  const slugDir = rawDirFor(opts.slug, opts.url);
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
  // L2 errors thrown from inside the module (weixin-account-migrated,
  // feishu permission denied, etc.) are caught here so we can write a
  // stub source.json before re-throwing — see P-35.
  {
    let sr;
    try {
      sr = matchedSite.fetch(opts.url, { slugDir, titleHint: opts.titleHint });
    } catch (err) {
      const e = err as Error & { level?: string; code?: string };
      if (e.level === "L2") {
        try { writeL2ErrorAsStub(opts, e.code ?? "l2-error", e.message ?? "L2 error from site module"); }
        catch (writeErr) { console.error(`[l2-stub] ${opts.slug}: ${writeErr instanceof Error ? writeErr.message : writeErr}`); }
      }
      throw err;
    }
    result = {
      markdown: sr.markdown,
      title: sr.title,
      imageFiles: sr.images,
      rawMetadata: sr.metadata,
      extraFlags: sr.flags.length > 0 ? sr.flags : undefined,
      adapterNotes: sr.notes,
      errorDetail: sr.error_detail,
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
    errorDetail: result.errorDetail,
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
  /** Display-only year (extracted from slug prefix). NOT a path component. */
  year: string;
  /** Hostname directory the slug lives under (e.g. "github.com"). */
  hostname: string;
  slugDir: string;
  source: SourceJson | null;      // null if source.json missing/unparseable
  hasContent: boolean;
  quality_status: QualityStatus;  // derived: "failed" if hasContent=false; else source.quality_status ?? classify live
}

/**
 * Walk `raw/raindrop/<hostname>/<slug>/` and return one RawSlugInfo per
 * slug. The `rawRoot` arg is the parent directory containing
 * `raindrop/` — defaults to the repo root's `raw/`. Tests pass a temp
 * dir whose layout mirrors that.
 */
export function listRawSlugs(rawRoot: string = RAW_DIR): RawSlugInfo[] {
  const root = join(rawRoot, "raindrop");
  if (!existsSync(root)) return [];
  const out: RawSlugInfo[] = [];
  for (const host of readdirSync(root).sort()) {
    const hostDir = join(root, host);
    try {
      if (!statSync(hostDir).isDirectory()) continue;  // skip _index.json + other sidecar files
    } catch { continue; }
    for (const slug of readdirSync(hostDir).sort()) {
      const slugDir = join(hostDir, slug);
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
      out.push({ slug, year: yearForSlug(slug), hostname: host, slugDir, source, hasContent, quality_status });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// raw/raindrop/_index.json — sidecar slug → bookmark-metadata index.
// ---------------------------------------------------------------------------

/**
 * Per-slug entry in `_index.json`. Holds the classifiers we deliberately
 * left OUT of the path (collection_id, tags) plus the immutable origin
 * fields. Path-derivable fields (hostname, slugDir) are included for
 * convenience so an operator can `jq` without joining.
 */
/**
 * Coarse position in the corpus pipeline. Derived from
 * `quality_status` AND ingestion state (presence in
 * `.wiki-sources-index.json`). Lets a single jq query answer "where
 * is this slug" without cross-referencing three files.
 *
 *   - `not-yet-good`: extraction has problems; can't be ingested
 *     (`quality_status !== "good"`).
 *   - `ingest-ready`: clean raw archive, no Sources/<slug>.md yet —
 *     this is the LLM-ingest queue.
 *   - `ingested`: clean raw archive AND a paired wiki summary
 *     exists. Frozen-slug guard protects against accidental refetch.
 *
 * See `Meta/corpus-pipeline.md` for the state machine.
 */
export type SlugState = "not-yet-good" | "ingest-ready" | "ingested";

export interface RawIndexEntry {
  slug: string;
  hostname: string;
  /** Display-only year derived from the slug prefix. */
  year: string;
  link?: string;
  bookmark_id?: number;
  collection_id?: number;
  tags?: string[];
  created?: string;
  title?: string;
  fetched_at?: string;
  quality_status?: QualityStatus;
  /**
   * Derived state in the corpus pipeline. Optional for backward
   * compat with index files written by older code; populated by
   * `rebuildRawIndex` going forward.
   */
  state?: SlugState;
}

interface RawIndexFile {
  version: 1;
  updated_at: string;
  slugs: Record<string, RawIndexEntry>;
}

/**
 * Rebuild `raw/raindrop/_index.json` by walking every landed slug and
 * joining `source.json` (origin_url, fetched_at, quality_status) with
 * the bookmark cache (collection_id, tags, created, title) by URL.
 *
 * Best-effort: if the bookmark cache is missing, the joined fields are
 * simply absent. Idempotent — overwrites the file atomically.
 */
export function rebuildRawIndex(
  rawRoot: string = RAW_DIR,
  cachePath: string = RAINDROP_CACHE_PATH,
  sourcesIndexPath?: string,
): RawIndexFile {
  const slugs = listRawSlugs(rawRoot);

  // Build a URL → bookmark map from the raindrop cache (best-effort).
  // For share-wrapper bookmarks (e.g. `share.google?link=<target>`) we
  // also key the map by the unwrapped target URL — the slug's
  // origin_url will be the unwrapped form (since fetchUrlAndStore
  // unwrapped before fetching), so without this fallback the join
  // would miss and `_index.json` would lose the bookmark metadata.
  const byUrl = new Map<string, { bookmark_id: number; collection_id?: number; tags?: string[]; created?: string; title?: string }>();
  if (existsSync(cachePath)) {
    try {
      const data = JSON.parse(readFileSync(cachePath, "utf8"));
      for (const b of data.bookmarks ?? []) {
        if (!b.link) continue;
        const meta = {
          bookmark_id: b.bookmark_id,
          collection_id: b.collection_id,
          tags: b.tags,
          created: b.created,
          title: b.title,
        };
        byUrl.set(b.link, meta);
        const unwrap = unwrapShareUrl(b.link);
        if (unwrap) byUrl.set(unwrap.unwrapped, meta);
      }
    } catch { /* leave map empty */ }
  }

  // Pull the ingested-URL set once so each slug can derive its
  // `state` field without re-reading `.wiki-sources-index.json` per
  // entry. Set is empty when the index file is missing — any slug
  // that's good but URL-not-listed will appear as `ingest-ready`.
  const ingestedUrls = loadIngestedUrlSet(sourcesIndexPath);

  const out: Record<string, RawIndexEntry> = {};
  for (const info of slugs) {
    const link = info.source?.origin_url;
    const bm = link ? byUrl.get(link) : undefined;
    // Derive the 3-state field. See `SlugState` JSDoc + Meta/
    // corpus-pipeline.md for the state machine.
    let state: SlugState;
    if (info.quality_status !== "good") {
      state = "not-yet-good";
    } else if (link && ingestedUrls.has(normalizeUrl(link))) {
      state = "ingested";
    } else {
      state = "ingest-ready";
    }
    out[info.slug] = {
      slug: info.slug,
      hostname: info.hostname,
      year: info.year,
      link,
      bookmark_id: bm?.bookmark_id,
      collection_id: bm?.collection_id,
      tags: bm?.tags,
      created: bm?.created,
      title: bm?.title ?? info.source?.title,
      fetched_at: info.source?.fetched_at,
      quality_status: info.quality_status,
      state,
    };
  }
  const file: RawIndexFile = {
    version: 1,
    updated_at: new Date().toISOString(),
    slugs: out,
  };
  const indexPath = join(rawRoot, "raindrop", "_index.json");
  mkdirSync(dirname(indexPath), { recursive: true });
  writeFileAtomic(indexPath, JSON.stringify(file, null, 2) + "\n");
  return file;
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
  const slugDir = findRawDir(slug);
  if (!slugDir) return null;
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
  // classifyQuality only emits a small fixed set of flags from content
  // alone. Every OTHER flag came from the adapter / site module and
  // can't be recovered from content.md. Preserve them across reclassify
  // so we don't strip intentional-stub markers (xhs-text-body-unavailable,
  // _default-used-browser-fallback, weixin-image-download-partial, etc.)
  // and silently re-classify auth-gated stubs as `content-too-short`.
  const CLASSIFIER_EMITTED_FLAGS = new Set([
    "short-body",
    "below-host-expected-size",
    "no-headings-in-body",
    "login-wall-keyword",
    "loading-skeleton",
    "images-declared-but-none-downloaded",
  ]);
  const preservedFlags = (src.quality_flags ?? []).filter(
    (f) => !CLASSIFIER_EMITTED_FLAGS.has(f),
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
      return "log into xiaohongshu.com in the opencli-connected Chrome, verify `opencli doctor`, then `hirono raindrop refetch <slug>`";
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

export function printStatusReport(r: StatusReport): void {
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
  /** Retry only slugs whose computed failure_kind matches this exactly. */
  retryKind?: string;
  /** Retry slugs whose failure_kind starts with this prefix (e.g. "upstream-"). */
  retryPrefix?: string;
  /**
   * For good slugs older than maxAgeDays, do a HEAD check; if etag /
   * last-modified differs from source.json.upstream, queue for re-fetch.
   */
  checkStale?: boolean;
  /** Default 90 days. Only relevant when checkStale=true. */
  maxAgeDays?: number;
  /**
   * Skip slugs whose host (URL.hostname, normalized: lower-case, www.
   * stripped) matches any entry in this set. Suffix-style: an entry
   * `feishu.cn` excludes `*.feishu.cn` tenant subdomains. Useful when
   * resuming a bulk fetch where the operator's Chrome auth has
   * expired for specific hosts (weixin, linux.do) but the rest of
   * the corpus can still be processed.
   */
  excludeHosts?: Set<string>;
  /**
   * Bypass the frozen-slug guard. By default, slugs whose URL is in
   * `.wiki-sources-index.json` (i.e. already ingested into Sources/)
   * are skipped to prevent silently overwriting raw content while
   * the paired wiki summary stays stale. Pass `force: true` to
   * deliberately re-fetch an ingested slug — the operator must then
   * manually re-read the new raw content and update the Source
   * summary.
   */
  force?: boolean;
  /**
   * Optional override for `.wiki-sources-index.json` path (test hook).
   * Defaults to `<wiki-root>/.wiki-sources-index.json`.
   */
  sourcesIndexPath?: string;
}

export interface SyncPlanItem {
  slug: string;
  action:
    | "fetch"
    | "skip-good"
    | "skip-decisioned"
    | "skip-no-origin"
    | "skip-not-in-only"
    | "skip-over-limit"
    | "skip-not-in-retry-kind"
    | "skip-excluded-host"
    | "skip-frozen-slug"
    | "head-check";
  origin?: string;
  originUrl?: string;
  reason: string;
  /** Computed failure_kind (only present when classifier ran). */
  failure_kind?: string;
}

function ageInDays(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

/**
 * Load `.wiki-sources-index.json` as a Set of normalized URLs that
 * are already ingested into Sources/. Used by `buildSyncPlan` and
 * `cmdRefetch` for the frozen-slug guard. Best-effort: missing file
 * or parse error yields an empty set (gate fails open).
 *
 * Exported so test sandboxes and external callers can inject a custom
 * path.
 */
export function loadIngestedUrlSet(path?: string): Set<string> {
  const indexPath = path ?? join(REPO_ROOT, ".wiki-sources-index.json");
  if (!existsSync(indexPath)) return new Set();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(readFileSync(indexPath, "utf8"));
  } catch {
    return new Set();
  }
  // Widen with share-aggregator unwrap (P-32): if a Sources/ page's
  // frontmatter `raw_source` points at a wrapper URL, the slug's
  // origin_url is the UNWRAPPED form. Add both keys to the set so a
  // lookup by either form matches.
  const out = new Set<string>();
  for (const k of Object.keys(parsed)) {
    out.add(k);
    const u = unwrapShareUrl(k);
    if (u) {
      try { out.add(normalizeUrl(u.unwrapped)); } catch { /* malformed */ }
    }
  }
  return out;
}

/**
 * Suffix-style host-matcher. An entry `feishu.cn` excludes
 * `*.feishu.cn` tenants AND `feishu.cn` itself; an entry
 * `mp.weixin.qq.com` excludes only that exact host.
 */
export function matchesExcluded(host: string, excluded: Set<string>): boolean {
  if (excluded.has(host)) return true;
  for (const e of excluded) {
    if (host.endsWith("." + e)) return true;
  }
  return false;
}

/** HEAD-check a URL. Returns the etag + last-modified, or {ok:false}. */
export function headCheck(url: string): { ok: boolean; etag?: string; lastModified?: string } {
  try {
    const res = spawnSync(
      "curl",
      [
        "-sIfL",
        "--max-time", "20",
        "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9",
        url,
      ],
      { encoding: "utf8", timeout: 25_000, maxBuffer: 1024 * 1024 },
    );
    if (res.status !== 0) return { ok: false };
    const headers = (res.stdout || "").split(/\r?\n/);
    let etag: string | undefined, lastModified: string | undefined;
    for (const h of headers) {
      const m = h.match(/^([A-Za-z-]+):\s*(.+?)\s*$/);
      if (!m) continue;
      const k = m[1].toLowerCase();
      if (k === "etag") etag = m[2];
      else if (k === "last-modified") lastModified = m[2];
    }
    return { ok: true, etag, lastModified };
  } catch {
    return { ok: false };
  }
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
  const maxAgeDays = opts.maxAgeDays ?? 90;

  // Frozen-slug guard: load `.wiki-sources-index.json` once. Slugs
  // whose origin_url is in this set are already ingested into
  // Sources/ — refetching would silently overwrite the raw archive
  // while the wiki summary stays stale. The check fires above all
  // other filters so even `--retry-flagged` / `--retry-kind` skip
  // ingested slugs unless `--force` is passed.
  const ingestedUrls = opts.force ? new Set<string>() : loadIngestedUrlSet(opts.sourcesIndexPath);

  // Existing raw/ slugs first
  for (const info of existing) {
    seenSlugs.add(info.slug);
    if (ingestedUrls.size > 0 && info.source?.origin_url) {
      const normUrl = normalizeUrl(info.source.origin_url);
      if (ingestedUrls.has(normUrl)) {
        plan.push({
          slug: info.slug,
          action: "skip-frozen-slug",
          reason: `already ingested into Sources/; refetch would diverge from the wiki summary (pass --force to override)`,
        });
        continue;
      }
    }
    if (opts.only && !opts.only.has(info.slug)) {
      plan.push({ slug: info.slug, action: "skip-not-in-only", reason: "not in --only filter" });
      continue;
    }
    if (opts.excludeHosts && opts.excludeHosts.size > 0) {
      const slugHost = info.hostname.toLowerCase().replace(/^www\./, "");
      if (matchesExcluded(slugHost, opts.excludeHosts)) {
        plan.push({
          slug: info.slug,
          action: "skip-excluded-host",
          reason: `host ${slugHost} matched --exclude-host filter`,
        });
        continue;
      }
    }
    if (decisions.has(info.slug)) {
      plan.push({
        slug: info.slug,
        action: "skip-decisioned",
        reason: `accepted-as-is: ${decisions.get(info.slug)}`,
      });
      continue;
    }

    // Compute failure_kind for this slug — used by --retry-kind / --retry-prefix
    // and surfaced in the plan output so operators can see why each slug was
    // selected or skipped.
    const failure_kind = info.source?.origin_url
      ? classifyFromInput({
          url: info.source.origin_url,
          quality_status: info.quality_status === "failed" ? undefined : info.quality_status,
          flags: info.source?.quality_flags ?? [],
          isFetched: info.hasContent,
        })
      : undefined;

    // --retry-kind / --retry-prefix: when set, the kind filter is the ONLY
    // gate. Slugs that match are queued; everything else gets a typed skip.
    if (opts.retryKind || opts.retryPrefix) {
      const matches = !!failure_kind && (
        (opts.retryKind && failure_kind === opts.retryKind) ||
        (opts.retryPrefix && failure_kind.startsWith(opts.retryPrefix))
      );
      if (!matches) {
        plan.push({
          slug: info.slug,
          action: "skip-not-in-retry-kind",
          reason: `failure_kind=${failure_kind ?? "?"} (filter: ${opts.retryKind ?? opts.retryPrefix + "*"})`,
          failure_kind,
        });
        continue;
      }
      if (!info.source?.origin || !info.source?.origin_url) {
        plan.push({ slug: info.slug, action: "skip-no-origin", reason: "source.json missing origin info", failure_kind });
        continue;
      }
      plan.push({
        slug: info.slug,
        action: "fetch",
        origin: info.source.origin,
        originUrl: info.source.origin_url,
        reason: `retry-kind matched (${failure_kind})`,
        failure_kind,
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
          failure_kind,
        });
        continue;
      }
      // --check-stale: for good slugs whose fetched_at is older than
      // maxAgeDays, queue a HEAD check (executor decides whether to
      // escalate to a full fetch based on etag/last-modified diff).
      if (opts.checkStale && info.source?.fetched_at && info.source.origin_url) {
        const ageDays = ageInDays(info.source.fetched_at);
        if (ageDays >= maxAgeDays) {
          plan.push({
            slug: info.slug,
            action: "head-check",
            origin: info.source.origin,
            originUrl: info.source.origin_url,
            reason: `good, ${ageDays}d old (>= ${maxAgeDays}d threshold)`,
            failure_kind,
          });
          continue;
        }
      }
      plan.push({ slug: info.slug, action: "skip-good", reason: "quality_status=good", failure_kind });
      continue;
    }
    // flagged or failed
    if (info.quality_status === "flagged" && !opts.retryFlagged && !opts.only) {
      plan.push({ slug: info.slug, action: "skip-good", reason: "flagged (pass --retry-flagged to re-fetch)", failure_kind });
      continue;
    }
    if (!info.source?.origin || !info.source?.origin_url) {
      plan.push({ slug: info.slug, action: "skip-no-origin", reason: "source.json missing origin info", failure_kind });
      continue;
    }
    plan.push({
      slug: info.slug,
      action: "fetch",
      origin: info.source.origin,
      originUrl: info.source.origin_url,
      reason: info.quality_status === "failed" ? "no content on disk" : "flagged; retrying",
      failure_kind,
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

/**
 * Handle the `head-check` plan action: HEAD the URL, compare etag /
 * last-modified against the saved upstream block, and either update
 * `last_checked_at` (no change → skip fetch) or escalate to a full
 * `fetch` action (change detected → return that to caller).
 *
 * Returns the SourceJson written ONLY when escalation triggered a real
 * fetch. Returns null when the slug was confirmed fresh (last_checked_at
 * was updated in place; no content changed).
 */
function executeHeadCheck(item: SyncPlanItem, downloadImages: boolean): SourceJson | null {
  const slugDir = findRawDir(item.slug);
  if (!slugDir) return null;
  const sourcePath = join(slugDir, "source.json");
  if (!existsSync(sourcePath)) return null;
  let src: SourceJson;
  try { src = JSON.parse(readFileSync(sourcePath, "utf8")) as SourceJson; }
  catch { return null; }

  const url = item.originUrl ?? src.origin_url;
  if (!url) return null;
  const head = headCheck(url);
  const now = new Date().toISOString();

  const prior = src.upstream ?? {};
  const sameEtag = !!head.etag && !!prior.etag && head.etag === prior.etag;
  const sameLM = !!head.lastModified && !!prior.last_modified && head.lastModified === prior.last_modified;

  if (head.ok && (sameEtag || sameLM)) {
    // Confirmed fresh. Update last_checked_at + any newly-seen etag/last-mod.
    src.upstream = {
      etag: head.etag ?? prior.etag,
      last_modified: head.lastModified ?? prior.last_modified,
      last_checked_at: now,
    };
    writeFileAtomic(sourcePath, JSON.stringify(src, null, 2) + "\n");
    return null;
  }

  // No prior etag (first stale check) AND HEAD returned headers → record
  // them, treat as fresh (we have nothing to compare against). Avoids
  // re-fetching every old slug just because it lacks the upstream block.
  if (head.ok && !prior.etag && !prior.last_modified && (head.etag || head.lastModified)) {
    src.upstream = {
      etag: head.etag,
      last_modified: head.lastModified,
      last_checked_at: now,
    };
    writeFileAtomic(sourcePath, JSON.stringify(src, null, 2) + "\n");
    return null;
  }

  // Either HEAD failed, or etag/last-modified disagree → escalate to fetch.
  const escalated: SyncPlanItem = {
    ...item,
    action: "fetch",
    reason: head.ok
      ? `head-check: etag/last-modified changed (was ${prior.etag ?? prior.last_modified ?? "?"})`
      : `head-check: HEAD failed; treating as stale`,
  };
  return executeFetchPlanItem(escalated, downloadImages);
}

/** Execute a single fetch plan item. Dispatches by origin prefix. Returns the SourceJson written, or null on caller-visible error. */
export function executeFetchPlanItem(item: SyncPlanItem, downloadImages: boolean): SourceJson | null {
  if (item.action === "head-check") return executeHeadCheck(item, downloadImages);
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

  // Wrap fetchUrlAndStore with the central applyPostCleanups pipeline.
  // Without this, sync/refetch produce slugs whose markdown still has
  // empty-anchor chrome, color tags, double-H1, etc. — defects that
  // applyPostCleanups exists to scrub. fetch-all wires the same hook
  // (see tools/hirono/raindrop/fetch-all.ts:282-292); keeping the two
  // call sites symmetric prevents the corpus from drifting based on
  // which command produced a given slug.
  const transformMarkdown = (md: string, url: string) => {
    const r = applyPostCleanups(md, url);
    return {
      md: r.md,
      extraNotes: [
        ...(r.appliedNames.length > 0 ? [`post-cleanups: ${r.appliedNames.join(", ")}`] : []),
        ...r.notes,
      ],
      extraImageUrls: r.newAbsoluteImageUrls,
    };
  };

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
      transformMarkdown,
    });
  }

  // url: origin OR any other — treat as web URL.
  return fetchUrlAndStore({
    slug: item.slug,
    url: originUrl,
    viaBrowser: false,
    downloadImages,
    force: true,
    transformMarkdown,
  });
}
