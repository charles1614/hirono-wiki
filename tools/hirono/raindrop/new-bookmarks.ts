/**
 * `hirono raindrop new` — list bookmarks present in the Raindrop cache
 * but absent from the local sources index. The output shape matches
 * `ingest_batch plan`'s `<candidates.json>` input:
 *
 *   [{ "id": "raindrop:<bookmark_id>", "url": "...", "title": "..." }, ...]
 *
 * so the typical workflow is:
 *
 *   hirono raindrop new --out batch-N.json
 *   ingest_batch plan batch-N.json
 *   ingest_batch next
 *   ... (hand off to LLM)
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeUrl } from "../../bin/build-sources-index.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const RAINDROP_CACHE = join(REPO_ROOT, ".wiki-raindrop-cache.json");
const SOURCES_INDEX = join(REPO_ROOT, ".wiki-sources-index.json");

interface Bookmark {
  bookmark_id: number;
  link: string;
  title?: string;
  tags?: string[];
}

interface Candidate {
  id: string;
  url: string;
  title?: string;
  tags?: string[];
}

interface Options {
  format: "json" | "md";
  out?: string;
  /** Override paths (used by tests). */
  raindropCachePath?: string;
  sourcesIndexPath?: string;
}

function parseArgs(argv: string[]): Options {
  const o: Options = { format: "json" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") o.format = "json";
    else if (a === "--md") o.format = "md";
    else if (a === "--out") { o.out = argv[++i]; }
    else if (a === "--help" || a === "-h") {
      console.log(`hirono raindrop new [--json|--md] [--out <path>]

List bookmarks present in .wiki-raindrop-cache.json but absent from
.wiki-sources-index.json. Output is JSON-array shape suitable for
\`ingest_batch plan\`.

Auto-rebuilds .wiki-sources-index.json if older than any Sources/*.md.`);
      process.exit(0);
    }
    else {
      console.error(`[new] unknown flag: ${a}`);
      process.exit(2);
    }
  }
  return o;
}

function ensureFreshSourcesIndex(): void {
  if (!existsSync(SOURCES_INDEX)) {
    try { execSync("npx tsx tools/bin/build-sources-index.ts", { cwd: REPO_ROOT, stdio: "ignore" }); }
    catch { /* best-effort */ }
  }
}

export function findNewBookmarks(opts: { raindropCachePath?: string; sourcesIndexPath?: string } = {}): Candidate[] {
  const cachePath = opts.raindropCachePath ?? RAINDROP_CACHE;
  const indexPath = opts.sourcesIndexPath ?? SOURCES_INDEX;
  if (!existsSync(cachePath)) {
    throw new Error(`raindrop cache not found: ${cachePath}`);
  }
  const data = JSON.parse(readFileSync(cachePath, "utf8")) as { bookmarks: Bookmark[] };
  const bookmarks = data.bookmarks || [];

  const indexed = new Set<string>();
  if (existsSync(indexPath)) {
    try {
      const raw: Record<string, unknown> = JSON.parse(readFileSync(indexPath, "utf8"));
      for (const k of Object.keys(raw)) indexed.add(k);
    } catch { /* leave empty */ }
  }

  const out: Candidate[] = [];
  for (const b of bookmarks) {
    const norm = normalizeUrl(b.link);
    if (indexed.has(norm)) continue;
    out.push({
      id: `raindrop:${b.bookmark_id}`,
      url: b.link,
      title: b.title,
      tags: b.tags,
    });
  }
  return out;
}

function renderMd(items: Candidate[]): string {
  if (items.length === 0) return "# No new bookmarks\n\nAll Raindrop URLs are present in the sources index.\n";
  const lines: string[] = [`# New bookmarks (${items.length})`, "", `Generated: ${new Date().toISOString()}`, ""];
  lines.push("| id | host | title | url |");
  lines.push("|---|---|---|---|");
  for (const c of items) {
    let host = "";
    try { host = new URL(c.url).hostname; } catch {}
    const t = c.title ? c.title.replace(/\|/g, "\\|").slice(0, 60) : "—";
    lines.push(`| ${c.id} | ${host} | ${t} | ${c.url} |`);
  }
  return lines.join("\n");
}

export function main(argv: string[]): void {
  const opts = parseArgs(argv);
  ensureFreshSourcesIndex();
  const items = findNewBookmarks();
  const output = opts.format === "md" ? renderMd(items) : JSON.stringify(items, null, 2);
  if (opts.out) {
    writeFileSync(opts.out, output + "\n");
    console.error(`[new] wrote ${items.length} candidate(s) to ${opts.out}`);
  } else {
    process.stdout.write(output + "\n");
  }
}
