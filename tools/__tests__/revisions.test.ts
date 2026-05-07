/**
 * Tests for the per-slug revision log (tools/shared/revisions.ts).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, appendFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  appendRevision,
  readRevisions,
  rowFromSource,
  backfillFromSource,
  nextRev,
  repairRevisions,
  revisionsPath,
  type RevisionRow,
} from "../shared/revisions.ts";
import type { SourceJson } from "../fetch-raw.ts";

function mkSlugDir(): string {
  return mkdtempSync(join(tmpdir(), "revs-test-"));
}

function mkSource(over: Partial<SourceJson> = {}): SourceJson {
  return {
    fetched_at: "2026-04-21T00:00:00Z",
    origin: "url:https://example.com/post",
    origin_url: "https://example.com/post",
    fetcher: "opencli",
    fetcher_reason: "direct",
    content_sha: "abc",
    content_length: 1000,
    quality_flags: [],
    quality_status: "good",
    images: [],
    notes: [],
    ...over,
  };
}

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

test("appendRevision + readRevisions: round-trip 3 rows", () => {
  const dir = mkSlugDir();
  try {
    appendRevision(dir, mkRow(1));
    appendRevision(dir, mkRow(2));
    appendRevision(dir, mkRow(3));
    const rows = readRevisions(dir);
    assert.equal(rows.length, 3);
    assert.equal(rows[0].rev, 1);
    assert.equal(rows[1].rev, 2);
    assert.equal(rows[2].rev, 3);
    assert.equal(rows[1].content_file, "content-rev2.md");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readRevisions: empty file → []", () => {
  const dir = mkSlugDir();
  try {
    writeFileSync(revisionsPath(dir), "");
    assert.deepEqual(readRevisions(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readRevisions: missing file → []", () => {
  const dir = mkSlugDir();
  try {
    assert.deepEqual(readRevisions(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readRevisions: tolerates partial last line (interrupted write)", () => {
  const dir = mkSlugDir();
  try {
    appendRevision(dir, mkRow(1));
    appendRevision(dir, mkRow(2));
    // Append a partial line as if a write was interrupted
    appendFileSync(revisionsPath(dir), `{"rev":3,"fetched_at":"2026-04-2`);
    const rows = readRevisions(dir);
    assert.equal(rows.length, 2, "should keep the 2 valid rows");
    assert.equal(rows[1].rev, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("nextRev: empty → 1, populated → max+1", () => {
  const dir = mkSlugDir();
  try {
    assert.equal(nextRev(dir), 1);
    appendRevision(dir, mkRow(1));
    assert.equal(nextRev(dir), 2);
    appendRevision(dir, mkRow(2));
    appendRevision(dir, mkRow(5));  // out-of-order rev (defensive)
    assert.equal(nextRev(dir), 6);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rowFromSource: extracts fields correctly", () => {
  const src = mkSource({
    quality_status: "flagged",
    quality_flags: ["short-body"],
    images: [{ local: "a.png", remote: "https://x/a.png", bytes: 100 }],
  });
  const row = rowFromSource(src, "content.md", "content-too-short");
  assert.equal(row.rev, 1);
  assert.equal(row.fetched_at, src.fetched_at);
  assert.equal(row.content_file, "content.md");
  assert.equal(row.quality_status, "flagged");
  assert.deepEqual(row.quality_flags, ["short-body"]);
  assert.equal(row.failure_kind, "content-too-short");
  assert.equal(row.image_count, 1);
});

test("backfillFromSource: synthesizes rev1 from source.json when revisions.jsonl missing", () => {
  const dir = mkSlugDir();
  try {
    writeFileSync(join(dir, "source.json"), JSON.stringify(mkSource(), null, 2));
    const row = backfillFromSource(dir);
    assert.ok(row);
    assert.equal(row!.rev, 1);
    const rows = readRevisions(dir);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].rev, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("backfillFromSource: idempotent — second call no-ops if file already exists", () => {
  const dir = mkSlugDir();
  try {
    writeFileSync(join(dir, "source.json"), JSON.stringify(mkSource(), null, 2));
    const r1 = backfillFromSource(dir);
    const r2 = backfillFromSource(dir);
    assert.ok(r1);
    assert.equal(r2, null);
    assert.equal(readRevisions(dir).length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("backfillFromSource: returns null when source.json absent", () => {
  const dir = mkSlugDir();
  try {
    assert.equal(backfillFromSource(dir), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("repairRevisions: drops corrupt lines, keeps valid prefix", () => {
  const dir = mkSlugDir();
  try {
    appendRevision(dir, mkRow(1));
    appendRevision(dir, mkRow(2));
    appendFileSync(revisionsPath(dir), `not valid json at all\n`);
    appendRevision(dir, mkRow(3));
    appendFileSync(revisionsPath(dir), `{"partial`);
    const result = repairRevisions(dir);
    assert.equal(result.dropped, 2);
    assert.equal(result.kept, 3);
    const after = readRevisions(dir);
    assert.equal(after.length, 3);
    assert.deepEqual(after.map(r => r.rev), [1, 2, 3]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("appendRevision: atomic per-row (no partial writes via O_APPEND single write)", () => {
  // We can't easily simulate concurrent processes in a unit test, but we
  // can verify that each call produces exactly one valid line in the file.
  const dir = mkSlugDir();
  try {
    for (let i = 1; i <= 10; i++) appendRevision(dir, mkRow(i));
    const text = readFileSync(revisionsPath(dir), "utf8");
    const lines = text.split("\n").filter(l => l.trim());
    assert.equal(lines.length, 10);
    for (const l of lines) {
      assert.doesNotThrow(() => JSON.parse(l));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
