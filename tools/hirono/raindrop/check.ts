/**
 * `hirono raindrop check` — enumerate the Raindrop bookmark corpus and
 * report:
 *   1. Duplicate URLs (same normalized URL across multiple bookmark IDs)
 *   2. Hostname coverage (`dedicated-adapter` / `web-read-fallback` per
 *      `tools/hirono/shared/dispatch.ts`'s `classifyCoverage`)
 *   3. New-hostnames-to-consider — uncovered domains with >1 bookmark
 *      (i.e. landing on the `_default` catch-all site module — candidates
 *      for promotion to a dedicated `tools/sites/<host>/` module)
 *
 * The command reads from a cache file (populated separately by the
 * MCP-capable caller). Exits non-zero when duplicates exist OR any
 * uncovered hostname has >1 bookmark, so it's useful as a CI/batch-close
 * signal.
 *
 * Usage:
 *   hirono raindrop check [--input <path>] [--json] [--quiet]
 *
 * If --input omitted, defaults to `.wiki-raindrop-cache.json` at repo root.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeUrl } from "../../build-sources-index.ts";
import { hostnameOf } from "../../fetch-raw.ts";
import { routeSite } from "../../sites/index.ts";

/**
 * Classify a URL's routing handler. Two real categories under the
 * unified architecture (`docs/fetcher-architecture.md`):
 *
 *   - `site:<name>` (label `dedicated-adapter`) — host-specific module.
 *   - `site:_default` (label `web-read-fallback`) — catch-all module
 *     fields the URL. Hosts here are candidates for promotion to a
 *     dedicated module.
 *
 * Returns "unknown" for URLs that fail to parse at all.
 */
type CoverageLabel = "dedicated-adapter" | "web-read-fallback" | "unknown";

function classifyCoverage(url: string): { label: CoverageLabel; handler?: string } {
  const host = hostnameOf(url);
  if (!host) return { label: "unknown" };
  const site = routeSite(url);
  if (site.name === "_default") {
    return { label: "web-read-fallback", handler: "site:_default" };
  }
  return { label: "dedicated-adapter", handler: `site:${site.name}` };
}

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..", "..", "..");
const DEFAULT_CACHE = join(REPO_ROOT, ".wiki-raindrop-cache.json");
const HOST_COUNTS_PATH = join(REPO_ROOT, "tools", "opencli", "host-counts.json");

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
  /**
   * Routing handler with explicit prefix:
   *   `site:<name>`     — host-specific module under tools/sites/<name>/
   *   `site:_default`   — catch-all module (label `web-read-fallback`)
   */
  handler?: string;
}

export interface CheckReport {
  total_bookmarks: number;
  unique_urls: number;
  unique_hosts: number;
  duplicates: Duplicate[];
  hosts: HostRow[];                    // all hosts, sorted by count desc
  uncovered_high_frequency: HostRow[]; // web-read-fallback + count >= 5
  graduations: HostGraduation[];       // hosts crossed from count==1 → count>=2 since last snapshot
  brand_new: HostGraduation[];         // hosts not in previous snapshot (only flagged if count >= 2)
}

export interface HostGraduation {
  hostname: string;
  previous_count: number; // 0 = brand new
  current_count: number;
}

/**
 * Persistent record of host counts captured at the last accepted check.
 * Used by the graduation watchdog to flag hosts that crossed from
 * singleton to multi-bookmark since we last looked.
 */
interface HostCountsSnapshot {
  generated_at: string;
  source: string;
  total_hosts: number;
  total_bookmarks: number;
  host_counts: Record<string, number>;
}

function loadHostCountsSnapshot(): HostCountsSnapshot | null {
  if (!existsSync(HOST_COUNTS_PATH)) return null;
  try {
    return JSON.parse(readFileSync(HOST_COUNTS_PATH, "utf8")) as HostCountsSnapshot;
  } catch {
    return null;
  }
}

function writeHostCountsSnapshot(report: CheckReport): void {
  const host_counts: Record<string, number> = {};
  for (const h of report.hosts) host_counts[h.hostname] = h.count;
  const snap: HostCountsSnapshot = {
    generated_at: new Date().toISOString(),
    source: ".wiki-raindrop-cache.json",
    total_hosts: report.unique_hosts,
    total_bookmarks: report.total_bookmarks,
    host_counts,
  };
  writeFileSync(HOST_COUNTS_PATH, JSON.stringify(snap, null, 2) + "\n");
}

/**
 * Compute graduations vs the saved snapshot:
 *   - graduated: previous_count == 1 AND current_count >= 2
 *   - brand_new: hostname missing from previous snapshot AND current_count >= 2
 */
