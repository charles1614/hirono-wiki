import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cmdPlan,
  cmdNext,
  cmdStart,
  cmdMarkDone,
  cmdMarkErrored,
  cmdReset,
  cmdStatus,
  cmdPruneDone,
  type Paths,
} from "../bin/ingest_batch.ts";

function sandbox(opts: { withRawIndex?: boolean } = {}): {
  paths: Paths; cleanup: () => void; candidatesFile: (c: unknown) => string; rawIndexFile: (entries: Record<string, unknown>) => void;
} {
  const dir = mkdtempSync(join(tmpdir(), "ib-"));
  const paths: Paths = {
    state: join(dir, ".wiki-batch-state.json"),
    sourcesIndex: join(dir, ".wiki-sources-index.json"),
  };
  if (opts.withRawIndex) paths.rawIndex = join(dir, "_index.json");
  return {
    paths,
    cleanup: () => rmSync(dir, { recursive: true }),
    candidatesFile(c) {
      const p = join(dir, "cands.json");
      writeFileSync(p, JSON.stringify(c));
      return p;
    },
    rawIndexFile(entries) {
      writeFileSync(paths.rawIndex!, JSON.stringify({ version: 1, updated_at: "2026-05-09T00:00:00Z", slugs: entries }));
    },
  };
}

test("plan: adds new candidates as pending", () => {
  const s = sandbox();
  try {
    const file = s.candidatesFile([
      { id: "a", url: "https://example.com/a" },
      { id: "b", url: "https://example.com/b", title: "Bee" },
    ]);
    const r = cmdPlan(file, s.paths);
    assert.equal(r.added, 2);
    assert.equal(r.dedupedByUrl, 0);
    assert.equal(r.totalPending, 2);
    const next = cmdNext(5, s.paths);
    assert.deepEqual(next.map((e) => e.id).sort(), ["a", "b"]);
  } finally { s.cleanup(); }
});

test("plan: dedups against .wiki-sources-index.json by normalized URL", () => {
  const s = sandbox();
  try {
    writeFileSync(s.paths.sourcesIndex, JSON.stringify({
      "https://example.com/already": { slug: "already", repo_path: "Sources/2026/already.md", raw_source: "https://example.com/already", ingested_at: "2026-04-20" },
    }));
    const file = s.candidatesFile([
      // trailing slash + tracking params → normalizes to the already-ingested URL
      { id: "dup", url: "https://Example.com/already/?utm_source=x" },
      { id: "new", url: "https://example.com/new" },
    ]);
    const r = cmdPlan(file, s.paths);
    assert.equal(r.added, 1, "only the new candidate added");
    assert.equal(r.dedupedByUrl, 1, "dup dedup'd by URL");
    assert.equal(r.totalPending, 1);
  } finally { s.cleanup(); }
});

test("plan: dedups by id when the same id appears twice", () => {
  const s = sandbox();
  try {
    cmdPlan(s.candidatesFile([{ id: "a", url: "https://example.com/a" }]), s.paths);
    const r = cmdPlan(
      s.candidatesFile([{ id: "a", url: "https://example.com/different-url-but-same-id" }]),
      s.paths,
    );
    assert.equal(r.added, 0);
    assert.equal(r.dedupedById, 1);
  } finally { s.cleanup(); }
});

test("plan: re-adding a done id skips (skippedDone), not dedupedById", () => {
  const s = sandbox();
  try {
    cmdPlan(s.candidatesFile([{ id: "a", url: "https://example.com/a" }]), s.paths);
    cmdMarkDone("a", "slug-a", s.paths);
    const r = cmdPlan(s.candidatesFile([{ id: "a", url: "https://example.com/a" }]), s.paths);
    assert.equal(r.added, 0);
    assert.equal(r.skippedDone, 1);
  } finally { s.cleanup(); }
});

test("next: returns items in add order, respects count", () => {
  const s = sandbox();
  try {
    cmdPlan(s.candidatesFile([
      { id: "a", url: "https://example.com/a" },
      { id: "b", url: "https://example.com/b" },
      { id: "c", url: "https://example.com/c" },
    ]), s.paths);
    assert.equal(cmdNext(1, s.paths).length, 1);
    const two = cmdNext(2, s.paths);
    assert.equal(two.length, 2);
    // First added should be first out
    assert.equal(two[0].id, "a");
    assert.equal(two[1].id, "b");
  } finally { s.cleanup(); }
});

