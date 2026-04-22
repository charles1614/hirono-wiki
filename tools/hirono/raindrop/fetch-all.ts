/**
 * `hirono raindrop fetch-all` — bulk fetch one copy of every unique URL in
 * the Raindrop cache into raw/<slug>/. Resumable, safe to re-run.
 *
 * Workflow:
 *   1. Load cache; dedupe by normalized URL (keep the earliest-created
 *      bookmark as the canonical entry for each URL — predictable slugs
 *      across re-runs).
 *   2. Derive a slug for each unique URL from title + created date.
 *   3. For each plan item, check raw/<slug>/ state:
 *        - exists + quality_status=good → skip (already done)
 *        - exists + flagged AND --retry-flagged is set → refetch
 *        - exists + flagged AND --retry-flagged NOT set → skip (preserved)
 *        - missing → fetch
 *   4. L1 errors retry internally (handled by fetch-raw). L2 errors log +
 *      continue. L3 errors halt unless --continue-on-l3.
 *   5. Progress to stderr per item + NDJSON log to raw/.fetch-all.log.
 *
 * Usage:
 *   hirono raindrop fetch-all [--limit N] [--skip N] [--only-host <h>]
 *                              [--retry-flagged] [--dry-run]
 *                              [--continue-on-l3]
 */

import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchUrlAndStore, rawDirFor, listRawSlugs } from "../../fetch-raw.ts";
import { normalizeUrl } from "../../build-sources-index.ts";
import { applyPostProcessors } from "../shared/post-process.ts";
import type { Cache, CachedBookmark } from "./check.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..", "..", "..");
const DEFAULT_CACHE = join(REPO_ROOT, ".wiki-raindrop-cache.json");
const RAW_ROOT = join(REPO_ROOT, "raw");
const FETCH_ALL_LOG = join(RAW_ROOT, ".fetch-all.log");

// ---------------------------------------------------------------------------
// slug derivation (deterministic; same URL → same slug across re-runs)
// ---------------------------------------------------------------------------

