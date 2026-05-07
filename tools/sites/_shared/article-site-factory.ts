/**
 * Factory for site modules covering simple article-shape hosts.
 *
 * Each per-host module supplies:
 *   - name (matches `tools/sites/<name>/`)
 *   - host(s) it matches
 *   - article selectors config (see article-converter.ts)
 *   - converter function name (for fixture dispatch)
 *
 * The factory returns:
 *   - A `Site` contract (for `tools/sites/index.ts` registration)
 *   - A `SiteTestHooks` (for the test registry)
 *   - Both delegate to a shared converter built on `convertArticle`
 *
 * Result: a per-host site module is just a config plus 3 thin file shells.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import type { Site, FetchOpts, Result } from "./types.ts";
import type { SiteTestHooks, InputDoc, CaptureResult } from "./test-hooks-types.ts";
import { convertArticle, type ArticleSelectors, type ArticleConvertOpts, type ArticleConvertResult } from "./article-converter.ts";
import { makeStub } from "./stub.ts";
import { downloadImage } from "../../fetch-raw.ts";

export interface ArticleSiteConfig {
  /** Site module name (matches dir, used in fixture paths). */
  name: string;
  /** Hostnames the site matches (e.g. `["qwen.ai"]`). Ignored when `matchAll` is true. */
  hosts: string[];
  /**
   * Optional regex against the URL's hostname. Matches in addition to
   * `hosts` (logical OR). Use for wildcard subdomain families like
   * `*.readthedocs.io` where there's no fixed hostname list.
   */
  hostPattern?: RegExp;
  /** Optional path-prefix filter. Match returns true only when URL path starts with this. */
  pathPrefix?: string;
  /**
   * Match every URL — for the catch-all `_default` module that fields any
   * URL no host-specific module claimed. The router registers it LAST so
   * specific modules win first. Mutually exclusive with `hosts`/`pathPrefix`.
   */
  matchAll?: boolean;
  /** Converter function name for fixture dispatch (e.g. "convertQwen"). */
  converterName: string;
  /** Article selectors config — body, dropSelectors, etc. */
  selectors: ArticleSelectors;
  /** Optional Referer URL builder for image downloads (default: origin URL). */
  imageReferer?: (url: string) => string;
  /**
   * Override the snapshot hosts list (defaults to `cfg.hosts`). Used by
   * the catch-all `_default` module which has no host predicate but
   * still needs a snapshot directory under `__tests__/snapshots/`.
   */
  snapshotHosts?: string[];
}

