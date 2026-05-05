/**
 * Thin re-export layer for site-router classification. Hirono subcommands
 * use `classifyCoverage` to bucket bookmarked URLs by handler.
 *
 * Under the unified architecture (`docs/fetcher-architecture.md`) the
 * legacy DISPATCH_RULES / OpencliAdapter / web-read wait-overrides are
 * gone — every URL maps to a site module under `tools/sites/<host>/`.
 * The catch-all `tools/sites/_default/` claims everything no
 * host-specific module fielded.
 */
import {
  hostnameOf as _hostnameOf,
} from "../../fetch-raw.ts";
import { routeSite } from "../../sites/index.ts";

export {
  hostnameOf,
  isArticleLikeUrl,
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
