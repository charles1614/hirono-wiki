/**
 * Site module contract.
 *
 * Every host-specific module under `tools/sites/<host>/` exports a `site`
 * value of this shape. The router (`tools/sites/index.ts`) walks the list
 * of registered sites and picks the first one whose `match(url)` returns
 * true. The router itself has no per-site knowledge — sites are
 * self-describing.
 *
 * See `~/.claude/plans/parsed-meandering-beaver.md` for the architecture
 * the contract is part of.
 */

export interface FetchOpts {
  /** Directory the site MUST write images into (and any other side-files). */
  slugDir: string;
  /**
   * Optional title hint sourced from raindrop / OG tags etc. Sites that
   * cannot recover a title from the page itself (auth-gated, redirected
   * shortlinks before login) fall back to this.
   */
  titleHint?: string;
}

export interface Result {
  /**
   * Fetched markdown body — MUST satisfy the §2 frontmatter contract:
   *   # <Title>
   *   > 原文链接: <url>
   *   [> <metadata line(s)>]
   *
   *   ---
   *
   *   <body>
   */
  markdown: string;
  /** Local filenames (basename only) of any images saved into slugDir. */
  images: string[];
  /** Free-form metadata; serialized into source.json by the caller. */
  metadata: Record<string, unknown>;
  /**
   * Quality flags consumed by the classifier (`tools/fetch-raw.ts`
   * `classifyQuality`). Examples: `intentional-stub`,
   * `xhs-text-body-unavailable`, `weixin-image-download-partial`.
   */
  flags: string[];
  /** Optional human-readable notes that get appended to source.json. */
  notes?: string[];
  /** Optional title surfaced for slug-naming + frontmatter. */
  title?: string;
  /**
   * Structured diagnostic for stub / failure results. Populated by site
   * modules when a fetch produces a stub: the underlying upstream error
   * (curl exit + stderr, lark-cli error JSON, browser-eval signedIn=false,
   * 4xx body excerpt, etc.). Capped at ~2KB by the writer.
   *
   * Shape (free-form text, but conventionally):
   *   <one-line summary>\n
   *   \n
   *   <raw upstream trace, multi-line>
   *
   * The first line becomes the `> Status:` callout in the stub's
   * content.md AND the inline summary in `hirono raindrop status`.
   * Surfaced verbatim in source.json.error_detail.
   *
   * Omitted on clean fetches (no error to capture).
   */
  error_detail?: string;
}

export interface Site {
  /** Stable identifier. Used for diagnostics + snapshot directory names. */
  name: string;
  /**
   * URL/host predicate. The router picks the FIRST site whose `match`
   * returns true, so a site with a more-specific URL pattern can take
   * precedence over a sibling that matches more loosely.
   */
  match: (url: string) => boolean;
  /**
   * Fetch + convert to a §2-contract Result. Synchronous — implementations
   * use `spawnSync` for browser/curl calls; there's no async runtime
   * dependency. Keeping this sync matches the existing dispatch in
   * `tools/fetch-raw.ts:fetchUrlAndStore` without forcing it to be async.
   */
  fetch: (url: string, opts: FetchOpts) => Result;
}
