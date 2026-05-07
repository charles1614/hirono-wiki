/**
 * `hirono raindrop status` — structured failure log.
 *
 * Joins three data sources into one row per Raindrop bookmark:
 *
 *   - `.wiki-raindrop-cache.json`     source of truth for "what URLs we have"
 *   - `.wiki-sources-index.json`      URL → slug mapping for ingested sources
 *   - `raw/<year>/<slug>/source.json` per-fetch state (status, flags)
 *
 * Each row is classified onto the canonical 15-kind taxonomy
 * (see ./failure-kind.ts), with operator overrides from
 * `Meta/sources-health-overrides.md` taking precedence.
 *
 * Output: markdown (default), JSON (ndjson), or CSV. No state file
 * written by default — the report is derived on each invocation.
 *
 * Usage:
 *   hirono raindrop status [--json|--csv|--md]
 *                          [--filter <kind>] [--filter-prefix <prefix>]
 *                          [--out <path>]
 */

import { existsSync, readFileSync, statSync, writeFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { hostnameOf, listRawSlugs, type RawSlugInfo } from "../../fetch-raw.ts";
import { normalizeUrl } from "../../bin/build-sources-index.ts";
import {
  classify,
  parseOverrides,
  ALL_KINDS,
  isFailureKind,
  compareKinds,
  type FailureKind,
  type Classification,
} from "./failure-kind.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const RAINDROP_CACHE = join(REPO_ROOT, ".wiki-raindrop-cache.json");
const SOURCES_INDEX = join(REPO_ROOT, ".wiki-sources-index.json");
const OVERRIDES_FILE = join(REPO_ROOT, "Meta", "sources-health-overrides.md");
const RAW_DIR = join(REPO_ROOT, "raw");

interface RaindropBookmark {
  bookmark_id: number;
  link: string;
  title?: string;
  tags?: string[];
}

interface SourcesIndexEntry {
  slug: string;
  repo_path: string;
  raw_source: string;
  ingested_at?: string;
}

export interface StatusRow {
  url: string;
  host: string;
  bookmark_id?: number;
  title?: string;
  slug?: string;
  source_path?: string;
  last_fetched?: string;
  quality_status?: string;
  flags: string[];
  kind: FailureKind;
  pinned: boolean;
  advice: string;
  /** Structured upstream error trace for stub rows; absent on clean rows. */
  error_detail?: string;
}

interface Options {
  format: "md" | "json" | "csv";
  filter?: FailureKind;
  filterPrefix?: string;
  out?: string;
}

function parseArgs(argv: string[]): Options {
  const o: Options = { format: "md" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") o.format = "json";
    else if (a === "--csv") o.format = "csv";
    else if (a === "--md") o.format = "md";
    else if (a === "--out") { o.out = argv[++i]; }
    else if (a === "--filter") {
      const k = argv[++i];
      if (!isFailureKind(k)) {
        console.error(`[status] unknown kind '${k}'. Valid: ${ALL_KINDS.join(", ")}`);
        process.exit(2);
      }
      o.filter = k;
    }
    else if (a === "--filter-prefix") { o.filterPrefix = argv[++i]; }
    else if (a === "--help" || a === "-h") {
      console.log(`hirono raindrop status [--json|--csv|--md] [--filter <kind>] [--filter-prefix <prefix>] [--out <path>]

Joins .wiki-raindrop-cache.json + .wiki-sources-index.json + raw/<slug>/source.json
into one row per bookmark. Classifies each onto the 15-kind failure taxonomy.

Kinds: ${ALL_KINDS.join(", ")}

Operator overrides: Meta/sources-health-overrides.md (format: \`- <slug>: pin-kind=<kind>\`).`);
      process.exit(0);
    }
    else {
      console.error(`[status] unknown flag: ${a}`);
      process.exit(2);
    }
  }
  return o;
}

/**
 * Auto-rebuild the sources index if it's stale (older than any
 * Sources/*.md). Falls back silently if build-sources-index isn't
 * runnable (e.g. dry test environment).
 */
function ensureFreshSourcesIndex(): void {
  if (!existsSync(SOURCES_INDEX)) {
    try {
      execSync("npx tsx tools/bin/build-sources-index.ts", { cwd: REPO_ROOT, stdio: "ignore" });
    } catch { /* best-effort */ }
    return;
  }
  const idxMtime = statSync(SOURCES_INDEX).mtimeMs;
  const sourcesDir = join(REPO_ROOT, "Sources");
  if (!existsSync(sourcesDir)) return;
  let newest = 0;
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      let st;
      try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) walk(p);
      else if (p.endsWith(".md") && st.mtimeMs > newest) newest = st.mtimeMs;
    }
  };
  walk(sourcesDir);
  if (newest > idxMtime) {
    try {
      execSync("npx tsx tools/bin/build-sources-index.ts", { cwd: REPO_ROOT, stdio: "ignore" });
    } catch { /* best-effort */ }
  }
}

