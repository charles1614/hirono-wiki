/**
 * Canonical failure-kind taxonomy for the failure log.
 *
 * The fetcher emits ~50 distinct quality_flags across the site modules.
 * Surfacing those raw to the operator is overwhelming. This module maps
 * the raw flags onto a normalized 15-kind taxonomy that's:
 *
 *   - small enough to remember
 *   - actionable per kind (each has its own advice + retry recipe)
 *   - hierarchical (upstream-* / host-* / content-* prefixes)
 *
 * Operators can override the auto-classifier per slug via
 * `Meta/sources-health-overrides.md` when the heuristic gets a host
 * wrong (e.g. a paywalled site that the heuristic mislabels as
 * `clean` because the body extraction succeeded under a soft paywall).
 */

import { existsSync, readFileSync } from "node:fs";

export type FailureKind =
  | "clean"
  | "upstream-deleted"
  | "upstream-paywall"
  | "upstream-auth-gated"
  | "upstream-spa-no-content"
  | "upstream-not-html"
  | "upstream-fetch-failed"
  | "host-lan-only"
  | "host-malformed"
  | "host-throttled"
  | "content-incomplete-images"
  | "content-incomplete-images-zero"
  | "content-too-short"
  | "intentional-stub-app-only"
  | "not-yet-fetched";

const KIND_ORDER: FailureKind[] = [
  "clean",
  "upstream-deleted",
  "upstream-paywall",
  "upstream-auth-gated",
  "upstream-spa-no-content",
  "upstream-not-html",
  "upstream-fetch-failed",
  "host-lan-only",
  "host-malformed",
  "host-throttled",
  "content-incomplete-images",
  "content-incomplete-images-zero",
  "content-too-short",
  "intentional-stub-app-only",
  "not-yet-fetched",
];

export function isFailureKind(s: string): s is FailureKind {
  return (KIND_ORDER as string[]).includes(s);
}

export function compareKinds(a: FailureKind, b: FailureKind): number {
  return KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b);
}

export interface ClassifyInput {
  /** URL the bookmark points at (used for shape-based kinds: PDF, LAN IP, etc.). */
  url: string;
  /** The slug's quality_status from source.json, if any. */
  quality_status?: "good" | "flagged" | "failed";
  /** quality_flags[] from source.json. */
  flags?: readonly string[];
  /** True if the slug exists in the sources index (was ingested). */
  isIngested?: boolean;
  /** True if the slug exists in raw/ (was fetched). */
  isFetched?: boolean;
}

export interface Classification {
  kind: FailureKind;
  /** True when the kind came from the override file (vs auto-classifier). */
  pinned: boolean;
  /** One-line human-readable advice. */
  advice: string;
}

const ADVICE: Record<FailureKind, string> = {
  "clean":
    "OK — content extracted. Nothing to do.",
  "upstream-deleted":
    "Source page is gone (404 or page-removed marker). Decide whether to keep the local copy or remove the bookmark.",
  "upstream-paywall":
    "Page renders behind a paywall / subscription wall. Either skip, or fetch from an authenticated browser session if you have a subscription.",
  "upstream-auth-gated":
    "Authentication required and the operator's identity has no read access. For Feishu, ask the tenant owner to share. For x.com, sign in to the linked Chrome session.",
  "upstream-spa-no-content":
    "SPA page hydrates but yields too little body even via browser-eval. Likely an interactive UI (calculator, demo, web app). No content to extract.",
  "upstream-not-html":
    "URL is not an HTML page (PDF, CSV, app-store listing, API endpoint). Use a different extraction tool (e.g. PDF→text) or skip.",
  "upstream-fetch-failed":
    "Network or extraction error. Retry: `hirono raindrop sync --retry-kind upstream-fetch-failed`. Investigate if it persists.",
  "host-lan-only":
    "URL points at a private network address unreachable from the public internet. The bookmark was saved on a different network.",
  "host-malformed":
    "URL doesn't parse cleanly (broken share-link, encoding mishap). Fix the bookmark in Raindrop.",
  "host-throttled":
    "Host returned 429 / Too Many Requests. Wait and retry: `hirono raindrop sync --retry-kind host-throttled`.",
  "content-incomplete-images":
    "Body extraction worked but some image downloads failed (cross-origin denials, transient 403s). Retry: `hirono raindrop sync --retry-kind content-incomplete-images`.",
  "content-incomplete-images-zero":
    "Markdown references images but none were downloaded. The adapter declared images then failed to fetch any. Investigate the host.",
  "content-too-short":
    "Body is below the host's expected size floor. Likely a partial-render or extraction defect. Eyeball the URL.",
  "intentional-stub-app-only":
    "Source is genuinely interactive (HuggingFace Space, qwen.ai chat) — no static content to extract. Stub by design.",
  "not-yet-fetched":
    "Bookmark exists in the Raindrop cache but no slug has been fetched for its URL. Run `hirono raindrop new` then ingest.",
};

export function adviceFor(kind: FailureKind): string {
  return ADVICE[kind];
}

// ─────────────────────────── Auto-classifier ─────────────────────────

