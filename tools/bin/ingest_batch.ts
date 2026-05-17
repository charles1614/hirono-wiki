#!/usr/bin/env node
/**
 * ingest_batch: state manager for v1 supervised-batch ingestion.
 *
 * This tool DOESN'T fetch sources or write pages — the LLM does that via
 * MCP tools (Raindrop, lark-hirono fetch, WebFetch). Its job is bookkeeping:
 * track which candidate sources are pending / in-progress / done / errored
 * across sessions, cheap-dedupe against `.wiki-sources-index.json`, and
 * hand out the next item to process.
 *
 * State file: `.wiki-batch-state.json` (gitignored).
 *
 * Subcommands:
 *
 *   plan <candidates.json> [--allow-flagged]
 *     Add candidates to state as `pending`. Skips any whose URL is already
 *     in `.wiki-sources-index.json` or already in this batch state.
 *     Candidates format (array): [{ "id": "raindrop:1556353208", "url": "...", "title": "..." }, ...]
 *     `id` is a free-form tag (e.g. "raindrop:<bookmark_id>", "space1:<node_token>", "url:<hash>").
 *
 *     Quality gate: candidates whose raw slug has `quality_status !==
 *     "good"` (looked up via raw/raindrop/_index.json) are skipped with
 *     a warning. Pass `--allow-flagged` to bypass — useful when
 *     deliberately ingesting from a known-imperfect raw slug (e.g.
 *     auth-walled stub the operator plans to hand-fill in Sources/).
 *
 *   next [--count N]
 *     Print next pending candidate(s) (default 1). Exit 0 with JSON; exit
 *     0 with "none" if empty. Does NOT change state — use `start` for that.
 *
 *   start <id>
 *     Mark a pending candidate as `in-progress`. Conservative; also stamps
 *     the start time. Useful for resume ("what was I in the middle of?").
 *
 *   mark-done <id> [--slug <slug>]
 *     Mark as `done`. Optionally records the produced slug (for auditing).
 *
 *   mark-errored <id> <message>
 *     Mark as `errored`. Doesn't block — the LLM can skip to the next.
 *
 *   reset <id>
 *     Reset an entry back to `pending` (e.g. after investigating an error).
 *
 *   status [--verbose]
 *     Print counts by state; --verbose lists each pending/in-progress.
 *
 *   prune-done
 *     Remove `done` entries from state to keep the file small.
 *
 *   summary
 *     Compact one-line summary (pending/in-progress/done/errored counts).
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeUrl, readSourceIndexStrict, type SourceIndex } from "./build-sources-index.ts";
import { writeFileAtomic } from "../shared/atomic-write.ts";
import { unwrapShareUrl } from "../sites/_shared/url-unwrap.ts";
import type { RawIndexEntry } from "../fetch-raw.ts";
import { loadIngestSkips, isInSkipList, type SkipEntry } from "../curation.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
// Wiki root: THIS_FILE is at `tools/bin/ingest_batch.ts`, so
// `dirname/../..` resolves to the wiki root. Earlier code only went
// up one level — that resolved to `tools/`, putting the state file
// and index lookup at the wrong location.
const REPO_ROOT = resolve(dirname(THIS_FILE), "..", "..");
const DEFAULT_STATE_PATH = join(REPO_ROOT, ".wiki-batch-state.json");
const DEFAULT_SOURCES_INDEX_PATH = join(REPO_ROOT, ".wiki-sources-index.json");
const DEFAULT_RAW_INDEX_PATH = join(REPO_ROOT, "raw", "raindrop", "_index.json");

export interface Paths {
  state: string;
  sourcesIndex: string;
  /**
   * Path to `raw/raindrop/_index.json`. Optional — when omitted (and
   * also not at the default path), `cmdPlan` skips the quality gate
   * and warns. Tests that don't care about quality_status leave this
   * undefined and use a temp dir without an index file.
   */
  rawIndex?: string;
  /**
   * Repo root for resolving `00_Meta/sources-ingest-skips.md`. Optional;
   * defaults to the wiki root computed from this file's location.
   */
  repoRoot?: string;
}

