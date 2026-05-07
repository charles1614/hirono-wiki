/**
 * Tests for `hirono raindrop history` and `diff` (Feature 3 CLIs).
 *
 * The CLIs themselves are thin wrappers around shared/revisions.ts;
 * we test the data path (loadHistory) here, plus the diff
 * structural-counts function indirectly via integration.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { appendRevision, readRevisions, type RevisionRow } from "../shared/revisions.ts";

function mkRow(rev: number, over: Partial<RevisionRow> = {}): RevisionRow {
  return {
    rev,
    fetched_at: `2026-04-${20 + rev}T00:00:00Z`,
    content_file: rev === 1 ? "content.md" : `content-rev${rev}.md`,
    content_sha: `sha${rev}`,
    content_length: 1000 * rev,
    quality_status: "good",
    quality_flags: [],
    failure_kind: "clean",
    image_count: 0,
    fetcher: "opencli",
    fetcher_reason: "direct",
    ...over,
  };
}

test("history: 3 revs are read in append order with stable rev numbers", () => {
  const dir = mkdtempSync(join(tmpdir(), "history-"));
  try {
    appendRevision(dir, mkRow(1));
    appendRevision(dir, mkRow(2));
    appendRevision(dir, mkRow(3));
    const rows = readRevisions(dir);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map(r => r.rev), [1, 2, 3]);
    assert.equal(rows[2].content_file, "content-rev3.md");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("history: regression detection — rev1 good, rev2 stub", () => {
  // Replicates the resolveRev + summary logic by inspecting raw row state.
  // The diff CLI's renderSummary surfaces this as "REGRESSION".
  const dir = mkdtempSync(join(tmpdir(), "history-regress-"));
  try {
    appendRevision(dir, mkRow(1, { quality_status: "good", failure_kind: "clean" }));
    appendRevision(dir, mkRow(2, {
      quality_status: "flagged",
      failure_kind: "upstream-deleted",
      quality_flags: ["intentional-stub", "reddit-deleted"],
    }));
    const rows = readRevisions(dir);
    const isRegression = rows[0].quality_status === "good" && rows[1].quality_status !== "good";
    assert.equal(isRegression, true);
    assert.equal(rows[1].failure_kind, "upstream-deleted");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("history: date-form rev resolution selects rev with fetched_at <= cutoff", () => {
  // Replicates the resolveRev logic in diff.ts directly.
  function resolveByDate(rows: RevisionRow[], dateStr: string): RevisionRow {
    const cutoff = Date.parse(dateStr.length === 10 ? `${dateStr}T23:59:59Z` : dateStr);
    const candidates = rows.filter(r => Date.parse(r.fetched_at) <= cutoff);
    if (candidates.length === 0) throw new Error("none");
    return candidates[candidates.length - 1];
  }

  const rows: RevisionRow[] = [
    mkRow(1, { fetched_at: "2026-04-21T00:00:00Z" }),
    mkRow(2, { fetched_at: "2026-04-22T00:00:00Z" }),
    mkRow(3, { fetched_at: "2026-04-23T00:00:00Z" }),
  ];
  assert.equal(resolveByDate(rows, "2026-04-22").rev, 2);
  assert.equal(resolveByDate(rows, "2026-04-21").rev, 1);
  assert.equal(resolveByDate(rows, "2026-04-30").rev, 3);
  assert.throws(() => resolveByDate(rows, "2026-04-01"), /none/);
});