test("next: in-progress items are not returned", () => {
  const s = sandbox();
  try {
    cmdPlan(s.candidatesFile([
      { id: "a", url: "https://example.com/a" },
      { id: "b", url: "https://example.com/b" },
    ]), s.paths);
    cmdStart("a", s.paths);
    const n = cmdNext(5, s.paths);
    assert.deepEqual(n.map((e) => e.id), ["b"]);
  } finally { s.cleanup(); }
});

test("start → mark-done lifecycle", () => {
  const s = sandbox();
  try {
    cmdPlan(s.candidatesFile([{ id: "a", url: "https://example.com/a" }]), s.paths);
    cmdStart("a", s.paths);
    const mid = cmdStatus(s.paths);
    assert.equal(mid.counts["in-progress"], 1);
    cmdMarkDone("a", "my-slug", s.paths);
    const after = cmdStatus(s.paths);
    assert.equal(after.counts.done, 1);
    assert.equal(after.counts["in-progress"], 0);
    const doneEntry = after.entries.find((e) => e.id === "a")!;
    assert.equal(doneEntry.slug, "my-slug");
    assert.ok(doneEntry.completed_at);
  } finally { s.cleanup(); }
});

test("mark-errored records the message", () => {
  const s = sandbox();
  try {
    cmdPlan(s.candidatesFile([{ id: "a", url: "https://example.com/a" }]), s.paths);
    cmdMarkErrored("a", "fetch timeout after 30s", s.paths);
    const after = cmdStatus(s.paths);
    assert.equal(after.counts.errored, 1);
    const e = after.entries.find((x) => x.id === "a")!;
    assert.equal(e.status, "errored");
    assert.equal(e.error, "fetch timeout after 30s");
  } finally { s.cleanup(); }
});

test("reset: errored → pending, clears timestamps and error", () => {
  const s = sandbox();
  try {
    cmdPlan(s.candidatesFile([{ id: "a", url: "https://example.com/a" }]), s.paths);
    cmdMarkErrored("a", "boom", s.paths);
    cmdReset("a", s.paths);
    const after = cmdStatus(s.paths);
    const e = after.entries.find((x) => x.id === "a")!;
    assert.equal(e.status, "pending");
    assert.equal(e.error, undefined);
    assert.equal(e.completed_at, undefined);
  } finally { s.cleanup(); }
});

test("prune-done: removes done entries, keeps others", () => {
  const s = sandbox();
  try {
    cmdPlan(s.candidatesFile([
      { id: "a", url: "https://example.com/a" },
      { id: "b", url: "https://example.com/b" },
      { id: "c", url: "https://example.com/c" },
    ]), s.paths);
    cmdMarkDone("a", "sa", s.paths);
    cmdMarkDone("b", "sb", s.paths);
    const removed = cmdPruneDone(s.paths);
    assert.equal(removed, 2);
    const after = cmdStatus(s.paths);
    assert.equal(after.counts.total, 1);
    assert.equal(after.counts.pending, 1);
  } finally { s.cleanup(); }
});

test("status: correctly tallies all states", () => {
  const s = sandbox();
  try {
    cmdPlan(s.candidatesFile([
      { id: "p1", url: "https://example.com/p1" },
      { id: "p2", url: "https://example.com/p2" },
      { id: "ip", url: "https://example.com/ip" },
      { id: "d",  url: "https://example.com/d" },
      { id: "e",  url: "https://example.com/e" },
    ]), s.paths);
    cmdStart("ip", s.paths);
    cmdMarkDone("d", undefined, s.paths);
    cmdMarkErrored("e", "oops", s.paths);
    const { counts } = cmdStatus(s.paths);
    assert.equal(counts.pending, 2);
    assert.equal(counts["in-progress"], 1);
    assert.equal(counts.done, 1);
    assert.equal(counts.errored, 1);
    assert.equal(counts.total, 5);
  } finally { s.cleanup(); }
});