function loadBookmarks(): RaindropBookmark[] {
  if (!existsSync(RAINDROP_CACHE)) {
    console.error(`[status] ${RAINDROP_CACHE} not found — run 'hirono raindrop refresh-cache' first`);
    process.exit(2);
  }
  const data = JSON.parse(readFileSync(RAINDROP_CACHE, "utf8"));
  return data.bookmarks || [];
}

function loadSourcesIndex(): Map<string, SourcesIndexEntry> {
  const out = new Map<string, SourcesIndexEntry>();
  if (!existsSync(SOURCES_INDEX)) return out;
  try {
    const raw: Record<string, SourcesIndexEntry> = JSON.parse(readFileSync(SOURCES_INDEX, "utf8"));
    for (const [k, v] of Object.entries(raw)) out.set(k, v);
  } catch { /* return empty */ }
  return out;
}

function loadRawByUrl(): Map<string, RawSlugInfo> {
  // Walk raw/ once, key by source.json.origin_url.
  const slugs = listRawSlugs(RAW_DIR);
  const out = new Map<string, RawSlugInfo>();
  for (const s of slugs) {
    const url = s.source?.origin_url;
    if (!url) continue;
    out.set(normalizeUrl(url), s);
  }
  return out;
}

export interface BuildOpts {
  /** Override paths (used by tests). */
  raindropCachePath?: string;
  sourcesIndexPath?: string;
  overridesPath?: string;
  rawDir?: string;
}

/**
 * Build the full set of status rows. Pure-ish (filesystem reads only,
 * no writes). Tests inject paths via opts.
 */
export function buildStatusRows(opts: BuildOpts = {}): StatusRow[] {
  const raindropCachePath = opts.raindropCachePath ?? RAINDROP_CACHE;
  const sourcesIndexPath = opts.sourcesIndexPath ?? SOURCES_INDEX;
  const overridesPath = opts.overridesPath ?? OVERRIDES_FILE;
  const rawDir = opts.rawDir ?? RAW_DIR;

  // Bookmarks
  let bookmarks: RaindropBookmark[] = [];
  if (existsSync(raindropCachePath)) {
    const data = JSON.parse(readFileSync(raindropCachePath, "utf8"));
    bookmarks = data.bookmarks || [];
  }

  // Sources index
  let sourcesIndex: Record<string, SourcesIndexEntry> = {};
  if (existsSync(sourcesIndexPath)) {
    try { sourcesIndex = JSON.parse(readFileSync(sourcesIndexPath, "utf8")); }
    catch { /* leave empty */ }
  }

  // Raw slug walker (keyed by normalized origin_url)
  const rawByUrl = new Map<string, RawSlugInfo>();
  for (const s of listRawSlugs(rawDir)) {
    const url = s.source?.origin_url;
    if (url) rawByUrl.set(normalizeUrl(url), s);
  }

  // Overrides
  const overrides = parseOverrides(overridesPath);

  const rows: StatusRow[] = [];
  const seenUrls = new Set<string>();

  for (const b of bookmarks) {
    const norm = normalizeUrl(b.link);
    seenUrls.add(norm);
    const idxEntry = sourcesIndex[norm];
    const slug = idxEntry?.slug;
    const rawInfo = rawByUrl.get(norm);
    const flags = rawInfo?.source?.quality_flags ?? [];
    const cls = classify({
      url: b.link,
      slug,
      quality_status: rawInfo?.source?.quality_status,
      flags,
      isIngested: !!idxEntry,
      isFetched: !!rawInfo,
    }, overrides);

    rows.push({
      url: b.link,
      host: hostnameOf(b.link),
      bookmark_id: b.bookmark_id,
      title: b.title,
      slug,
      source_path: idxEntry?.repo_path,
      last_fetched: rawInfo?.source?.fetched_at,
      quality_status: rawInfo?.source?.quality_status,
      flags,
      kind: cls.kind,
      pinned: cls.pinned,
      advice: cls.advice,
      error_detail: rawInfo?.source?.error_detail,
    });
  }

  // Orphans: rows in raw/ whose URL isn't in the bookmark cache.
  // These aren't bookmarks anymore (deleted from Raindrop) — surface so
  // the operator can decide to prune.
  for (const [norm, raw] of rawByUrl) {
    if (seenUrls.has(norm)) continue;
    const url = raw.source?.origin_url || norm;
    const slug = raw.slug;
    const flags = raw.source?.quality_flags ?? [];
    const cls = classify({
      url, slug,
      quality_status: raw.source?.quality_status,
      flags,
      isIngested: true,  // it's in raw/, so was ingested at some point
      isFetched: true,
    }, overrides);
    rows.push({
      url,
      host: hostnameOf(url),
      slug,
      source_path: undefined,
      last_fetched: raw.source?.fetched_at,
      quality_status: raw.source?.quality_status,
      flags,
      kind: cls.kind,
      pinned: cls.pinned,
      advice: `[orphan: bookmark deleted from Raindrop] ${cls.advice}`,
      error_detail: raw.source?.error_detail,
    });
  }

  rows.sort((a, b) => {
    const k = compareKinds(a.kind, b.kind);
    if (k !== 0) return k;
    if (a.host !== b.host) return a.host < b.host ? -1 : 1;
    return a.url < b.url ? -1 : 1;
  });
  return rows;
}

