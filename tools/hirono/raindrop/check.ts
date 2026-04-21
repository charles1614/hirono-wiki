/**
 * `hirono raindrop check` — enumerate the Raindrop bookmark corpus and
 * report:
 *   1. Duplicate URLs (same normalized URL across multiple bookmark IDs)
 *   2. Hostname coverage (covered by DISPATCH_RULES / falls through to
 *      web-read / unknown)
 *   3. New-hostnames-to-consider — uncovered domains with ≥5 bookmarks
 *
 * The command reads from a cache file (populated separately by the
 * MCP-capable caller). Exits non-zero when duplicates exist OR any
 * uncovered hostname has ≥5 bookmarks, so it's useful as a CI/batch-close
 * signal.
 *
 * Usage:
 *   hirono raindrop check [--input <path>] [--json] [--quiet]
 *
 * If --input omitted, defaults to `.wiki-raindrop-cache.json` at repo root.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeUrl } from "../../build-sources-index.ts";
import { classifyCoverage } from "../shared/dispatch.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..", "..", "..");
const DEFAULT_CACHE = join(REPO_ROOT, ".wiki-raindrop-cache.json");

export interface CachedBookmark {
  bookmark_id: number;
  title: string;
  link: string;
  created?: string;
  collection_id?: number;
  tags?: string[];
}

export interface Cache {
  fetched_at: string;
  total: number;
  bookmarks: CachedBookmark[];
}

/** Host extraction that mirrors the canonical helper. */
function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

export interface Duplicate {
  normalized_url: string;
  bookmarks: CachedBookmark[];
}

export interface HostRow {
  hostname: string;
  count: number;
  coverage: "dedicated-adapter" | "web-read-fallback" | "unknown";
  adapter?: string;
}

export interface CheckReport {
  total_bookmarks: number;
  unique_urls: number;
  unique_hosts: number;
  duplicates: Duplicate[];
  hosts: HostRow[];                    // all hosts, sorted by count desc
  uncovered_high_frequency: HostRow[]; // web-read-fallback + count >= 5
}

export function buildReport(cache: Cache): CheckReport {
  // Group bookmarks by normalized URL to find duplicates
  const byNormUrl = new Map<string, CachedBookmark[]>();
  const hostCounts = new Map<string, HostRow>();

  for (const b of cache.bookmarks) {
    if (!b.link) continue;
    const norm = normalizeUrl(b.link);
    const arr = byNormUrl.get(norm) ?? [];
    arr.push(b);
    byNormUrl.set(norm, arr);

    const host = hostOf(b.link);
    if (!host) continue;
    const existing = hostCounts.get(host);
    if (existing) {
      existing.count += 1;
    } else {
      const c = classifyCoverage(b.link);
      hostCounts.set(host, {
        hostname: host,
        count: 1,
        coverage: c.label,
        adapter: c.adapter,
      });
    }
  }

  const duplicates: Duplicate[] = [];
  for (const [normUrl, arr] of byNormUrl) {
    if (arr.length > 1) {
      duplicates.push({ normalized_url: normUrl, bookmarks: arr });
    }
  }
  duplicates.sort((a, b) => b.bookmarks.length - a.bookmarks.length);

  const hosts = [...hostCounts.values()].sort((a, b) => b.count - a.count);
  const uncovered_high_frequency = hosts.filter(
    (h) => h.coverage === "web-read-fallback" && h.count >= 5,
  );

  return {
    total_bookmarks: cache.bookmarks.length,
    unique_urls: byNormUrl.size,
    unique_hosts: hosts.length,
    duplicates,
    hosts,
    uncovered_high_frequency,
  };
}

