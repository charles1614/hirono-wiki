/**
 * Detect and unwrap "share-aggregator" URLs — bookmarks where the real
 * content URL is embedded as a query parameter on a wrapper host that
 * serves an interstitial page rather than redirecting to the target.
 *
 * Rationale: most URL shorteners (t.co, lnkd.in, bit.ly) work via HTTP
 * redirect, which curl/browser already follow transparently. This
 * module handles the OTHER class — wrappers that NEVER 302 to the
 * target. Examples:
 *
 *   `share.google?link=https://linux.do/t/topic/537374`
 *
 *     → 302 redirects to `www.google.com/share.google?...` (still NOT
 *       the target). The link is reachable only by reading the `link`
 *       query parameter. Without unwrapping, the fetch lands on the
 *       Google interstitial; with unwrapping, it routes through the
 *       linux.do dedicated module.
 *
 * Used by `tools/fetch-raw.ts:fetchUrlAndStore` as a pre-routing pass:
 * if the bookmark URL matches a wrapper, we replace it with the
 * unwrapped target before `routeSite()`. Also called by
 * `rebuildRawIndex` so a slug whose `origin_url` is the unwrapped
 * target still joins to its bookmark in the cache.
 *
 * To register a new wrapper: append a rule to `WRAPPER_RULES`.
 */

interface WrapperRule {
  /** Match the URL's hostname (lowercased, `www.` stripped). */
  host: RegExp;
  /** Query parameter holding the target URL. */
  paramName: string;
}

/**
 * Registry of share-wrapper hosts. Add new entries here when a new
 * wrapper appears in the bookmark corpus. Each rule is one line.
 *
 * Tested URL shapes:
 *   - `share.google?link=https://linux.do/...` → linux.do
 */
const WRAPPER_RULES: readonly WrapperRule[] = [
  { host: /^share\.google$/i, paramName: "link" },
];

export interface UnwrappedUrl {
  /** The decoded target URL the wrapper points at. */
  unwrapped: string;
  /** Hostname of the wrapper (for logging + diagnostics). */
  wrapperHost: string;
}

/**
 * If `url` is a known share-wrapper, return the unwrapped target.
 * Returns null otherwise (including for malformed URLs and wrappers
 * whose target query parameter is missing or doesn't look like an
 * `http(s)://` URL).
 *
 * Pure function; no I/O. Safe to call on any URL.
 */
export function unwrapShareUrl(url: string): UnwrappedUrl | null {
  let parsed: URL;
  try { parsed = new URL(url); }
  catch { return null; }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  for (const rule of WRAPPER_RULES) {
    if (!rule.host.test(host)) continue;
    const target = parsed.searchParams.get(rule.paramName);
    if (!target) continue;
    if (!/^https?:\/\//i.test(target)) continue;
    return { unwrapped: target, wrapperHost: host };
  }
  return null;
}