function computeGraduations(report: CheckReport): { graduations: HostGraduation[]; brand_new: HostGraduation[] } {
  const snap = loadHostCountsSnapshot();
  const graduations: HostGraduation[] = [];
  const brand_new: HostGraduation[] = [];
  if (!snap) return { graduations, brand_new };
  const prev = snap.host_counts;
  for (const h of report.hosts) {
    const previous = prev[h.hostname] ?? -1;
    if (previous === -1 && h.count >= 2) {
      brand_new.push({ hostname: h.hostname, previous_count: 0, current_count: h.count });
    } else if (previous === 1 && h.count >= 2) {
      graduations.push({ hostname: h.hostname, previous_count: 1, current_count: h.count });
    }
  }
  return { graduations, brand_new };
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
        handler: c.handler,
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
    (h) => h.coverage === "web-read-fallback" && h.count > 1,
  );

  const partial: CheckReport = {
    total_bookmarks: cache.bookmarks.length,
    unique_urls: byNormUrl.size,
    unique_hosts: hosts.length,
    duplicates,
    hosts,
    uncovered_high_frequency,
    graduations: [],
    brand_new: [],
  };
  const grad = computeGraduations(partial);
  partial.graduations = grad.graduations;
  partial.brand_new = grad.brand_new;
  return partial;
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

  // Graduation watchdog: hosts that crossed from count==1 → count>=2 since
  // the last accepted snapshot, plus brand-new hosts with count >= 2.
  const totalGrad = r.graduations.length + r.brand_new.length;
  lines.push(`## Graduation candidates (${totalGrad})`);
  if (totalGrad === 0) {
    lines.push(`_No hosts graduated since the last accepted snapshot._`);
  } else {
    lines.push(`These hosts crossed into multi-bookmark territory and need adapter coverage (Layer 1 or Layer 2). After resolving each, run \`hirono raindrop check --update-graduation-snapshot\` to bake the new counts into \`tools/opencli/host-counts.json\`.`);
    lines.push(``);
    lines.push(`| hostname | was | now |`);
    lines.push(`|---|---:|---:|`);
    for (const g of r.graduations) {
      lines.push(`| ${g.hostname} | ${g.previous_count} | ${g.current_count} |`);
    }
    for (const g of r.brand_new) {
      lines.push(`| ${g.hostname} | (new) | ${g.current_count} |`);
    }
  }
  lines.push(``);

  // Uncovered high-frequency
  lines.push(`## Uncovered hostnames with >1 bookmark (${r.uncovered_high_frequency.length})`);
  if (r.uncovered_high_frequency.length === 0) {
    lines.push(`_All high-frequency domains are covered by a dedicated adapter._`);
  } else {
    lines.push(`These domains fall through to the catch-all \`tools/sites/_default/\` module. Consider promoting them to dedicated site modules under \`tools/sites/<host>/\` (see [\`tools/sites/MIGRATION.md\`](tools/sites/MIGRATION.md)).`);
    lines.push(``);
    lines.push(`| hostname | count |`);
    lines.push(`|---|---|`);
    for (const h of r.uncovered_high_frequency) {
      lines.push(`| ${h.hostname} | ${h.count} |`);
    }
  }
  lines.push(``);

  // Full hostname distribution: every host with >1 bookmark, sorted by count.
  // Single-bookmark hosts are summarized in a single tail row.
  const multi = r.hosts.filter((h) => h.count > 1);
  const single = r.hosts.filter((h) => h.count === 1);
  lines.push(`## Hostname distribution (${multi.length} hosts with >1 bookmark)`);
  lines.push(``);
  lines.push(`| hostname | count | coverage | handler |`);
  lines.push(`|---|---|---|---|`);
  for (const h of multi) {
    lines.push(`| ${h.hostname} | ${h.count} | ${h.coverage} | ${h.handler ?? "—"} |`);
  }
  if (single.length > 0) {
    lines.push(`| (${single.length} long-tail hosts × 1 bookmark) | ${single.length} | | |`);
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
  const updateSnapshot = argv.includes("--update-graduation-snapshot");
  const inputIdx = argv.indexOf("--input");
  const inputPath = inputIdx >= 0 ? argv[inputIdx + 1] : undefined;

  const { report, exitCode: baseExit } = runCheck({ inputPath, json: jsonFlag, quiet });

  // Graduation watchdog now ALWAYS runs as part of `runCheck`; no opt-in flag.
  // The --graduation-check flag is therefore a no-op (kept for documentation
  // purposes in CLAUDE.md / the plan, but graduation info is always rendered).

  if (jsonFlag) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else if (!quiet) {
    process.stdout.write(formatReport(report));
  }

  if (updateSnapshot) {
    writeHostCountsSnapshot(report);
    if (!quiet) process.stdout.write(`\n[snapshot updated → ${HOST_COUNTS_PATH}]\n`);
  }

  // Treat new graduations as a non-zero exit (so they can't silently slip
  // past in CI / batch runs). --update-graduation-snapshot acknowledges
  // them and resets the watchdog.
  const gradExit = (report.graduations.length + report.brand_new.length) > 0 && !updateSnapshot ? 1 : 0;
  process.exit(Math.max(baseExit, gradExit));
}