/** Hosts that always indicate a paywall regardless of body extraction. */
const PAYWALL_HOSTS = new Set([
  "economictimes.indiatimes.com",
  "openreview.net",
  "scribd.com",
  "shop.elsevier.com",
  "wsj.com",
  "ft.com",
  "nytimes.com",
]);

/** Hosts whose URLs are not HTML articles. */
const NON_HTML_HOSTS = new Set([
  "api.raindrop.io",
  "itunes.apple.com",
  "apps.apple.com",
]);

function isLanIp(host: string): boolean {
  return /^10\./.test(host) ||
         /^192\.168\./.test(host) ||
         /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host) ||
         /^8\.163\.|^8\.138\./.test(host);  // operator's known LAN-style public IPs
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

export function classifyFromInput(input: ClassifyInput): FailureKind {
  const url = input.url;
  const host = hostOf(url);

  // URL-shape detection runs FIRST — these are intrinsic properties of the
  // URL itself, independent of whether we ever attempted a fetch. A bookmark
  // for a PDF or a LAN IP should classify the same way before and after the
  // first sync attempt.
  if (!host) return "host-malformed";
  // (share.google?link=… used to classify as host-malformed unconditionally;
  // now handled by `unwrapShareUrl` pre-fetch — see P-32 in
  // Meta/site-handling-patterns.md. Once unwrapped, the slug's source.json
  // origin_url is the real target so the URL-shape rule below classifies
  // by the target's host instead.)
  if (isLanIp(host) || /:\d{4,5}$/.test(host)) return "host-lan-only";
  // PDF detection: literal `.pdf` extension OR path ending in `/pdf`
  // (covers openreview.net/pdf?id=…, etc.). EXCEPT when the slug
  // already has the `pdf-rendered` flag — that means P-36 successfully
  // rendered the PDF to image-bearing markdown, so the slug is no
  // longer "non-HTML stub" but a real (image-bearing) extraction.
  if (!(input.flags ?? []).includes("pdf-rendered") &&
      (/\.pdf(?:[?#]|$)/i.test(url) || /\/pdf(?:[?#]|$)/i.test(url))) {
    return "upstream-not-html";
  }
  if (NON_HTML_HOSTS.has(host)) return "upstream-not-html";

  // After URL-shape: not-yet-fetched short-circuits remaining checks.
  if (!input.isFetched) return "not-yet-fetched";

  const flags = input.flags || [];
  const flagSet = new Set(flags);

  // Stub-shaped (intentional-stub flag present)
  if (flagSet.has("intentional-stub")) {
    // PDF / binary / media stubs. _default-non-html: catch-all PDF detection.
    // arxiv-pdf: arxiv module emits this for /pdf/ URLs. Both classify as
    // upstream-not-html (the URL is a PDF, not extractable HTML).
    if (flagSet.has("_default-non-html") || flagSet.has("arxiv-pdf")) return "upstream-not-html";
    // App-only stubs. Per-host flags from dedicated site modules:
    //   `huggingface-space`        — HF Space (interactive ML demo)
    //   `qwen-ai-non-article`      — qwen.ai non-article URL
    //   `deepwiki-com-landing`     — deepwiki.com bare-domain marketing/search UI
    //   `auto-skipped-hf-space`    — L2 stub for AUTO_SKIP_RULES (P-35)
    if (flagSet.has("huggingface-space") || flagSet.has("qwen-ai-non-article") ||
        flagSet.has("deepwiki-com-landing") ||
        flagSet.has("auto-skipped-hf-space")) {
      return "intentional-stub-app-only";
    }
    // Auth-gated kinds. xhs-text-body-unavailable: post body is
    // app-only / login-walled by xiaohongshu — image-only stub is the
    // deliberate output, NOT a fetch failure.
    if (flagSet.has("feishu-auth-gated") || flagSet.has("feishu-user-auth-required") ||
        flagSet.has("x-twitter-auth-required") || flagSet.has("xhs-text-body-unavailable")) {
      return "upstream-auth-gated";
    }
    // Deleted upstream — host-specific platform-deleted flags plus the
    // host-agnostic `<host>-not-found` family (P-34). Includes
    // `weixin-account-migrated` (the WeChat publisher migrated to a
    // new account; original article is unreachable without manual
    // redirect-button click — same operator outcome as a deletion).
    if (flagSet.has("feishu-deleted") || flagSet.has("reddit-deleted") ||
        flagSet.has("x-twitter-empty") || flagSet.has("weixin-account-migrated") ||
        [...flags].some(f => /-not-found$/.test(f))) {
      return "upstream-deleted";
    }
    // SPA empty after browser fallback fired
    if (flagSet.has("_default-fetch-failed") || flagSet.has("loading-skeleton")) {
      if (looksLikeAppShapedUrl(input.url || "")) return "intentional-stub-app-only";
      return "upstream-spa-no-content";
    }
    // Generic fetch failure stub. Includes anti-bot blocks
    // (`-bot-blocked` flag from `_default` or any future site module
    // that detects Cloudflare/Akamai/DataDome challenges — see P-33).
    if ([...flags].some(f =>
      /-fetch-failed$/.test(f) ||
      /-extraction-failed$/.test(f) ||
      /-bot-blocked$/.test(f)
    )) {
      return "upstream-fetch-failed";
    }
    // Paywall hint via login-wall keyword
    if (flagSet.has("login-wall-keyword")) return "upstream-paywall";
    return "upstream-fetch-failed";
  }

  // Non-stub flagged content
  if (flagSet.has("login-wall-keyword") || PAYWALL_HOSTS.has(host)) return "upstream-paywall";
  // URL-pattern app-only check applies here too — but ONLY when the
  // slug already has at least one flag (sub-good extraction). A
  // bare-domain URL with clean extraction (e.g. `lilianweng.github.io/`
  // serving a real blog homepage) shouldn't classify as app-only.
  // The URL pattern only flips the kind when extraction was already
  // judged sub-good. See P-18 (refined to add bare-domain and
  // search-results matchers in iteration 5).
  if (flags.length > 0 && looksLikeAppShapedUrl(input.url || "")) return "intentional-stub-app-only";
  if (flagSet.has("images-declared-but-none-downloaded")) return "content-incomplete-images-zero";
  if ([...flags].some(f => /-image-download-partial$/.test(f))) return "content-incomplete-images";
  if (flagSet.has("short-body") || flagSet.has("below-host-expected-size")) return "content-too-short";
  if (flagSet.has("loading-skeleton")) return "upstream-spa-no-content";

  // Default: clean
  return "clean";
}

/**
 * Does the URL itself signal "this isn't a content page" — interactive
 * app, login UI, IPFS gateway, bare-domain homepage, search-results
 * page? Used by the failure-kind classifier in both the stub branch
 * (P-18 original) and the non-stub flagged branch (P-18 refinement
 * iteration 5) to route URL-shaped-app slugs to
 * `intentional-stub-app-only` instead of letting them masquerade as
 * `content-too-short` / `upstream-spa-no-content`.
 *
 * The check is conservative — only fires when the slug has at least
 * one quality flag (sub-good extraction). Real-content homepages
 * with rich extraction never reach this code path because the
 * classifier returns `clean` first.
 */
function looksLikeAppShapedUrl(url: string): boolean {
  if (!url) return false;
  const APP_URL_PATTERNS: RegExp[] = [
    // Path-based: clear app/tool/login/dashboard pages.
    /\/(?:login|signin|signup|register|dashboard|console|admin)\b/i,
    /\/(?:tools?|calculator|search|vram-calculator)\b/i,
    // IPFS / decentralized gateway URLs — hash subdomain → app.
    /\.eth\.limo\b/i,
    /^https?:\/\/[a-f0-9]{8,}\./i,
    // Bare-domain / homepage URLs: host with no path content (root,
    // empty, or `/index.*`). Bookmark intent IS the site itself —
    // when extraction yields sub-good content, treat as app-shaped.
    /^https?:\/\/[^/?#]+\/?(?:[?#].*)?$/i,
    /^https?:\/\/[^/?#]+\/index\.[a-z]+(?:[?#].*)?$/i,
    // Search-results URLs: bookmark intent IS the query, content is
    // dynamic by definition. Common query-param names.
    /[?&](?:search|q|query|keyword|kw|term)=/i,
  ];
  return APP_URL_PATTERNS.some((p) => p.test(url));
}

// ─────────────────────────── Override file ─────────────────────────

export interface OverrideEntry {
  slug: string;
  pinKind: FailureKind;
  comment?: string;
}

const OVERRIDE_LINE_RE =
  /^\s*-\s+([A-Za-z0-9_-][A-Za-z0-9._-]*)\s*:\s*pin-kind\s*=\s*([a-z-]+)(?:\s+#\s*(.*))?$/;

export function parseOverrides(filepath: string): Map<string, OverrideEntry> {
  const out = new Map<string, OverrideEntry>();
  if (!existsSync(filepath)) return out;
  const lines = readFileSync(filepath, "utf8").split("\n");
  for (const line of lines) {
    const m = OVERRIDE_LINE_RE.exec(line);
    if (!m) continue;
    const slug = m[1];
    const kindRaw = m[2];
    const comment = m[3]?.trim();
    if (!isFailureKind(kindRaw)) {
      console.error(`[overrides] unknown kind '${kindRaw}' for slug '${slug}' — skipping`);
      continue;
    }
    out.set(slug, { slug, pinKind: kindRaw, comment });
  }
  return out;
}

export function classify(
  input: ClassifyInput & { slug?: string },
  overrides: Map<string, OverrideEntry>,
): Classification {
  if (input.slug && overrides.has(input.slug)) {
    const ov = overrides.get(input.slug)!;
    return { kind: ov.pinKind, pinned: true, advice: adviceFor(ov.pinKind) };
  }
  const kind = classifyFromInput(input);
  return { kind, pinned: false, advice: adviceFor(kind) };
}

export const ALL_KINDS: readonly FailureKind[] = KIND_ORDER;
