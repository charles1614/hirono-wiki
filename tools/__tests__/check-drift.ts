#!/usr/bin/env tsx
/**
 * Live-fetch upstream-drift detector — operator-run, NOT in CI.
 *
 * For every snapshot under `__tests__/snapshots/<host>/<slug>.md` that
 * has a `source_url` field in its sidecar, this command:
 *
 *   1. Routes the URL through the site-module registry.
 *   2. Re-runs the capture (fetch + convert).
 *   3. Diffs the new output against the saved snapshot.
 *   4. Categorizes per snapshot: unchanged / trivial-diff / significant-diff.
 *
 * Usage:
 *   npx tsx tools/__tests__/check-drift.ts                 # all snapshots
 *   npx tsx tools/__tests__/check-drift.ts --host linux.do # filter by host
 *   npx tsx tools/__tests__/check-drift.ts --diff-only     # exit non-zero on any significant diff
 *   npx tsx tools/__tests__/check-drift.ts --site substack # filter by site-module name
 *
 * NOT run in CI — requires network access, opencli, and live page state.
 *
 * When drift is found: investigate. If the upstream change is real and
 * the new output is correct, refresh the snapshot:
 *   npx tsx tools/__tests__/approve.ts --site <site> --name <name> --url <url> --slug <slug>
 *
 * If a snapshot has no `source_url` (pre-drift-check capture), backfill:
 *   npx tsx tools/__tests__/snapshot-helpers.ts backfill-source-url <md-path> <url>
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { TEST_HOOKS, findHooksByName } from "../sites/test-hooks-registry.ts";
import type { SiteTestHooks } from "../sites/_shared/test-hooks-types.ts";
import { loadInvariants, invariantsPathFor } from "./snapshot-helpers.ts";

const SNAPSHOTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "snapshots");

interface SnapshotEntry {
  host: string;
  slug: string;
  mdPath: string;
  sourceUrl: string;
}

/**
 * Walk the snapshots directory, yielding every snapshot that has a
 * `source_url` set in its sidecar. Snapshots without source_url are
 * skipped with a warning.
 */
function listSnapshotsWithSourceUrl(): { entries: SnapshotEntry[]; skipped: string[] } {
  const entries: SnapshotEntry[] = [];
  const skipped: string[] = [];
  if (!existsSync(SNAPSHOTS_DIR)) return { entries, skipped };
  for (const host of readdirSync(SNAPSHOTS_DIR)) {
    const hostDir = join(SNAPSHOTS_DIR, host);
    let st;
    try { st = statSync(hostDir); } catch { continue; }
    if (!st.isDirectory()) continue;
    for (const f of readdirSync(hostDir)) {
      if (!f.endsWith(".md")) continue;
      const mdPath = join(hostDir, f);
      const slug = f.replace(/\.md$/, "");
      try {
        const inv = loadInvariants(mdPath);
        if (!inv.source_url) {
          skipped.push(`${host}/${slug} (no source_url in sidecar)`);
          continue;
        }
        entries.push({ host, slug, mdPath, sourceUrl: inv.source_url });
      } catch {
        skipped.push(`${host}/${slug} (failed to load sidecar)`);
      }
    }
  }
  return { entries, skipped };
}

/**
 * Find the site-module hooks that own a given URL by host match. Falls
 * back to checking each site's snapshotHosts list for the URL's hostname.
 */
function findHooksForUrl(url: string): SiteTestHooks | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (/\.feishu\.cn$/i.test(host)) host = "feishu.cn";
  } catch {
    return null;
  }
  for (const h of TEST_HOOKS) {
    if (h.snapshotHosts.includes(host)) return h;
  }
  return null;
}

/**
 * Categorize the diff between two markdown strings.
 *   - unchanged: byte-identical
 *   - trivial-diff: only whitespace changes, or differences ≤0.5%
 *   - significant-diff: structural changes
 */