/**
 * Slugify a bookmark title for use in a filename. Keeps Chinese characters
 * (to preserve information), strips everything else to kebab-case ASCII.
 */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    // Replace any non-allowed char (punctuation, emoji, etc.) with a space
    // so adjacent tokens stay separated. Allowed: alphanumerics, underscore,
    // hyphen, whitespace, Chinese. Everything else → space.
    .replace(/[^\w\s\-\u4e00-\u9fff]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Derive a raw/ slug from a bookmark. Format:
 *   YYYY-MM-DD-<kebab-title-or-id>
 *
 * Date comes from the bookmark's `created` field (falls back to today).
 * If title is empty, slug falls back to the bookmark ID.
 */
export function deriveSlug(b: CachedBookmark): string {
  // Date prefix — use created date, truncate to YYYY-MM-DD
  let datePart = "";
  if (b.created) {
    try {
      const d = new Date(b.created);
      if (!isNaN(d.getTime())) {
        datePart = d.toISOString().slice(0, 10);
      }
    } catch {}
  }
  if (!datePart) datePart = new Date().toISOString().slice(0, 10);

  const titleSlug = slugifyTitle(b.title);
  const bodyPart = titleSlug || `raindrop-${b.bookmark_id}`;
  return `${datePart}-${bodyPart}`;
}

// ---------------------------------------------------------------------------
// plan + execution
// ---------------------------------------------------------------------------

export interface PlanItem {
  bookmark_id: number;
  url: string;
  normalized_url: string;
  slug: string;
  title: string;
  host: string;
  action: "fetch" | "skip-good" | "skip-flagged" | "skip-already-planned";
  reason: string;
}

export interface FetchAllOpts {
  limit?: number;
  skip?: number;
  onlyHost?: string;
  retryFlagged?: boolean;
  continueOnL3?: boolean;
  dryRun?: boolean;
  cachePath?: string;
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

/**
 * Build the plan: for each unique URL, decide fetch / skip-good / skip-flagged.
 * Deterministic — same cache + same raw/ state → same plan.
 */
export function buildPlan(cache: Cache, opts: FetchAllOpts = {}): PlanItem[] {
  // Step 1: dedupe by normalized URL, keeping the bookmark with the smallest
  // bookmark_id (most stable across cache refreshes; user sees consistent slugs).
  const byUrl = new Map<string, CachedBookmark>();
  for (const b of cache.bookmarks) {
    if (!b.link) continue;
    const norm = normalizeUrl(b.link);
    const existing = byUrl.get(norm);
    if (!existing || b.bookmark_id < existing.bookmark_id) {
      byUrl.set(norm, b);
    }
  }

  // Step 2: build plan items with slug + raw-state check
  const rawByeSlug = new Map<string, { quality_status: string }>();
  for (const info of listRawSlugs(RAW_ROOT)) {
    rawByeSlug.set(info.slug, { quality_status: info.quality_status });
  }

  // Detect slug collisions across planned items (if two different URLs produce
  // the same slug after slugification). Disambiguate with bookmark_id suffix.
  const plannedSlugs = new Set<string>();
  const plan: PlanItem[] = [];

  for (const [normUrl, b] of byUrl) {
    const host = hostOf(b.link);
    if (opts.onlyHost && host !== opts.onlyHost.replace(/^www\./, "").toLowerCase()) {
      continue;
    }

    let slug = deriveSlug(b);
    // Disambiguate collisions by appending bookmark_id suffix
    if (plannedSlugs.has(slug)) {
      slug = `${slug}-${b.bookmark_id}`;
    }
    plannedSlugs.add(slug);

    const rawState = rawByeSlug.get(slug);
    let action: PlanItem["action"];
    let reason: string;

    if (!rawState) {
      action = "fetch";
      reason = "never fetched";
    } else if (rawState.quality_status === "good") {
      action = "skip-good";
      reason = "already good";
    } else if (opts.retryFlagged) {
      action = "fetch";
      reason = `${rawState.quality_status} + --retry-flagged`;
    } else {
      action = "skip-flagged";
      reason = `${rawState.quality_status} (pass --retry-flagged to refetch)`;
    }

    plan.push({
      bookmark_id: b.bookmark_id,
      url: b.link,
      normalized_url: normUrl,
      slug,
      title: b.title,
      host,
      action,
      reason,
    });
  }

  // Step 3: sort (newest first, for user-perceivable freshness) + apply skip/limit
  plan.sort((a, b) => b.bookmark_id - a.bookmark_id);

  let sliced = plan;
  if (typeof opts.skip === "number" && opts.skip > 0) sliced = sliced.slice(opts.skip);
  if (typeof opts.limit === "number" && opts.limit >= 0) {
    // --limit applies to fetch count, not total items scanned
    let fetched = 0;
    const out: PlanItem[] = [];
    for (const item of sliced) {
      if (item.action !== "fetch") { out.push(item); continue; }
      if (fetched >= opts.limit) {
        out.push({ ...item, action: "skip-already-planned", reason: `over --limit ${opts.limit}` });
      } else {
        out.push(item);
        fetched++;
      }
    }
    sliced = out;
  }
  return sliced;
}

/** Write one line to raw/.fetch-all.log (NDJSON; per-item progress audit trail). */
function log(item: PlanItem, outcome: string, details: Record<string, unknown> = {}): void {
  const entry = {
    ts: new Date().toISOString(),
    slug: item.slug,
    bookmark_id: item.bookmark_id,
    host: item.host,
    outcome,
    ...details,
  };
  try { appendFileSync(FETCH_ALL_LOG, JSON.stringify(entry) + "\n", "utf8"); } catch {}
}

export interface FetchAllResult {
  plan: PlanItem[];
  summary: {
    total: number;
    would_fetch: number;
    fetched_ok: number;
    fetched_flagged: number;
    fetched_failed: number;
    skipped_good: number;
    skipped_flagged: number;
  };
}

export async function runFetchAll(opts: FetchAllOpts = {}): Promise<FetchAllResult> {
  const cachePath = opts.cachePath ?? DEFAULT_CACHE;
  if (!existsSync(cachePath)) {
    throw new Error(
      `Raindrop cache not found at ${cachePath}. ` +
      `Run \`hirono raindrop refresh-cache\` first.`,
    );
  }
  const cache = JSON.parse(readFileSync(cachePath, "utf8")) as Cache;

  const plan = buildPlan(cache, opts);
  const summary = {
    total: plan.length,
    would_fetch: plan.filter((p) => p.action === "fetch").length,
    fetched_ok: 0,
    fetched_flagged: 0,
    fetched_failed: 0,
    skipped_good: plan.filter((p) => p.action === "skip-good").length,
    skipped_flagged: plan.filter((p) => p.action === "skip-flagged").length,
  };

  process.stderr.write(`[fetch-all] plan: ${summary.total} items (${summary.would_fetch} to fetch, ${summary.skipped_good} already-good, ${summary.skipped_flagged} flagged-preserved)\n`);

  if (opts.dryRun) {
    for (const item of plan) {
      process.stdout.write(`${item.action.padEnd(20)} ${item.slug}  (${item.reason})\n`);
    }
    return { plan, summary };
  }

  const fetches = plan.filter((p) => p.action === "fetch");
  let idx = 0;
  const startTs = Date.now();
  for (const item of fetches) {
    idx++;
    const elapsed = Math.round((Date.now() - startTs) / 1000);
    const eta = idx > 1 ? Math.round((elapsed / (idx - 1)) * (fetches.length - idx)) : 0;
    process.stderr.write(`\n[${idx}/${fetches.length}] (${elapsed}s elapsed${eta > 0 ? `, ~${eta}s remaining` : ""}) ${item.slug}\n`);
    process.stderr.write(`    ${item.url}\n`);
    try {
      const src = fetchUrlAndStore({
        slug: item.slug,
        url: item.url,
        viaBrowser: false,
        downloadImages: true,
        force: false,  // append-only; don't clobber good content on retry
        titleHint: item.title,
        transformMarkdown: (md, originUrl) => {
          const r = applyPostProcessors(md, originUrl);
          return {
            md: r.md,
            extraNotes: [
              ...(r.appliedNames.length > 0 ? [`hirono post-processors: ${r.appliedNames.join(", ")}`] : []),
              ...r.notes,
            ],
            extraImageUrls: r.newAbsoluteImageUrls,
          };
        },
      });
      const flags = src.quality_flags.length > 0 ? src.quality_flags.join(",") : "none";
      process.stderr.write(`    ✓ ${src.quality_status} (${src.content_length} chars, ${src.images.length} imgs, flags=${flags})\n`);
      if (src.quality_status === "good") summary.fetched_ok++;
      else if (src.quality_status === "flagged") summary.fetched_flagged++;
      else summary.fetched_failed++;
      log(item, src.quality_status, {
        content_length: src.content_length,
        images: src.images.length,
        quality_flags: src.quality_flags,
      });
    } catch (err) {
      const e = err as Error & { level?: string; code?: string; remediation?: string };
      if (e.level === "L3" && !opts.continueOnL3) {
        process.stderr.write(`    ✗ L3 ${e.code}: ${e.message}\n`);
        if (e.remediation) process.stderr.write(`      remediation: ${e.remediation}\n`);
        log(item, "errored", { level: e.level, code: e.code, message: e.message });
        throw new Error(`L3 halt: ${e.code}; fix + resume with \`hirono raindrop fetch-all\``);
      }
      summary.fetched_failed++;
      process.stderr.write(`    ✗ ${e.level ?? "ERROR"} ${e.code ?? ""}: ${e.message}\n`);
      log(item, "errored", { level: e.level, code: e.code, message: e.message });
    }
  }

  const totalElapsed = Math.round((Date.now() - startTs) / 1000);
  process.stderr.write(
    `\n[fetch-all] done in ${totalElapsed}s — ` +
    `${summary.fetched_ok} good, ${summary.fetched_flagged} flagged, ${summary.fetched_failed} failed, ` +
    `${summary.skipped_good + summary.skipped_flagged} skipped\n`,
  );
  process.stderr.write(`[fetch-all] per-item log: ${FETCH_ALL_LOG}\n`);
  return { plan, summary };
}

export async function main(argv: string[]): Promise<void> {
  const limitIdx = argv.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(argv[limitIdx + 1], 10) : undefined;
  const skipIdx = argv.indexOf("--skip");
  const skip = skipIdx >= 0 ? parseInt(argv[skipIdx + 1], 10) : undefined;
  const onlyHostIdx = argv.indexOf("--only-host");
  const onlyHost = onlyHostIdx >= 0 ? argv[onlyHostIdx + 1] : undefined;
  const retryFlagged = argv.includes("--retry-flagged");
  const continueOnL3 = argv.includes("--continue-on-l3");
  const dryRun = argv.includes("--dry-run");

  try {
    const r = await runFetchAll({
      limit: typeof limit === "number" && !isNaN(limit) ? limit : undefined,
      skip: typeof skip === "number" && !isNaN(skip) ? skip : undefined,
      onlyHost,
      retryFlagged,
      continueOnL3,
      dryRun,
    });
    // On dry-run the plan is printed; on real run stderr has the status.
    // Exit 0 unless everything failed.
    if (!dryRun && r.summary.would_fetch > 0 && r.summary.fetched_ok === 0 && r.summary.fetched_failed > 0) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error(`[fetch-all] ${(err as Error).message}`);
    process.exit(1);
  }
}
