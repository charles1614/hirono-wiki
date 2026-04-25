/**
 * Per-host snapshot regression suite.
 *
 * Walks `tools/__tests__/snapshots/<host>/<slug>.md` + the paired
 * `<slug>.invariants.json` sidecar. For each pair, asserts:
 *
 *   - The snapshot file's CURRENT state still matches its sidecar (catches
 *     accidental edits to the snapshot itself).
 *   - The structural invariants (feature counts, denylist, frontmatter)
 *     defined in `snapshot-helpers.ts` pass for the snapshot content.
 *
 * NOT asserted at test time: a fresh re-fetch of the source URL. That
 * requires opencli + browser + auth and can't run in CI. The snapshot itself
 * is the locked-in expectation; when we re-fetch (manually, during host work),
 * `tools/sweep-issues.ts` and the regression-triage workflow are the gate.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { countFeatures, loadInvariants, diffInvariants, invariantsPathFor } from "./snapshot-helpers.ts";

const SNAPSHOTS_DIR = "tools/__tests__/snapshots";

function listSnapshotPairs(): Array<{ host: string; slug: string; mdPath: string }> {
  if (!existsSync(SNAPSHOTS_DIR)) return [];
  const out: Array<{ host: string; slug: string; mdPath: string }> = [];
  for (const host of readdirSync(SNAPSHOTS_DIR)) {
    const hostDir = join(SNAPSHOTS_DIR, host);
    let st;
    try { st = statSync(hostDir); } catch { continue; }
    if (!st.isDirectory()) continue;
    for (const f of readdirSync(hostDir)) {
      if (!f.endsWith(".md")) continue;
      const mdPath = join(hostDir, f);
      const invPath = invariantsPathFor(mdPath);
      if (!existsSync(invPath)) {
        // Surface as a failing test below
        out.push({ host, slug: f.replace(/\.md$/, ""), mdPath });
        continue;
      }
      out.push({ host, slug: f.replace(/\.md$/, ""), mdPath });
    }
  }
  return out;
}

const pairs = listSnapshotPairs();

if (pairs.length === 0) {
  test("per-host snapshot suite: scaffolding ready, no snapshots committed yet", () => {
    // No-op assertion so the test runner has at least one passing case
    // until per-host snapshots start landing.
    assert.ok(true);
  });
}

for (const { host, slug, mdPath } of pairs) {
  test(`snapshot[${host}/${slug}]: sidecar present`, () => {
    const invPath = invariantsPathFor(mdPath);
    assert.ok(
      existsSync(invPath),
      `missing invariants sidecar at ${invPath}. Generate with:\n  npx tsx tools/__tests__/snapshot-helpers.ts capture ${mdPath}`,
    );
  });

  // Skip the deeper checks below if the sidecar is missing — the test above
  // already failed clearly.
  const invPath = invariantsPathFor(mdPath);
  if (!existsSync(invPath)) continue;

  test(`snapshot[${host}/${slug}]: matches its sidecar`, () => {
    const md = readFileSync(mdPath, "utf8");
    const computed = countFeatures(md);
    const expected = loadInvariants(mdPath);
    const fails = diffInvariants(computed, expected, `${host}/${slug}`);
    assert.equal(fails.length, 0, fails.join("\n"));
  });

  test(`snapshot[${host}/${slug}]: passes hard-rule invariants`, () => {
    const md = readFileSync(mdPath, "utf8");
    const c = countFeatures(md);
    assert.equal(c.h1, 1, `${host}/${slug}: expected exactly 1 H1, got ${c.h1}`);
    assert.equal(c.frontmatter_present, true, `${host}/${slug}: missing '> 原文链接:' in first 10 lines`);
    assert.equal(c.remote_images, 0, `${host}/${slug}: ${c.remote_images} remote-image refs (must be 0; per CLAUDE.md §3)`);
    assert.equal(c.chrome_denylist_matches, 0, `${host}/${slug}: ${c.chrome_denylist_matches} bare chrome lines from denylist`);
    assert.equal(c.unbalanced_bold_runs, 0, `${host}/${slug}: ${c.unbalanced_bold_runs} line(s) with 3+ consecutive asterisks (signals unbalanced bold from nested-emphasis HTML; see CLAUDE.md §4 "WeChat / mdnice malformed bold")`);
    assert.equal(c.empty_headings, 0, `${host}/${slug}: ${c.empty_headings} empty heading line(s) like '## ' (H1-demotion artifact)`);
    assert.equal(c.splicer_appendix_markers, 0, `${host}/${slug}: ${c.splicer_appendix_markers} '附录（位置未识别）' marker(s) (legacy splicer fallback — content placement failed)`);
  });

  test(`snapshot[${host}/${slug}]: every image ref resolves to a real file`, () => {
    const md = readFileSync(mdPath, "utf8");
    const snapDir = join(SNAPSHOTS_DIR, host);
    const dangling: string[] = [];
    for (const m of md.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
      const ref = m[1];
      if (/^https?:\/\//i.test(ref)) continue;
      const abs = join(snapDir, ref);
      if (!existsSync(abs)) dangling.push(ref);
    }
    assert.equal(
      dangling.length, 0,
      `${host}/${slug}: ${dangling.length} dangling image refs (file not found on disk):\n  ${dangling.slice(0, 5).join("\n  ")}\nRe-snapshot with:\n  npx tsx tools/__tests__/snapshot-create.ts <url> --slug ${slug}`,
    );
  });
}
