/**
 * Host migration for the self-hosted DeepWiki (`deepwiki-litenext`).
 *
 * The domain is written only in `site.json` next to this file. Moving again
 * means: new `baseDomain`, previous one prepended to `legacyBaseDomains`.
 *
 * Legacy hosts are identifiers only: archives, bookmarks and fixtures
 * still carry them, so they must keep matching, but no request may be sent to them.
 * Pass a URL through `currentDeepwikiUrl` before fetching or comparing it.
 *
 * Dependency-free (node built-ins only) on purpose: imported by both `fetch-raw.ts`
 * and `bin/build-sources-index.ts`, which `fetch-raw.ts` itself imports.
 */
import { readFileSync } from "node:fs";

const site: { baseDomain: string; legacyBaseDomains: string[] } =
  JSON.parse(readFileSync(new URL("./site.json", import.meta.url), "utf8"));

export const DEEPWIKI_HOST = `wiki.${site.baseDomain}`;
/** Newest first. */
export const DEEPWIKI_LEGACY_HOSTS: readonly string[] = site.legacyBaseDomains.map((d) => `wiki.${d}`);

/** Lowercased host without `www.` or the trailing root dot. */
function bareHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/\.+$/, "").replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** True for the current host and for every legacy one. */
export function isDeepwikiLitenextUrl(url: string): boolean {
  const host = bareHost(url);
  return host === DEEPWIKI_HOST || DEEPWIKI_LEGACY_HOSTS.includes(host);
}

/**
 * Move a URL on any legacy host to the current host over plain https, keeping path,
 * query and fragment. Any other input is returned unchanged.
 */
export function currentDeepwikiUrl(url: string): string {
  if (!DEEPWIKI_LEGACY_HOSTS.includes(bareHost(url))) return url;
  const { pathname, search, hash } = new URL(url);
  return `https://${DEEPWIKI_HOST}${pathname}${search}${hash}`;
}