const defaultPaths: Paths = {
  state: DEFAULT_STATE_PATH,
  sourcesIndex: DEFAULT_SOURCES_INDEX_PATH,
  rawIndex: DEFAULT_RAW_INDEX_PATH,
  repoRoot: REPO_ROOT,
};

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export type BatchStatus = "pending" | "in-progress" | "done" | "errored";

export interface Candidate {
  id: string;          // opaque key (e.g. "raindrop:<bookmark_id>")
  url: string;         // the source URL (used for dedup against .wiki-sources-index.json)
  title?: string;      // optional friendly title
  extra?: Record<string, unknown>;  // free-form metadata (tags, highlight_count, etc.)
}

export interface BatchEntry extends Candidate {
  status: BatchStatus;
  added_at: string;    // ISO timestamp
  started_at?: string;
  completed_at?: string;
  slug?: string;       // filled on mark-done
  error?: string;
}

export interface BatchState {
  version: 1;
  entries: Record<string, BatchEntry>;  // keyed by id
}

// ---------------------------------------------------------------------------
// persistence
// ---------------------------------------------------------------------------

function loadState(path: string): BatchState {
  if (!existsSync(path)) return { version: 1, entries: {} };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<BatchState>;
    return { version: 1, entries: parsed.entries ?? {} };
  } catch (err) {
    throw new Error(`failed to parse batch state at ${path}: ${err}`);
  }
}

function saveState(path: string, state: BatchState): void {
  writeFileAtomic(path, JSON.stringify(state, null, 2) + "\n");
}

function loadSourcesIndex(path: string): SourceIndex {
  // Delegate to the strict reader: a corrupted index file is a stop-the-
  // world condition (would cause every ingest to think all URLs are new
  // and create duplicates). Propagate the IndexCorruptedError up.
  return readSourceIndexStrict(path);
}

/**
 * Build a `normalizeUrl(link) → RawIndexEntry` map from
 * `raw/raindrop/_index.json`. Lets `cmdPlan` look up the
 * `quality_status` of a candidate by its URL (the candidate's `id`
 * field is operator-supplied and not necessarily the slug).
 *
 * Returns null when `_index.json` is missing (rebuild was never run,
 * or this is a fresh checkout). cmdPlan fails open in that case —
 * skipping the quality gate rather than refusing to plan anything.
 */
function loadRawIndexLinkMap(path: string): Map<string, RawIndexEntry> | null {
  if (!existsSync(path)) return null;
  let parsed: { slugs?: Record<string, RawIndexEntry> };
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
  const out = new Map<string, RawIndexEntry>();
  for (const entry of Object.values(parsed.slugs ?? {})) {
    if (entry.link) out.set(normalizeUrl(entry.link), entry);
  }
  return out;
}

/**
 * Look up a candidate URL in the link map, with share-aggregator
 * unwrap fallback (P-32). The cache stores wrapper URLs but the slug
 * archives under the unwrapped target — when the candidate URL is a
 * wrapper, also try the unwrapped form.
 */
function lookupRawEntry(
  url: string,
  linkMap: Map<string, RawIndexEntry>,
): RawIndexEntry | undefined {
  const direct = linkMap.get(normalizeUrl(url));
  if (direct) return direct;
  const unwrap = unwrapShareUrl(url);
  if (unwrap) return linkMap.get(normalizeUrl(unwrap.unwrapped));
  return undefined;
}

// ---------------------------------------------------------------------------
// commands
// ---------------------------------------------------------------------------

export interface PlanResult {
  added: number;
  dedupedByUrl: number;
  dedupedById: number;
  skippedDone: number;
  /**
   * Candidates rejected because their raw slug's `quality_status !==
   * "good"` and `--allow-flagged` was not passed. Operators must fix
   * the raw extraction first (or override) before these can be ingested.
   */
  skippedFlagged: number;
  /**
   * Candidates rejected because their URL is in
   * `00_Meta/sources-ingest-skips.md`. Operator-permanent exclusion.
   */
  skippedBySkipList: number;
  totalPending: number;
}