// ─────────────────────────── Output formats ─────────────────────────

function renderMd(rows: StatusRow[]): string {
  const lines: string[] = [];
  const total = rows.length;
  const byKind = new Map<FailureKind, StatusRow[]>();
  for (const r of rows) {
    if (!byKind.has(r.kind)) byKind.set(r.kind, []);
    byKind.get(r.kind)!.push(r);
  }
  const cleanCount = byKind.get("clean")?.length ?? 0;
  const stubCount = rows.filter(r =>
    r.kind === "upstream-deleted" || r.kind === "upstream-paywall" ||
    r.kind === "upstream-auth-gated" || r.kind === "upstream-spa-no-content" ||
    r.kind === "upstream-not-html" || r.kind === "intentional-stub-app-only"
  ).length;
  const errorCount = rows.filter(r =>
    r.kind === "host-lan-only" || r.kind === "host-malformed" ||
    r.kind === "host-throttled" || r.kind === "upstream-fetch-failed"
  ).length;

  lines.push(`# Raindrop sources health (${total} bookmark${total === 1 ? "" : "s"})`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Clean: ${cleanCount} · Stub: ${stubCount} · Fetch error: ${errorCount}`);
  lines.push("");

  for (const kind of ALL_KINDS) {
    const list = byKind.get(kind);
    if (!list || list.length === 0) continue;
    lines.push(`## ${kind} (${list.length})`);
    lines.push("");
    lines.push(`| host | bookmark | slug | last_fetched | error_detail (first line) |`);
    lines.push(`|---|---|---|---|---|`);
    for (const r of list) {
      const url = r.url.length > 60 ? r.url.slice(0, 57) + "..." : r.url;
      const slug = r.slug ?? "—";
      const date = r.last_fetched ? r.last_fetched.slice(0, 10) : "—";
      const pinMark = r.pinned ? " 📌" : "";
      // First line of error_detail when present; falls back to flag list
      // for clean rows + back-compat when older source.json has no
      // error_detail field.
      let detailCell: string;
      if (r.error_detail) {
        const firstLine = r.error_detail.split("\n", 1)[0].slice(0, 100);
        detailCell = `_${escapeMd(firstLine)}_`;
      } else if (r.flags.length > 0) {
        detailCell = "`" + r.flags.join("`, `") + "`";
      } else {
        detailCell = "—";
      }
      lines.push(`| ${r.host} | [link](${r.url}) ${url}${pinMark} | ${slug} | ${date} | ${detailCell} |`);
    }
    lines.push("");
    lines.push(`> Advice: ${list[0].advice}`);
    lines.push("");
  }
  return lines.join("\n");
}

function escapeMd(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function renderJson(rows: StatusRow[]): string {
  return rows.map(r => JSON.stringify(r)).join("\n");
}

function renderCsv(rows: StatusRow[]): string {
  const cols = ["kind", "host", "url", "slug", "last_fetched", "quality_status", "flags", "pinned", "bookmark_id", "error_detail_first_line"];
  const out = [cols.join(",")];
  for (const r of rows) {
    const firstLine = r.error_detail ? r.error_detail.split("\n", 1)[0] : "";
    const cells = [
      r.kind,
      r.host,
      `"${r.url.replace(/"/g, '""')}"`,
      r.slug ?? "",
      r.last_fetched ?? "",
      r.quality_status ?? "",
      `"${r.flags.join(";")}"`,
      r.pinned ? "true" : "false",
      r.bookmark_id?.toString() ?? "",
      `"${firstLine.replace(/"/g, '""').slice(0, 200)}"`,
    ];
    out.push(cells.join(","));
  }
  return out.join("\n");
}

export function main(argv: string[]): void {
  const opts = parseArgs(argv);
  ensureFreshSourcesIndex();

  let rows = buildStatusRows();

  if (opts.filter) rows = rows.filter(r => r.kind === opts.filter);
  if (opts.filterPrefix) rows = rows.filter(r => r.kind.startsWith(opts.filterPrefix!));

  let output: string;
  if (opts.format === "json") output = renderJson(rows);
  else if (opts.format === "csv") output = renderCsv(rows);
  else output = renderMd(rows);

  if (opts.out) {
    writeFileSync(opts.out, output + "\n");
    console.error(`[status] wrote ${rows.length} rows to ${opts.out}`);
  } else {
    process.stdout.write(output + "\n");
  }
}
