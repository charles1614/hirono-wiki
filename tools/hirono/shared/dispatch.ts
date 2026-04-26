/**
 * Thin re-export layer for the adapter-dispatch logic. Today the canonical
 * definitions live in tools/fetch-raw.ts — hirono subcommands import from
 * here so when we eventually migrate the source of truth into this module,
 * only one file needs to change.
 */
import {
  lookupDispatch as _lookupDispatch,
  hostnameOf as _hostnameOf,
} from "../../fetch-raw.ts";
import { routeSite } from "../../sites/index.ts";

export {
  DISPATCH_RULES,
  lookupDispatch,
  hostnameOf,
  isArticleLikeUrl,
  getPreferredWaitSeconds,
  DEFAULT_WEB_READ_WAIT_SECONDS,
  type OpencliAdapter,
} from "../../fetch-raw.ts";

/**
 * Coverage label for a hostname — used by `hirono raindrop check` to bucket
 * domains into "we have a dedicated adapter" vs "falls through to generic
 * web-read".
 */
export type CoverageLabel = "dedicated-adapter" | "web-read-fallback" | "unknown";

/**
 * Classify a URL's routing handler. Three real categories under the
 * universal pattern (CLAUDE.md §5a):
 *
 *   - `site:<name>`   — routed through `tools/sites/<name>/`. The site
 *                       module owns the full pipeline; opencli is just
 *                       the browser session (or not used at all).
 *   - `opencli:<adapter>` — falls through to a dedicated legacy opencli
 *                       adapter (currently only `opencli:zhihu-question`
 *                       still exists).
 *   - `web-read`      — falls through to opencli's generic web reader
 *                       (the catch-all for unmigrated hosts).
 *
 * `routeSite()` is consulted FIRST so a migrated host always reports
 * `site:<name>` regardless of what the legacy DISPATCH_RULES entry
 * still carries. Returns "unknown" for URLs that fail to parse at all.
 */
export function classifyCoverage(url: string): {
  label: CoverageLabel;
  handler?: string;
} {
  const host = _hostnameOf(url);
  if (!host) return { label: "unknown" };
  const site = routeSite(url);
  if (site) return { label: "dedicated-adapter", handler: `site:${site.name}` };
  const r = _lookupDispatch(url);
  if (r) {
    if (r.adapter === "web-read") return { label: "dedicated-adapter", handler: "web-read" };
    return { label: "dedicated-adapter", handler: `opencli:${r.adapter}` };
  }
  return { label: "web-read-fallback" };
}
