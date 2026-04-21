/**
 * `hirono raindrop export` — fetch a single source into raw/<slug>/.
 *
 * Accepts three identifier forms:
 *   - Raindrop ID: `1556353208` or `raindrop:1556353208`
 *     → looks up URL from cache (.wiki-raindrop-cache.json)
 *   - URL: any http(s) URL
 *     → requires --slug <slug>
 *   - Slug: `2026-04-21-deepwiki-slime-overview`
 *     → looks up origin from existing raw/<slug>/source.json (refetch)
 *
 * Improvement over `fetch-raw.ts fetch-url` / `refetch`: runs the hirono
 * POST_PROCESSORS pipeline between adapter output and writeRawArchive,
 * which strips UI chrome, resolves relative image URLs, and applies
 * other site-specific cleanups.
 *
 * Usage:
 *   hirono raindrop export <id|url|slug> [--slug <slug>] [--force] [--no-images]
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchUrlAndStore,
  type SourceJson,
  yearForSlug,
  rawDirFor,
} from "../../fetch-raw.ts";
import { applyPostProcessors } from "../shared/post-process.ts";
import type { CachedBookmark, Cache } from "./check.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..", "..", "..");
const DEFAULT_CACHE = join(REPO_ROOT, ".wiki-raindrop-cache.json");

export interface ExportOpts {
  /** The identifier: could be an ID, URL, or existing slug. */
  identifier: string;
  /** Override slug; required when identifier is a URL. */
  slug?: string;
  force?: boolean;
  downloadImages?: boolean;
  viaBrowser?: boolean;
  cachePath?: string;
}

type Resolved = {
  kind: "raindrop-id" | "url" | "slug-refetch";
  url: string;
  slug: string;
  bookmark?: CachedBookmark;
};

/**
 * Normalize the identifier input into a `{kind, url, slug, bookmark?}`
 * tuple. Errors out if a URL input lacks --slug or an ID isn't in cache.
 */
export function resolveIdentifier(
  identifier: string,
  opts: { slug?: string; cachePath?: string } = {},
): Resolved {
  // Strip `raindrop:` prefix if present
  const cleaned = identifier.replace(/^raindrop:/, "");

  // Case 1: all-digits → Raindrop bookmark ID
  if (/^\d+$/.test(cleaned)) {
    const cachePath = opts.cachePath ?? DEFAULT_CACHE;
    if (!existsSync(cachePath)) {
      throw new Error(
        `Raindrop ID ${cleaned} supplied but no cache at ${cachePath}. ` +
        `Refresh the cache first (via MCP) or pass --slug + URL directly.`
      );
    }
    const cache = JSON.parse(readFileSync(cachePath, "utf8")) as Cache;
    const b = cache.bookmarks.find((x) => String(x.bookmark_id) === cleaned);
    if (!b) {
      throw new Error(
        `Raindrop ID ${cleaned} not found in cache (${cache.bookmarks.length} bookmarks). ` +
        `Refresh the cache or check the ID.`
      );
    }
    const slug = opts.slug ?? deriveSlugFromBookmark(b);
    return { kind: "raindrop-id", url: b.link, slug, bookmark: b };
  }

  // Case 2: starts with http(s) → URL
  if (/^https?:\/\//i.test(cleaned)) {
    if (!opts.slug) {
      throw new Error(`URL identifier requires --slug <slug>`);
    }
    return { kind: "url", url: cleaned, slug: opts.slug };
  }

  // Case 3: slug — look up origin from raw/<year>/<slug>/source.json
  const slug = cleaned;
  const slugDir = rawDirFor(slug);
  const sourcePath = join(slugDir, "source.json");
  if (!existsSync(sourcePath)) {
    throw new Error(
      `slug "${slug}" has no existing source.json at ${sourcePath}. ` +
      `For first-time ingest, pass the URL directly with --slug ${slug}.`
    );
  }
  const src = JSON.parse(readFileSync(sourcePath, "utf8")) as SourceJson;
  if (!src.origin_url) {
    throw new Error(`source.json at ${sourcePath} missing origin_url`);
  }
  return { kind: "slug-refetch", url: src.origin_url, slug };
}

/** Derive a slug from a bookmark title + today's date. Simple kebab-case. */
function deriveSlugFromBookmark(b: CachedBookmark): string {
  const today = new Date().toISOString().slice(0, 10);
  const kebab = (b.title || "untitled")
    .toLowerCase()
    .replace(/[^\w\s\-\u4e00-\u9fff]/g, "")  // keep Chinese
    .replace(/\s+/g, "-")
    .slice(0, 40);
  return `${today}-${kebab}`;
}

/**
 * Run the export pipeline: identifier → URL → opencli adapter → post-processors →
 * writeRawArchive. Returns the final SourceJson that was written.
 */
export function runExport(opts: ExportOpts): { source: SourceJson; slug: string } {
  const resolved = resolveIdentifier(opts.identifier, {
    slug: opts.slug,
    cachePath: opts.cachePath,
  });

  const source = fetchUrlAndStore({
    slug: resolved.slug,
    url: resolved.url,
    viaBrowser: opts.viaBrowser ?? false,
    downloadImages: opts.downloadImages ?? true,
    // Append-only by default: if content.md exists, next fetch writes
    // content-rev2.md etc. Prevents a bad refetch from clobbering good
    // content (e.g. SPA cold-cache producing "Loading..." skeleton).
    // Pass --force on the CLI to overwrite.
    force: opts.force ?? false,
    transformMarkdown: (md, originUrl) => {
      const r = applyPostProcessors(md, originUrl);
      return {
        md: r.md,
        extraNotes: [
          ...(r.appliedNames.length > 0
            ? [`hirono post-processors: ${r.appliedNames.join(", ")}`]
            : []),
          ...r.notes,
        ],
        extraImageUrls: r.newAbsoluteImageUrls,
      };
    },
  });
  return { source, slug: resolved.slug };
}

export function main(argv: string[]): void {
  const positional = argv.filter((a) => !a.startsWith("--"));
  const identifier = positional[0];
  if (!identifier) {
    console.error(`usage: hirono raindrop export <id|url|slug> [--slug <slug>] [--force] [--no-images]`);
    process.exit(2);
  }

  const slugIdx = argv.indexOf("--slug");
  const slug = slugIdx >= 0 ? argv[slugIdx + 1] : undefined;
  // Default: append-only (content-revN.md on refetch). --force clobbers.
  const force = argv.includes("--force");
  const downloadImages = !argv.includes("--no-images");
  const viaBrowser = argv.includes("--via-browser");

  try {
    const { source, slug: finalSlug } = runExport({
      identifier, slug, force, downloadImages, viaBrowser,
    });
    const flags = source.quality_flags.length > 0 ? source.quality_flags.join(",") : "none";
    console.log(
      `[export] raw/${yearForSlug(finalSlug)}/${finalSlug}/ ` +
      `status=${source.quality_status} (${source.content_length} chars, ${source.images.length} images, flags=${flags})`
    );
    if (source.notes.length > 0) {
      for (const n of source.notes.slice(0, 8)) console.log(`  · ${n}`);
      if (source.notes.length > 8) console.log(`  · ... +${source.notes.length - 8} more notes`);
    }
  } catch (err) {
    const e = err as Error & { level?: string; code?: string; remediation?: string };
    if (e.level && e.code) {
      console.error(`[export] ${e.level} ${e.code}: ${e.message}`);
      if (e.remediation) console.error(`  remediation: ${e.remediation}`);
      process.exit(e.level === "L3" ? 1 : 0);
    }
    console.error(`[export] ${e.message}`);
    process.exit(1);
  }
}