function categorizeDiff(saved: string, fresh: string): {
  category: "unchanged" | "trivial-diff" | "significant-diff";
  bytesDelta: number;
  firstDivergence?: { offset: number; line: number; ctxSaved: string; ctxFresh: string };
} {
  if (saved === fresh) return { category: "unchanged", bytesDelta: 0 };

  // Whitespace-normalized comparison: same when only whitespace differs.
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  if (norm(saved) === norm(fresh)) {
    return { category: "trivial-diff", bytesDelta: fresh.length - saved.length };
  }

  // Compute first divergence
  let i = 0;
  while (i < Math.min(saved.length, fresh.length) && saved[i] === fresh[i]) i++;
  const before = saved.slice(0, i);
  const lineNo = (before.match(/\n/g) || []).length + 1;
  const ctxSaved = saved.slice(Math.max(0, i - 60), i + 60);
  const ctxFresh = fresh.slice(Math.max(0, i - 60), i + 60);
  const bytesDelta = fresh.length - saved.length;
  const pctChange = Math.abs(bytesDelta) / Math.max(1, saved.length);

  // Trivial = ≤0.5% byte delta + same line count
  const savedLines = saved.split("\n").length;
  const freshLines = fresh.split("\n").length;
  if (pctChange < 0.005 && savedLines === freshLines) {
    return {
      category: "trivial-diff",
      bytesDelta,
      firstDivergence: { offset: i, line: lineNo, ctxSaved, ctxFresh },
    };
  }
  return {
    category: "significant-diff",
    bytesDelta,
    firstDivergence: { offset: i, line: lineNo, ctxSaved, ctxFresh },
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag);
    if (i < 0 || i === argv.length - 1) return null;
    return argv[i + 1];
  };
  const has = (flag: string): boolean => argv.includes(flag);

  const filterHost = get("--host");
  const filterSite = get("--site");
  const diffOnly = has("--diff-only");

  console.log(`[1/3] enumerate snapshots`);
  const { entries, skipped } = listSnapshotsWithSourceUrl();
  if (skipped.length > 0) {
    console.warn(`     ${skipped.length} snapshot(s) skipped (no source_url):`);
    for (const s of skipped.slice(0, 8)) console.warn(`       - ${s}`);
    if (skipped.length > 8) console.warn(`       ... and ${skipped.length - 8} more`);
    console.warn(`     backfill via: npx tsx tools/__tests__/snapshot-helpers.ts backfill-source-url <md> <url>`);
  }

  let filtered = entries;
  if (filterHost) filtered = filtered.filter((e) => e.host === filterHost);
  if (filterSite) {
    const hooks = findHooksByName(filterSite);
    if (!hooks) {
      console.error(`unknown --site: ${filterSite}`);
      process.exit(2);
    }
    filtered = filtered.filter((e) => hooks.snapshotHosts.includes(e.host));
  }
  console.log(`     ${filtered.length} snapshot(s) to check (filtered from ${entries.length})`);
  if (filtered.length === 0) return;

  console.log(`[2/3] re-fetch + diff each snapshot`);
  const results: Array<{ entry: SnapshotEntry; status: string; detail: string }> = [];
  for (const e of filtered) {
    const hooks = findHooksForUrl(e.sourceUrl);
    if (!hooks) {
      results.push({ entry: e, status: "no-route", detail: "no site-module owns this URL" });
      continue;
    }
    try {
      const captured = hooks.capture(e.sourceUrl);
      const saved = readFileSync(e.mdPath, "utf8");
      // Strip §2 frontmatter ONLY when it's at the very top of the
      // document (the saved snapshot has it; the fresh-from-converter
      // body does not). Many converters use `---` as in-body card
      // separators — we must not mistake those for the frontmatter
      // boundary. Limit the search to the first ~10 lines + require
      // it follow a `> 原文链接:` line.
      const stripFrontmatter = (s: string): string => {
        const head = s.split("\n").slice(0, 12).join("\n");
        if (!/^> 原文链接:/m.test(head)) return s;
        const sepIdx = s.indexOf("\n---\n");
        if (sepIdx < 0) return s;
        // Only strip if the separator is within the head region (i.e. it's
        // the §2 frontmatter terminator, not a body-level separator).
        if (sepIdx > head.length + 4) return s;
        return s.slice(sepIdx + 5);
      };
      // Strip image refs on both sides — saved snapshots have rewritten
      // local refs (`<slug>-images/foo.jpg`), live captures have raw
      // localFilenames or remote URLs that differ structurally.
      const stripImageRefs = (s: string) => s.replace(/!\[[^\]]*\]\([^)]+\)/g, "![](IMG)");
      const savedBody = stripImageRefs(stripFrontmatter(saved));
      const freshBody = stripImageRefs(stripFrontmatter(captured.markdown));
      const { category, bytesDelta, firstDivergence } = categorizeDiff(savedBody, freshBody);
      let detail = `Δ ${bytesDelta >= 0 ? "+" : ""}${bytesDelta} bytes`;
      if (firstDivergence) {
        detail += `, first @ line ${firstDivergence.line}`;
        if (category === "significant-diff") {
          detail += `\n      saved:  ${JSON.stringify(firstDivergence.ctxSaved.slice(0, 100))}` +
                    `\n      fresh:  ${JSON.stringify(firstDivergence.ctxFresh.slice(0, 100))}`;
        }
      }
      results.push({ entry: e, status: category, detail });
    } catch (err) {
      results.push({
        entry: e,
        status: "fetch-failed",
        detail: err instanceof Error ? err.message.slice(0, 120) : String(err),
      });
    }
  }

  console.log(`[3/3] summary`);
  const buckets: Record<string, number> = {};
  for (const r of results) buckets[r.status] = (buckets[r.status] || 0) + 1;
  for (const [status, count] of Object.entries(buckets)) {
    console.log(`     ${status}: ${count}`);
  }
  console.log("");
  for (const r of results) {
    const icon = r.status === "unchanged" ? "✓"
      : r.status === "trivial-diff" ? "~"
      : r.status === "significant-diff" ? "✗"
      : r.status === "fetch-failed" ? "!"
      : "?";
    console.log(`  ${icon} [${r.status}] ${r.entry.host}/${r.entry.slug} — ${r.detail}`);
  }

  if (diffOnly) {
    const sigDiffs = (buckets["significant-diff"] || 0) + (buckets["fetch-failed"] || 0);
    if (sigDiffs > 0) {
      console.log("");
      console.log(`--diff-only: ${sigDiffs} significant diff(s) or fetch failure(s) — exiting non-zero`);
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(`check-drift.ts failed: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
