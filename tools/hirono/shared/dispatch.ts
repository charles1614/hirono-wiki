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
 * Classify a URL's coverage based on DISPATCH_RULES. "unknown" is reserved
 * for URLs that fail to parse at all; anything that parses will be one of
 * the first two.
 */
export function classifyCoverage(url: string): {
  label: CoverageLabel;
  adapter?: string;
} {
  const host = _hostnameOf(url);
  if (!host) return { label: "unknown" };
  const r = _lookupDispatch(url);
  if (r) return { label: "dedicated-adapter", adapter: r.adapter };
  return { label: "web-read-fallback" };
}
