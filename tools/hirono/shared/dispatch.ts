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
 * Classify a URL's coverage. Consults the universal site router FIRST
 * (`tools/sites/index.ts → routeSite()`); if a per-host site module
 * matches, that's where the URL actually gets fetched, so the adapter
 * column reports the site-module name (e.g. `deepwiki`, `github`,
 * `weixin`) rather than the legacy adapter string the dispatch rule
 * still carries (which is often `web-read` for migrated hosts).
 *
 * Falls back to DISPATCH_RULES for hosts not yet migrated to a site
 * module. Returns "unknown" for URLs that fail to parse at all.
 */
export function classifyCoverage(url: string): {
  label: CoverageLabel;
  adapter?: string;
} {
  const host = _hostnameOf(url);
  if (!host) return { label: "unknown" };
  const site = routeSite(url);
  if (site) return { label: "dedicated-adapter", adapter: site.name };
  const r = _lookupDispatch(url);
  if (r) return { label: "dedicated-adapter", adapter: r.adapter };
  return { label: "web-read-fallback" };
}
