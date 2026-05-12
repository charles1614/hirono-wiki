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
 *       "source_url": "<original source_url value from frontmatter>",
 *       "ingested_at": "<frontmatter created date>"
 *     },
 *     ...
 *   }
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { writeFileAtomic } from "../shared/atomic-write.ts";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { walkWikiDocs, slugOf, bucketOf } from "../link-map.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
// Resolves to the wiki root (parent of `tools/`). THIS_FILE is at
// `tools/bin/build-sources-index.ts`, so `dirname/..` is `tools/` and
// `dirname/../..` is the wiki root. Earlier code only went up one
// level — that resolved to `tools/` and `walkWikiDocs(tools/)` found
// zero Sources files because Sources/ lives at the wiki root.
const REPO_ROOT = resolve(dirname(THIS_FILE), "..", "..");
const INDEX_PATH = join(REPO_ROOT, ".wiki-sources-index.json");

export interface SourceIndexEntry {
  slug: string;
  repo_path: string;
  source_url: string;
  ingested_at: string;
}

export type SourceIndex = Record<string, SourceIndexEntry>;

/**
 * Thrown by the strict readers (`readSourceIndexStrict`) when the on-disk
 * sources-index file exists but cannot be parsed. Caller should surface
 * the file path + size + error to the user — **never** silently fall back
 * to empty, which would cause every subsequent ingest to think all URLs
 * are new and create duplicate Source docs across the corpus.
 *
 * Attach `cause` (the original error) for debuggability.
 */
export class IndexCorruptedError extends Error {
  public readonly path: string;
  public readonly fileSize: number;
  public readonly parseError: string;
  constructor(path: string, fileSize: number, parseError: string) {
    super(
      `sources index at ${path} failed to parse: ${parseError} ` +
      `(file size: ${fileSize} bytes). ` +
      `Refusing to silently fall back to empty (would duplicate every ingest). ` +
      `Inspect the file, fix or delete it (a .bak sibling exists if a prior write succeeded), then retry.`,
    );
    this.name = "IndexCorruptedError";
    this.path = path;
    this.fileSize = fileSize;
    this.parseError = parseError;
  }
}

/**
 * Strictly read the sources index. Returns {} if the file doesn't exist;
 * throws IndexCorruptedError if it exists but parses as garbage.
 * Callers that today silently catch and return {} should migrate to this.
 */
export function readSourceIndexStrict(path: string): SourceIndex {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("top-level value is not a JSON object");
    }
    return parsed as SourceIndex;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new IndexCorruptedError(path, raw.length, msg);
  }
}

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
    const rawSource = String(data.source_url ?? "").trim();
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
      source_url: rawSource,
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
  // Strict read: a corrupt index is a stop-the-world condition. Silently
  // falling back to {} would cause every subsequent ingest to dedupe
  // against an empty index and create duplicate Source docs.
  return readSourceIndexStrict(path);
}

/**
 * Write the sources index with a `.bak` sibling of the prior version.
 * The backup is best-effort — if it fails the primary write still proceeds.
 * On-disk write is atomic (tmp + rename) so a crash can't truncate to zero.
 */
export function writeSourceIndex(path: string, index: SourceIndex): void {
  if (existsSync(path)) {
    try {
      copyFileSync(path, `${path}.bak`);
    } catch {
      // Non-fatal; a corrupt .bak is no worse than no .bak.
    }
  }
  writeFileAtomic(path, JSON.stringify(index, null, 2) + "\n");
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
  writeSourceIndex(INDEX_PATH, index);
  console.log(`[build-sources-index] wrote ${INDEX_PATH}`);
}

const isEntryPoint =
  process.argv[1] !== undefined && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main();
