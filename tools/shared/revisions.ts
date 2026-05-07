/**
 * Per-slug revision tracking — `raw/<year>/<slug>/revisions.jsonl`.
 *
 * Append-only audit log of every fetch for a given slug. The latest
 * row corresponds to the canonical `source.json` (= newest content).
 * Older rows describe earlier fetches whose content lives at
 * `content-rev2.md`, `content-rev3.md`, etc. (the existing append-only
 * mechanism in `writeRawArchive`).
 *
 * One row per fetch. Atomic-append via single-write `O_APPEND`.
 *
 * Schema:
 * ```jsonl
 * {"rev":1,"fetched_at":"2026-04-21T...","content_file":"content.md",...}
 * {"rev":2,"fetched_at":"2026-05-08T...","content_file":"content-rev2.md",...}
 * ```
 *
 * Backwards-compatible. When the file is missing on a slug that
 * pre-dates this feature, callers can synthesize rev 1 from the
 * existing source.json via `backfillFromSource`.
 *
 * Corruption tolerance: each line is independently parsed. A partial
 * trailing line (interrupted write) is detected on read and skipped
 * with a warning; preceding history is unaffected.
 */

import { existsSync, readFileSync, openSync, writeSync, closeSync, fsyncSync } from "node:fs";
import { join } from "node:path";

import type { SourceJson } from "../fetch-raw.ts";

export interface RevisionRow {
  rev: number;
  fetched_at: string;
  content_file: string;
  content_sha: string;
  content_length: number;
  quality_status: "good" | "flagged" | "failed";
  quality_flags: string[];
  failure_kind?: string;
  image_count: number;
  fetcher: string;
  fetcher_reason: string;
}

const REV_FILENAME = "revisions.jsonl";

export function revisionsPath(slugDir: string): string {
  return join(slugDir, REV_FILENAME);
}

/**
 * Read the revision log for a slug. Returns rows in append order
 * (rev 1 first). On a partial trailing line (corruption), logs a
 * warning to stderr and returns the valid prefix.
 */
export function readRevisions(slugDir: string): RevisionRow[] {
  const path = revisionsPath(slugDir);
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf8").split("\n");
  const out: RevisionRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as RevisionRow);
    } catch {
      // Tolerate a corrupt last line (interrupted write); flag earlier
      // corruption as a hard error since it indicates a real problem.
      const isLast = i === lines.length - 1 || lines.slice(i + 1).every(l => !l.trim());
      if (isLast) {
        console.warn(`[revisions] ${path}: ignoring partial last line (interrupted write?)`);
      } else {
        console.error(`[revisions] ${path}: corrupt line at offset ${i + 1} — pass --repair to truncate`);
      }
      break;
    }
  }
  return out;
}

/**
 * Append a single revision row atomically. Uses O_APPEND so concurrent
 * writers (across processes — slug-locks already prevent that within
 * a single process) don't interleave partial writes.
 */
export function appendRevision(slugDir: string, row: RevisionRow): void {
  const path = revisionsPath(slugDir);
  const fd = openSync(path, "a");
  try {
    const line = JSON.stringify(row) + "\n";
    writeSync(fd, line);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/**
 * Synthesize a rev-1 row from an existing source.json. Used to backfill
 * slugs that pre-date this feature. The content file is assumed to be
 * `content.md` (the canonical-latest); image count comes from
 * source.images.length; failure_kind is left undefined (caller can
 * compute it via the classifier and pass it in if needed).
 */
export function rowFromSource(source: SourceJson, contentFile = "content.md", failureKind?: string): RevisionRow {
  return {
    rev: 1,
    fetched_at: source.fetched_at,
    content_file: contentFile,
    content_sha: source.content_sha,
    content_length: source.content_length,
    quality_status: source.quality_status,
    quality_flags: source.quality_flags,
    failure_kind: failureKind,
    image_count: source.images?.length ?? 0,
    fetcher: source.fetcher,
    fetcher_reason: source.fetcher_reason,
  };
}

/**
 * Lazily backfill: if revisions.jsonl is missing but source.json exists,
 * synthesize a rev 1 row and append it. Idempotent — safe to call
 * multiple times.
 */
export function backfillFromSource(slugDir: string, failureKind?: string): RevisionRow | null {
  if (existsSync(revisionsPath(slugDir))) return null;
  const sourcePath = join(slugDir, "source.json");
  if (!existsSync(sourcePath)) return null;
  let src: SourceJson;
  try { src = JSON.parse(readFileSync(sourcePath, "utf8")) as SourceJson; }
  catch { return null; }
  const row = rowFromSource(src, "content.md", failureKind);
  appendRevision(slugDir, row);
  return row;
}

/**
 * Compute the next rev number for a slug. Reads revisions.jsonl;
 * returns max(rev) + 1, or 1 if no rows yet.
 */
export function nextRev(slugDir: string): number {
  const rows = readRevisions(slugDir);
  if (rows.length === 0) return 1;
  return Math.max(...rows.map(r => r.rev)) + 1;
}

/**
 * Truncate revisions.jsonl to its last fully-valid line. Used by
 * `--repair` after `readRevisions` has reported corruption.
 *
 * Re-reads tolerantly to find the last good row, rewrites the file
 * containing only the validated prefix.
 */
export function repairRevisions(slugDir: string): { kept: number; dropped: number } {
  const path = revisionsPath(slugDir);
  if (!existsSync(path)) return { kept: 0, dropped: 0 };
  const lines = readFileSync(path, "utf8").split("\n");
  const kept: string[] = [];
  let dropped = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    try { JSON.parse(line); kept.push(line); }
    catch { dropped++; }
  }
  // Atomic rewrite via writeSync to a temp + rename would be more robust,
  // but the file is small and the lock surrounds the call.
  const fd = openSync(path, "w");
  try {
    if (kept.length > 0) writeSync(fd, kept.join("\n") + "\n");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  return { kept: kept.length, dropped };
}
