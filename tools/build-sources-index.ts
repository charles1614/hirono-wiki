#!/usr/bin/env node
/**
 * build-sources-index: scan Sources/**.md and emit .wiki-sources-index.json,
 * the URL-dedup state file. Keyed by normalized URL so the next ingest can
 * cheaply check "have I already filed this source?"
 *
 *   npx tsx build-sources-index.ts             # write
 *   npx tsx build-sources-index.ts --dry-run   # print, don't write
 *
 * Idempotent. Safe to re-run after every ingest.
 *
 * Schema of .wiki-sources-index.json:
 *   {
 *     "<normalized_url>": {
 *       "slug": "<source slug>",
 *       "repo_path": "Sources/2026/2026-04-19-foo.md",
 *       "raw_source": "<original raw_source value from frontmatter>",
 *       "ingested_at": "<frontmatter created date>"
 *     },
 *     ...
 *   }
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { walkWikiDocs, slugOf, bucketOf } from "./link-map.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..");
const INDEX_PATH = join(REPO_ROOT, ".wiki-sources-index.json");

export interface SourceIndexEntry {
  slug: string;
  repo_path: string;
  raw_source: string;
  ingested_at: string;
}

export type SourceIndex = Record<string, SourceIndexEntry>;

/**
 * Normalize a URL for dedup:
 *  - lowercase scheme + host
 *  - strip trailing slash
 *  - strip common tracking query params
 *  - drop fragment (#...) for HTTP URLs (keep for in-doc anchors? for v0.5: drop)
 *  - leave non-HTTP URLs (lark://, raindrop://) alone
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) {
    // lark://, raindrop://, etc — pass through lowercased scheme
    return trimmed.replace(/^([a-z]+):\/\//i, (_m, s) => `${s.toLowerCase()}://`);
  }
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return trimmed;
  }
  // host is already lowercased by URL parser
  // strip tracking params
  const drop = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "ref", "ref_src"];
  for (const k of drop) u.searchParams.delete(k);
  // alphabetize remaining params for stable comparison
  const sorted = [...u.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  u.search = "";
  for (const [k, v] of sorted) u.searchParams.append(k, v);
  // drop fragment
  u.hash = "";
  // strip trailing slash on path (unless path is just "/")
  let path = u.pathname;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  u.pathname = path;
  return u.toString();
}

export function buildIndex(repoRoot: string): SourceIndex {
  const out: SourceIndex = {};
  const paths = walkWikiDocs(repoRoot);
  for (const p of paths) {
    if (bucketOf(p) !== "Sources") continue;
    const raw = readFileSync(join(repoRoot, p), "utf8");
    const { data } = matter(raw);
    const rawSource = String(data.raw_source ?? "").trim();
    if (!rawSource) continue;
    const norm = normalizeUrl(rawSource);
    if (!norm) continue;
    if (out[norm]) {
      // duplicate URL across two source files — surface but don't fail
      console.warn(`[build-sources-index] duplicate URL: ${norm}\n  ${out[norm].repo_path}\n  ${p}`);
      continue;
    }
    out[norm] = {
      slug: slugOf(p),
      repo_path: p,
      raw_source: rawSource,
      ingested_at: formatDate(data.created),
    };
  }
  return out;
}

function formatDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  return "";
}

function loadExisting(path: string): SourceIndex {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as SourceIndex;
  } catch {
    return {};
  }
}

function main(): void {
  const dryRun = process.argv.includes("--dry-run");
  const index = buildIndex(REPO_ROOT);
  const entries = Object.entries(index);
  const existing = loadExisting(INDEX_PATH);
  const same = JSON.stringify(existing) === JSON.stringify(index);
  console.log(`[build-sources-index] indexed ${entries.length} sources`);
  for (const [url, e] of entries.sort((a, b) => a[1].slug.localeCompare(b[1].slug))) {
    console.log(`  ${e.slug.padEnd(50)} → ${url}`);
  }
  if (same) {
    console.log(`[build-sources-index] no changes`);
    return;
  }
  if (dryRun) {
    console.log(`[build-sources-index] would write ${INDEX_PATH} (--dry-run)`);
    return;
  }
  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + "\n", "utf8");
  console.log(`[build-sources-index] wrote ${INDEX_PATH}`);
}

const isEntryPoint =
  process.argv[1] !== undefined && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main();
