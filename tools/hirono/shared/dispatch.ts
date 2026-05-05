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
 * Classify a URL's routing handler. Two real categories under the
 * unified architecture (CLAUDE.md §5a + docs/fetcher-architecture.md):
 *
 *   - `site:<name>` (label `dedicated-adapter`) — routed through
 *     `tools/sites/<name>/`, where `<name>` is a host-specific module.
 *     The site module owns the full pipeline.
 *   - `site:_default` (label `web-read-fallback`) — routed through the
 *     catch-all `_default` site module. Functionally a fallback —
 *     hosts here are candidates for promotion to a dedicated module.
 *
 * Routing is total (`_default` matches everything), so `routeSite()`
 * never returns null. Returns "unknown" for URLs that fail to parse.
 */
export function classifyCoverage(url: string): {
  label: CoverageLabel;
  handler?: string;
} {
  const host = _hostnameOf(url);
  if (!host) return { label: "unknown" };
  const site = routeSite(url);
  if (site.name === "_default") {
    return { label: "web-read-fallback", handler: "site:_default" };
  }
  return { label: "dedicated-adapter", handler: `site:${site.name}` };
}
