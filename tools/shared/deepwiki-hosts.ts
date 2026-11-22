/**
 * Host migration for the self-hosted DeepWiki (`deepwiki-litenext`).
 *
 * The legacy host is an identifier only: archives, bookmarks and fixtures
 * still carry it, so it must keep matching, but no request may be sent to it.
 * Pass a URL through `currentDeepwikiUrl` before fetching or comparing it.
 *
 * Dependency-free on purpose: imported by both `fetch-raw.ts` and
 * `bin/build-sources-index.ts`, which `fetch-raw.ts` itself imports.
 */

export const DEEPWIKI_HOST = "wiki.litenext.space";
export const DEEPWIKI_LEGACY_HOST = "wiki.litenext.digital";

/** Lowercased host without `www.` or the trailing root dot. */
function bareHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/\.+$/, "").replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** True for the current host and for the legacy one. */
export function isDeepwikiLitenextUrl(url: string): boolean {
  const host = bareHost(url);
  return host === DEEPWIKI_HOST || host === DEEPWIKI_LEGACY_HOST;
}

/**
 * Move a legacy-host URL to the current host over plain https, keeping path,
 * query and fragment. Any other input is returned unchanged.
 */
export function currentDeepwikiUrl(url: string): string {
  if (bareHost(url) !== DEEPWIKI_LEGACY_HOST) return url;
  const { pathname, search, hash } = new URL(url);
  return `https://${DEEPWIKI_HOST}${pathname}${search}${hash}`;
}