export function formatReport(r: CheckReport): string {
  const lines: string[] = [];
  lines.push(`# Raindrop corpus — check report`);
  lines.push(``);
  lines.push(`**${r.total_bookmarks} bookmarks** · **${r.unique_urls} unique URLs** · **${r.unique_hosts} unique hostnames**`);
  lines.push(``);

  // Duplicates
  lines.push(`## Duplicates (${r.duplicates.length})`);
  if (r.duplicates.length === 0) {
    lines.push(`_No duplicate URLs found._`);
  } else {
    lines.push(`Bookmarks sharing a normalized URL. Consider deleting all but one in Raindrop.`);
    lines.push(``);
    for (const d of r.duplicates.slice(0, 20)) {
      lines.push(`- **${d.normalized_url}** — ${d.bookmarks.length} copies:`);
      for (const b of d.bookmarks) {
        lines.push(`  - \`${b.bookmark_id}\` · ${(b.title || "(no title)").slice(0, 80)}`);
      }
    }
    if (r.duplicates.length > 20) {
      lines.push(`- ... +${r.duplicates.length - 20} more`);
    }
  }
  lines.push(``);

  // Uncovered high-frequency
  lines.push(`## Uncovered hostnames with ≥5 bookmarks (${r.uncovered_high_frequency.length})`);
  if (r.uncovered_high_frequency.length === 0) {
    lines.push(`_All high-frequency domains are covered by a dedicated adapter._`);
  } else {
    lines.push(`These domains fall through to generic \`opencli web read\`. Consider authoring a dedicated adapter or a domain-specific post-processor.`);
    lines.push(``);
    lines.push(`| hostname | count |`);
    lines.push(`|---|---|`);
    for (const h of r.uncovered_high_frequency) {
      lines.push(`| ${h.hostname} | ${h.count} |`);
    }
  }
  lines.push(``);

  // Full hostname table (top 30)
  lines.push(`## Hostname distribution (top 30)`);
  lines.push(``);
  lines.push(`| hostname | count | coverage | adapter |`);
  lines.push(`|---|---|---|---|`);
  for (const h of r.hosts.slice(0, 30)) {
    lines.push(`| ${h.hostname} | ${h.count} | ${h.coverage} | ${h.adapter ?? "—"} |`);
  }
  if (r.hosts.length > 30) {
    const tailCount = r.hosts.slice(30).reduce((s, h) => s + h.count, 0);
    const tailHosts = r.hosts.length - 30;
    lines.push(`| (${tailHosts} more hostnames) | ${tailCount} | | |`);
  }

  return lines.join("\n") + "\n";
}

export interface CheckOpts {
  inputPath?: string;
  json?: boolean;
  quiet?: boolean;
}

export function runCheck(opts: CheckOpts = {}): { report: CheckReport; exitCode: number } {
  const path = opts.inputPath ?? DEFAULT_CACHE;
  if (!existsSync(path)) {
    throw new Error(
      `[check] cache not found at ${path}. ` +
      `Populate it first (use the MCP-based refresh documented in Meta/schema.md, ` +
      `or pass --input <path>).`
    );
  }
  let cache: Cache;
  try {
    cache = JSON.parse(readFileSync(path, "utf8")) as Cache;
  } catch (err) {
    throw new Error(`[check] cache at ${path} is not valid JSON: ${(err as Error).message}`);
  }
  if (!cache.bookmarks || !Array.isArray(cache.bookmarks)) {
    throw new Error(`[check] cache at ${path} is missing .bookmarks array`);
  }

  const report = buildReport(cache);
  const exitCode = (report.duplicates.length > 0 || report.uncovered_high_frequency.length > 0)
    ? 1
    : 0;
  return { report, exitCode };
}

export function main(argv: string[]): void {
  const jsonFlag = argv.includes("--json");
  const quiet = argv.includes("--quiet");
  const inputIdx = argv.indexOf("--input");
  const inputPath = inputIdx >= 0 ? argv[inputIdx + 1] : undefined;

  const { report, exitCode } = runCheck({ inputPath, json: jsonFlag, quiet });

  if (jsonFlag) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else if (!quiet) {
    process.stdout.write(formatReport(report));
  }
  process.exit(exitCode);
}