export interface PlanOpts {
  /**
   * Bypass the quality gate. Default false: candidates whose raw slug
   * is `flagged` / `failed` are skipped with a warning. Set true when
   * deliberately ingesting from a known-imperfect raw slug (e.g. an
   * auth-walled stub the operator plans to hand-fill in Sources/).
   */
  allowFlagged?: boolean;
}

export function cmdPlan(
  candidatesJsonPath: string,
  paths: Paths = defaultPaths,
  opts: PlanOpts = {},
): PlanResult {
  const raw = readFileSync(candidatesJsonPath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`candidates file is not valid JSON: ${err}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`candidates file must be a JSON array of {id, url, title?}`);
  }
  const candidates = parsed as Candidate[];

  const state = loadState(paths.state);
  const sourcesIndex = loadSourcesIndex(paths.sourcesIndex);
  const existingUrls = new Set(Object.keys(sourcesIndex));
  const existingIds = new Set(Object.keys(state.entries));

  // Quality gate: load `raw/raindrop/_index.json` once. When the
  // index file is missing (fresh checkout / never rebuilt) or omitted
  // (test sandbox), fail open — skipping the gate is preferable to
  // refusing to plan anything. Warn only when the operator pointed
  // at an index path that we couldn't read despite it existing
  // (corruption / permission issue).
  const linkMap = paths.rawIndex ? loadRawIndexLinkMap(paths.rawIndex) : null;
  if (paths.rawIndex && existsSync(paths.rawIndex) && linkMap === null) {
    console.warn(
      `[plan] raw/raindrop/_index.json exists but failed to parse; quality gate skipped.`,
    );
  }

  const result: PlanResult = {
    added: 0, dedupedByUrl: 0, dedupedById: 0, skippedDone: 0, skippedFlagged: 0,
    skippedBySkipList: 0, totalPending: 0,
  };
  const now = new Date().toISOString();

  // Skip-list: load once. Operator-curated permanent-exclusion list.
  const skipEntries = paths.repoRoot ? loadIngestSkips(paths.repoRoot) : [];

  for (const c of candidates) {
    if (!c.id || !c.url) {
      console.warn(`[plan] skipping candidate with missing id or url: ${JSON.stringify(c)}`);
      continue;
    }
    const normUrl = normalizeUrl(c.url);
    if (existingUrls.has(normUrl)) {
      result.dedupedByUrl++;
      continue;
    }
    if (existingIds.has(c.id)) {
      const existing = state.entries[c.id];
      if (existing.status === "done") {
        result.skippedDone++;
        continue;
      }
      result.dedupedById++;
      continue;
    }
    // Skip-list gate: operator-permanent exclusion via 00_Meta/sources-ingest-skips.md.
    if (skipEntries.length > 0) {
      const matched = isInSkipList(c.url, skipEntries) ?? isInSkipList(c.id, skipEntries);
      if (matched) {
        console.warn(
          `[plan] skip ${c.id}: in sources-ingest-skips.md ` +
          `(reason=${matched.reason}${matched.rationale ? ` · ${matched.rationale}` : ""})`,
        );
        result.skippedBySkipList++;
        continue;
      }
    }
    // Quality gate: refuse non-good raw slugs unless --allow-flagged.
    // A missing entry (URL not in `_index.json`) means the slug hasn't
    // been fetched yet. Don't gate on that here — `ingest_batch` is
    // the wrong layer to require fetch; the LLM ingest loop tolerates
    // unfetched URLs (it treats them as fetch-on-demand). We only
    // gate on slugs we KNOW are sub-good.
    if (linkMap !== null && !opts.allowFlagged) {
      const rawEntry = lookupRawEntry(c.url, linkMap);
      if (rawEntry && rawEntry.quality_status && rawEntry.quality_status !== "good") {
        console.warn(
          `[plan] skip ${c.id}: quality_status=${rawEntry.quality_status} ` +
          `(slug=${rawEntry.slug}). Fix in raw/raindrop/${rawEntry.hostname}/${rawEntry.slug}/ ` +
          `first, or pass --allow-flagged.`,
        );
        result.skippedFlagged++;
        continue;
      }
    }
    state.entries[c.id] = { ...c, status: "pending", added_at: now };
    result.added++;
  }

  saveState(paths.state, state);
  result.totalPending = countByStatus(state, "pending");
  return result;
}

export function cmdNext(count: number, paths: Paths = defaultPaths): BatchEntry[] {
  const state = loadState(paths.state);
  return Object.values(state.entries)
    .filter((e) => e.status === "pending")
    .sort((a, b) => a.added_at.localeCompare(b.added_at))
    .slice(0, count);
}

export function cmdStart(id: string, paths: Paths = defaultPaths): void {
  const state = loadState(paths.state);
  const e = state.entries[id];
  if (!e) throw new Error(`no entry with id "${id}" in batch state`);
  if (e.status === "done") throw new Error(`entry "${id}" is already done`);
  e.status = "in-progress";
  e.started_at = new Date().toISOString();
  saveState(paths.state, state);
}

export function cmdMarkDone(id: string, slug?: string, paths: Paths = defaultPaths): void {
  const state = loadState(paths.state);
  const e = state.entries[id];
  if (!e) throw new Error(`no entry with id "${id}" in batch state`);
  e.status = "done";
  e.completed_at = new Date().toISOString();
  if (slug) e.slug = slug;
  saveState(paths.state, state);
}

export function cmdMarkErrored(id: string, message: string, paths: Paths = defaultPaths): void {
  const state = loadState(paths.state);
  const e = state.entries[id];
  if (!e) throw new Error(`no entry with id "${id}" in batch state`);
  e.status = "errored";
  e.error = message;
  e.completed_at = new Date().toISOString();
  saveState(paths.state, state);
}

export function cmdReset(id: string, paths: Paths = defaultPaths): void {
  const state = loadState(paths.state);
  const e = state.entries[id];
  if (!e) throw new Error(`no entry with id "${id}" in batch state`);
  e.status = "pending";
  delete e.started_at;
  delete e.completed_at;
  delete e.error;
  delete e.slug;
  saveState(paths.state, state);
}

export interface StatusCounts {
  pending: number;
  "in-progress": number;
  done: number;
  errored: number;
  total: number;
}

export function cmdStatus(paths: Paths = defaultPaths): { counts: StatusCounts; entries: BatchEntry[] } {
  const state = loadState(paths.state);
  const counts: StatusCounts = {
    pending: countByStatus(state, "pending"),
    "in-progress": countByStatus(state, "in-progress"),
    done: countByStatus(state, "done"),
    errored: countByStatus(state, "errored"),
    total: Object.keys(state.entries).length,
  };
  return { counts, entries: Object.values(state.entries) };
}

export function cmdPruneDone(paths: Paths = defaultPaths): number {
  const state = loadState(paths.state);
  const before = Object.keys(state.entries).length;
  for (const id of Object.keys(state.entries)) {
    if (state.entries[id].status === "done") delete state.entries[id];
  }
  const after = Object.keys(state.entries).length;
  saveState(paths.state, state);
  return before - after;
}

function countByStatus(state: BatchState, status: BatchStatus): number {
  let n = 0;
  for (const e of Object.values(state.entries)) if (e.status === status) n++;
  return n;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage(): never {
  console.error(`usage:
  tsx ingest_batch.ts plan <candidates.json> [--allow-flagged]
  tsx ingest_batch.ts next [--count N]
  tsx ingest_batch.ts start <id>
  tsx ingest_batch.ts mark-done <id> [--slug <slug>]
  tsx ingest_batch.ts mark-errored <id> <message>
  tsx ingest_batch.ts reset <id>
  tsx ingest_batch.ts status [--verbose]
  tsx ingest_batch.ts prune-done
  tsx ingest_batch.ts summary`);
  process.exit(2);
}

function main(): void {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "plan": {
      if (!rest[0]) usage();
      const allowFlagged = rest.includes("--allow-flagged");
      const r = cmdPlan(resolve(rest[0]), defaultPaths, { allowFlagged });
      console.log(
        `[plan] added ${r.added} (total pending: ${r.totalPending}); ` +
        `skipped ${r.dedupedByUrl} already-ingested, ${r.dedupedById} already-in-batch, ${r.skippedDone} already-done` +
        (r.skippedFlagged > 0
          ? `, ${r.skippedFlagged} flagged (use --allow-flagged to override)`
          : "") +
        (r.skippedBySkipList > 0
          ? `, ${r.skippedBySkipList} in skip-list`
          : ""),
      );
      break;
    }
    case "next": {
      const idx = rest.indexOf("--count");
      const count = idx >= 0 && rest[idx + 1] ? parseInt(rest[idx + 1], 10) : 1;
      const n = cmdNext(isFinite(count) && count > 0 ? count : 1);
      if (n.length === 0) console.log("none");
      else for (const e of n) {
        console.log(JSON.stringify({ id: e.id, url: e.url, title: e.title, extra: e.extra }));
      }
      break;
    }
    case "start": {
      if (!rest[0]) usage();
      cmdStart(rest[0]);
      console.log(`[start] ${rest[0]} → in-progress`);
      break;
    }
    case "mark-done": {
      if (!rest[0]) usage();
      const idx = rest.indexOf("--slug");
      const slug = idx >= 0 ? rest[idx + 1] : undefined;
      cmdMarkDone(rest[0], slug);
      console.log(`[done] ${rest[0]}${slug ? ` → slug=${slug}` : ""}`);
      break;
    }
    case "mark-errored": {
      if (!rest[0] || !rest[1]) usage();
      const msg = rest.slice(1).join(" ");
      cmdMarkErrored(rest[0], msg);
      console.log(`[errored] ${rest[0]} → ${msg.slice(0, 120)}`);
      break;
    }
    case "reset": {
      if (!rest[0]) usage();
      cmdReset(rest[0]);
      console.log(`[reset] ${rest[0]} → pending`);
      break;
    }
    case "status": {
      const { counts, entries } = cmdStatus();
      console.log(`batch state (${counts.total} total):`);
      console.log(`  pending:     ${counts.pending}`);
      console.log(`  in-progress: ${counts["in-progress"]}`);
      console.log(`  done:        ${counts.done}`);
      console.log(`  errored:     ${counts.errored}`);
      if (rest.includes("--verbose")) {
        const printList = (label: string, status: BatchStatus) => {
          const arr = entries.filter((e) => e.status === status);
          if (arr.length === 0) return;
          console.log(`\n${label}:`);
          for (const e of arr.slice(0, 20)) {
            const t = e.title ?? e.url;
            console.log(`  ${e.id.padEnd(30)} ${t.slice(0, 80)}`);
            if (e.error) console.log(`    error: ${e.error.slice(0, 120)}`);
          }
          if (arr.length > 20) console.log(`  ... +${arr.length - 20} more`);
        };
        printList("pending", "pending");
        printList("in-progress", "in-progress");
        printList("errored", "errored");
      }
      break;
    }
    case "prune-done": {
      const removed = cmdPruneDone();
      console.log(`[prune-done] removed ${removed} done entries`);
      break;
    }
    case "summary": {
      const { counts } = cmdStatus();
      console.log(`pending=${counts.pending} in-progress=${counts["in-progress"]} done=${counts.done} errored=${counts.errored}`);
      break;
    }
    default: usage();
  }
}

const isEntryPoint =
  process.argv[1] !== undefined && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main();
