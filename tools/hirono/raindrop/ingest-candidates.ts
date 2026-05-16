/**
 * `hirono raindrop ingest-candidates` — emit JSON-array of raw slugs
 * that are eligible for wiki ingestion.
 *
 * Eligibility: `quality_status === "good"` AND `origin_url` is NOT
 * already in `.wiki-sources-index.json`. The output is shaped
 * directly to feed into `tools/bin/ingest_batch.ts plan`:
 *
 *   hirono raindrop ingest-candidates > /tmp/c.json
 *   npx tsx tools/bin/ingest_batch.ts plan /tmp/c.json
 *
 * Each emitted entry has shape `{ id: "raindrop:<bookmark_id>", url, title }`
 * matching `Candidate` in `ingest_batch.ts`. When a slug doesn't have
 * a paired raindrop bookmark_id (e.g. orphan slugs that fell out of
 * the cache), the id is `slug:<slug>` so each candidate is still
 * uniquely keyable.
 *
 * Flags:
 *   --limit N         Cap output to N candidates (oldest fetched_at first).
 *   --host <h>        Only candidates whose hostname == <h> (suffix match,
 *                     so `feishu.cn` includes `*.feishu.cn` tenants).
 *   --json | --md     Output format. JSON (default) is the ingest_batch
 *                     plan input; markdown is human-readable.
 *
 * Exit code: 0 always (zero candidates is a valid state, not an error).
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RawIndexEntry } from "../../fetch-raw.ts";
import { loadIngestedUrlSet } from "../../fetch-raw.ts";
import { normalizeUrl } from "../../bin/build-sources-index.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..", "..", "..");
const RAW_INDEX_PATH = join(REPO_ROOT, "raw", "raindrop", "_index.json");

/**
 * Build a set of slugs already present as `Sources/<year>/<slug>.md`.
 *
 * Why this exists: `loadIngestedUrlSet` dedups by normalized `source_url`,
 * but Raindrop short share URLs (Reddit `/s/<id>`, xhslink, etc.) redirect
 * to canonical URLs that the fetcher captures into Source frontmatter.
 * Raw index keeps the short URL, Source keeps the canonical — so URL
 * comparison misses these. Slug match is the authoritative signal
 * because Source filenames equal raw folder names verbatim (CLAUDE.md §10).
 */
function loadIngestedSlugSet(sourcesRoot: string): Set<string> {
  const out = new Set<string>();
  if (!existsSync(sourcesRoot)) return out;
  for (const year of readdirSync(sourcesRoot)) {
    const yearDir = join(sourcesRoot, year);
    let st;
    try { st = statSync(yearDir); } catch { continue; }
    if (!st.isDirectory()) continue;
    for (const f of readdirSync(yearDir)) {
      if (f.endsWith(".md")) out.add(f.slice(0, -3));
    }
  }
  return out;
}

interface CandidateOut {
  id: string;
  url: string;
  title: string;
}

export interface IngestCandidatesOpts {
  limit?: number;
  host?: string;
  rawIndexPath?: string;
  sourcesIndexPath?: string;
}

/**
 * Compute the candidate list. Pure function — no I/O side effects
 * except the two file reads.
 */
export function computeIngestCandidates(opts: IngestCandidatesOpts = {}): CandidateOut[] {
  const indexPath = opts.rawIndexPath ?? RAW_INDEX_PATH;
  if (!existsSync(indexPath)) return [];
  let parsed: { slugs?: Record<string, RawIndexEntry> };
  try {
    parsed = JSON.parse(readFileSync(indexPath, "utf8"));
  } catch {
    return [];
  }

  const ingestedUrls = loadIngestedUrlSet(opts.sourcesIndexPath);
  const ingestedSlugs = loadIngestedSlugSet(join(REPO_ROOT, "Sources"));
  const out: { entry: RawIndexEntry; ts: string }[] = [];

  for (const entry of Object.values(parsed.slugs ?? {})) {
    if (entry.quality_status !== "good") continue;
    if (!entry.link) continue;
    // Filter by host (suffix match for tenants).
    if (opts.host) {
      const host = (entry.hostname ?? "").toLowerCase();
      const filt = opts.host.toLowerCase().replace(/^www\./, "");
      if (host !== filt && !host.endsWith("." + filt)) continue;
    }
    // Skip if already ingested. Check both URL and slug — slug catches
    // share-link redirects where raw `link` and Source `source_url` differ
    // (Reddit /s/<id>, xhslink shorteners, etc.).
    if (entry.slug && ingestedSlugs.has(entry.slug)) continue;
    const norm = normalizeUrl(entry.link);
    if (ingestedUrls.has(norm)) continue;
    out.push({ entry, ts: entry.fetched_at ?? "0" });
  }

  // Oldest first — operator typically wants to ingest the longest-
  // sitting clean raw archives before the freshest ones.
  out.sort((a, b) => a.ts.localeCompare(b.ts));

  const limited = opts.limit && opts.limit > 0 ? out.slice(0, opts.limit) : out;
  return limited.map(({ entry }) => ({
    id: entry.bookmark_id ? `raindrop:${entry.bookmark_id}` : `slug:${entry.slug}`,
    url: entry.link!,
    title: entry.title ?? entry.slug,
  }));
}

function argVal(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
function argFlag(args: string[], name: string): boolean { return args.includes(name); }

export function main(args: string[]): void {
  const limitStr = argVal(args, "--limit");
  const limit = limitStr !== undefined ? parseInt(limitStr, 10) : undefined;
  const host = argVal(args, "--host");
  const md = argFlag(args, "--md");

  const candidates = computeIngestCandidates({
    limit: typeof limit === "number" && !isNaN(limit) ? limit : undefined,
    host,
  });

  if (md) {
    if (candidates.length === 0) {
      console.log("# Ingest candidates\n\n_None — every clean raw slug is already ingested into Sources/, or the corpus has zero clean slugs._");
      return;
    }
    console.log(`# Ingest candidates (${candidates.length}${limit ? `, capped at ${limit}` : ""})`);
    console.log("");
    console.log("| id | host | title |");
    console.log("|---|---|---|");
    for (const c of candidates) {
      const h = (() => { try { return new URL(c.url).hostname; } catch { return "?"; } })();
      const title = c.title.length > 80 ? c.title.slice(0, 77) + "…" : c.title;
      console.log(`| \`${c.id}\` | ${h} | ${title} |`);
    }
    console.log("");
    console.log(`_Pipe to \`ingest_batch plan\`:_ \`hirono raindrop ingest-candidates > /tmp/c.json && npx tsx tools/bin/ingest_batch.ts plan /tmp/c.json\``);
    return;
  }

  // Default: JSON array suitable as input to `ingest_batch plan`.
  console.log(JSON.stringify(candidates, null, 2));
}