test("mark-done / mark-errored / start throw on unknown id", () => {
  const s = sandbox();
  try {
    assert.throws(() => cmdStart("missing", s.paths), /no entry with id/);
    assert.throws(() => cmdMarkDone("missing", undefined, s.paths), /no entry with id/);
    assert.throws(() => cmdMarkErrored("missing", "x", s.paths), /no entry with id/);
  } finally { s.cleanup(); }
});

test("plan: malformed JSON → throws clear error", () => {
  const s = sandbox();
  try {
    const f = join(s.paths.state, "..", "bad.json");
    writeFileSync(f, "{not json}");
    assert.throws(() => cmdPlan(f, s.paths), /not valid JSON/);
  } finally { s.cleanup(); }
});

test("plan: non-array JSON → throws", () => {
  const s = sandbox();
  try {
    assert.throws(() => cmdPlan(s.candidatesFile({ id: "x", url: "y" }), s.paths), /must be a JSON array/);
  } finally { s.cleanup(); }
});

// ─────────────────────────── quality gate ───────────────────────────────

test("plan: quality gate skips flagged slugs by URL match", () => {
  const s = sandbox({ withRawIndex: true });
  try {
    s.rawIndexFile({
      "2026-04-01-flagged-slug": {
        slug: "2026-04-01-flagged-slug",
        hostname: "example.com",
        year: "2026",
        link: "https://example.com/flagged",
        quality_status: "flagged",
      },
      "2026-04-01-good-slug": {
        slug: "2026-04-01-good-slug",
        hostname: "example.com",
        year: "2026",
        link: "https://example.com/good",
        quality_status: "good",
      },
    });
    const file = s.candidatesFile([
      { id: "raindrop:1", url: "https://example.com/flagged" },
      { id: "raindrop:2", url: "https://example.com/good" },
      { id: "raindrop:3", url: "https://example.com/never-fetched" },  // not in _index → fail open
    ]);
    const r = cmdPlan(file, s.paths);
    assert.equal(r.skippedFlagged, 1, "flagged slug should be skipped");
    assert.equal(r.added, 2, "good slug + never-fetched added");
  } finally { s.cleanup(); }
});

test("plan: --allow-flagged bypasses quality gate", () => {
  const s = sandbox({ withRawIndex: true });
  try {
    s.rawIndexFile({
      "2026-04-01-flagged": {
        slug: "2026-04-01-flagged",
        hostname: "example.com",
        year: "2026",
        link: "https://example.com/flagged",
        quality_status: "flagged",
      },
    });
    const file = s.candidatesFile([{ id: "raindrop:1", url: "https://example.com/flagged" }]);
    const r = cmdPlan(file, s.paths, { allowFlagged: true });
    assert.equal(r.skippedFlagged, 0);
    assert.equal(r.added, 1);
  } finally { s.cleanup(); }
});

test("plan: quality gate handles share-aggregator unwrap (P-32)", () => {
  // Cache stores the wrapper URL; the slug archives under the unwrapped
  // target's hostname with origin_url = unwrapped form. The gate must
  // resolve the wrapper to the unwrapped form before matching.
  const s = sandbox({ withRawIndex: true });
  try {
    s.rawIndexFile({
      "2025-06-09-shared-topic": {
        slug: "2025-06-09-shared-topic",
        hostname: "linux.do",
        year: "2025",
        link: "https://linux.do/t/topic/537374",   // unwrapped form in _index
        quality_status: "flagged",
      },
    });
    const file = s.candidatesFile([
      // Candidate URL is the wrapper form (as stored in raindrop cache)
      { id: "raindrop:1", url: "https://share.google?link=https://linux.do/t/topic/537374&utm_campaign=x" },
    ]);
    const r = cmdPlan(file, s.paths);
    assert.equal(r.skippedFlagged, 1, "wrapper URL should resolve to unwrapped target's flagged status");
  } finally { s.cleanup(); }
});

test("plan: missing _index.json fails open (no gate, no error)", () => {
  // Sandbox without rawIndex path → no gate at all. Existing behavior.
  const s = sandbox();
  try {
    const file = s.candidatesFile([{ id: "a", url: "https://example.com/a" }]);
    const r = cmdPlan(file, s.paths);
    assert.equal(r.added, 1);
    assert.equal(r.skippedFlagged, 0);
  } finally { s.cleanup(); }
});
