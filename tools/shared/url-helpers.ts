/**
 * URL parsing helpers used across site modules + hirono raindrop tools.
 *
 * Every site module under `tools/sites/<host>/` previously defined its
 * own copy of `hostOf` — 24 nearly-identical 3-line implementations.
 * This module is the single source of truth.
 *
 * Two shapes:
 *
 *   - `hostOf(url)` — normalized for matching: lowercased, leading
 *     `www.` stripped. Returns `""` on parse failure (matches the
 *     null-safe convention used by every site module's `match()`).
 *   - `hostnameOf(url)` — raw `URL.hostname`. Lives in
 *     `tools/fetch-raw.ts` for legacy reasons; re-exported here for
 *     symmetry, so callers can pick the right shape from one import.
 *
 * Use `hostOf` for matching ("does this URL belong to this site
 * module?"). Use `hostnameOf` for diagnostics, file paths, and any
 * place where preserving www-vs-bare distinction matters.
 */

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export { hostnameOf } from "../fetch-raw.ts";