/** Minimal fetcher — plain curl. Most hosts work with this. */
function plainFetch(url: string): { html: string; finalUrl: string; error?: string } {
  try {
    const html = execFileSync(
      "curl",
      [
        "-sfL",
        "--max-time", "30",
        // Full Chrome User-Agent — some hosts (Cloudflare-fronted, mod_security)
        // 406-reject our minimal UA but accept a fuller one. Treating the
        // wider UA as the default since it's strictly more compatible.
        "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
        "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "-H", "Accept-Language: en-US,en;q=0.9",
        url,
      ],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    return { html, finalUrl: url };
  } catch (e) {
    return { html: "", finalUrl: url, error: e instanceof Error ? e.message : String(e) };
  }
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

function pathOf(url: string): string {
  try { return new URL(url).pathname; }
  catch { return ""; }
}

export interface ArticleFixtureArgs {
  html: string;
  url: string;
}

export function makeArticleSite(cfg: ArticleSiteConfig): { site: Site; testHooks: SiteTestHooks } {
  // Note: fixture input.json stores ONLY {html, url} (not selectors —
  // those live in the per-host config). Inject selectors here.
  const runConverter = (opts: ArticleFixtureArgs): ArticleConvertResult =>
    convertArticle({ ...opts, selectors: cfg.selectors });

  const site: Site = {
    name: cfg.name,
    match: (url: string) => {
      if (cfg.matchAll) return true;
      const h = hostOf(url);
      const hostHit = cfg.hosts.includes(h) || (cfg.hostPattern?.test(h) ?? false);
      if (!hostHit) return false;
      if (cfg.pathPrefix && !pathOf(url).startsWith(cfg.pathPrefix)) return false;
      return true;
    },
    fetch: (url: string, opts: FetchOpts): Result => {
      mkdirSync(opts.slugDir, { recursive: true });
      const r = plainFetch(url);
      if (r.error || !r.html) {
        const summary = r.error ? `curl fetch failed: ${r.error.split("\n")[0].slice(0, 100)}` : "empty HTML response";
        const detail = r.error
          ? `[curl] ${r.error}`
          : `[curl] ok but response body was empty`;
        return stubResult(cfg, url, summary, detail);
      }
      const conv = runConverter({ html: r.html, url });
      if (conv.stats.bodyChars < 200) {
        const detail =
          `html length: ${r.html.length}\n` +
          `extracted body chars: ${conv.stats.bodyChars} (threshold: 200)\n` +
          `body selectors tried (first match wins): ${cfg.selectors.bodySelectors.join(", ")}\n` +
          `(possible causes: SPA shell, host DOM change, paywall serving login fragment)`;
        return stubResult(cfg, url, `body empty/too small (${conv.stats.bodyChars} chars)`, detail);
      }

      const images: string[] = [];
      let imgFailed = 0;
      const referer = cfg.imageReferer ? cfg.imageReferer(url) : url;
      for (const dl of conv.imagesToDownload) {
        const dest = join(opts.slugDir, dl.localFilename);
        const bytes = downloadImage(dl.remoteUrl, dest, undefined, referer);
        if (bytes > 0) images.push(dl.localFilename);
        else imgFailed++;
      }

      const flags: string[] = imgFailed > 0 ? [`${cfg.name}-image-download-partial`] : [];
      return {
        markdown: conv.markdown,
        title: conv.metadata.title,
        images,
        metadata: {
          source: cfg.name,
          title: conv.metadata.title,
          description: conv.metadata.description,
          published_at: conv.metadata.publishedAt,
          authors: conv.metadata.authors,
          stats: conv.stats,
        },
        flags,
        notes: [
          `${cfg.name}: ${conv.stats.bodyChars} body chars, ` +
          `${images.length}/${conv.imagesToDownload.length} image(s) downloaded` +
          (imgFailed > 0 ? ` (${imgFailed} failed)` : ""),
        ],
      };
    },
  };

  const testHooks: SiteTestHooks = {
    name: cfg.name,
    converterName: cfg.converterName,
    snapshotHosts: cfg.snapshotHosts ?? cfg.hosts,
    runFromFixture(input: InputDoc) {
      if (input.fn !== cfg.converterName) {
        throw new Error(`${cfg.name} test-hooks: unexpected fn ${input.fn}`);
      }
      const [opts] = input.args as [ArticleFixtureArgs];
      const r = runConverter(opts);
      const { markdown, ...rest } = r;
      return { markdown, rest: rest as Record<string, unknown> };
    },
    capture(url: string): CaptureResult {
      const r = plainFetch(url);
      if (r.error) throw new Error(`${cfg.name} fetch failed: ${r.error}`);
      if (!r.html || r.html.length < 1000) throw new Error(`${cfg.name} HTML empty/short (${r.html.length} chars)`);
      const args: [ArticleFixtureArgs] = [{ html: r.html, url }];
      const result = runConverter(args[0]);
      const { markdown, ...rest } = result;
      return {
        input: { fn: cfg.converterName, args },
        markdown,
        rest: rest as Record<string, unknown>,
      };
    },
  };

  return { site, testHooks };
}

function stubResult(cfg: ArticleSiteConfig, url: string, summary: string, errorDetail?: string): Result {
  return makeStub({
    url,
    module: cfg.name,
    kind: "fetch-failed",
    title: `${cfg.name} article (fetch failed)`,
    summary,
    advice:
      `${cfg.name}'s site module uses plain curl + JSDOM. ` +
      `Open the URL in a browser to confirm it renders; if it does, the host may have ` +
      `changed its DOM and need a converter update.`,
    errorDetail,
  });
}
