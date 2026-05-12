import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  applyAtomically,
  appendLogEntry,
  cleanupStaging,
  mergeObservationBlocks,
  reverseCitationIndex,
  rewriteWikilinksInBody,
} from "../curation.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "curation-"));
  mkdirSync(join(root, "Sources", "2026"), { recursive: true });
  mkdirSync(join(root, "Entities", "_seen"), { recursive: true });
  mkdirSync(join(root, "Topics"), { recursive: true });
  mkdirSync(join(root, "Meta"), { recursive: true });
  return root;
}

function writeFile(root: string, repoPath: string, content: string): void {
  const abs = join(root, repoPath);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, content, "utf8");
}

// ---------------------------------------------------------------------------
// rewriteWikilinksInBody
// ---------------------------------------------------------------------------

test("rewriteWikilinksInBody: simple [[X]] rewrite", () => {
  const body = "See [[OldName]] for details.\n";
  const { body: newBody, count } = rewriteWikilinksInBody(body, new Map([["OldName", "NewName"]]));
  assert.equal(newBody, "See [[NewName]] for details.\n");
  assert.equal(count, 1);
});

test("rewriteWikilinksInBody: alias form [[X|alias]] preserves alias", () => {
  const body = "See [[OldName|the older variant]] or [[OldName]].\n";
  const { body: newBody, count } = rewriteWikilinksInBody(body, new Map([["OldName", "NewName"]]));
  assert.equal(newBody, "See [[NewName|the older variant]] or [[NewName]].\n");
  assert.equal(count, 2);
});

test("rewriteWikilinksInBody: skips fenced code blocks", () => {
  const body = [
    "Real ref: [[OldName]].",
    "```",
    "Inside fence: [[OldName]] should be left alone.",
    "```",
    "After: [[OldName]].",
  ].join("\n");
  const { body: newBody, count } = rewriteWikilinksInBody(body, new Map([["OldName", "NewName"]]));
  assert.equal(count, 2);
  assert.ok(newBody.includes("Real ref: [[NewName]]"));
  assert.ok(newBody.includes("After: [[NewName]]"));
  assert.ok(newBody.includes("Inside fence: [[OldName]]"));
});

test("rewriteWikilinksInBody: idempotent (re-run = 0 changes)", () => {
  const body = "Already rewritten: [[NewName]].\n";
  const { body: newBody, count } = rewriteWikilinksInBody(body, new Map([["OldName", "NewName"]]));
  assert.equal(newBody, body);
  assert.equal(count, 0);
});

test("rewriteWikilinksInBody: leaves unrelated wikilinks alone", () => {
  const body = "[[A]] and [[B]] and [[C]].\n";
  const { body: newBody } = rewriteWikilinksInBody(body, new Map([["B", "BRenamed"]]));
  assert.equal(newBody, "[[A]] and [[BRenamed]] and [[C]].\n");
});

// ---------------------------------------------------------------------------
// reverseCitationIndex
// ---------------------------------------------------------------------------

test("reverseCitationIndex: indexes wikilinks from Sources to Entities", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Sources/2026/foo.md",
      `---\ncreated: 2026-05-12\ntype: source\nsource_url: https://example.com\ntags: [inference]\n---\n\n# Foo\n\nCites [[BarEntity]] and [[BazEntity|alias]].\n`);
    writeFile(root, "Entities/_seen/BarEntity.md",
      `---\ncreated: 2026-05-12\ntype: entity\nrefs: 0\ntier: seen\n---\n\n# BarEntity\n`);
    writeFile(root, "Entities/_seen/BazEntity.md",
      `---\ncreated: 2026-05-12\ntype: entity\nrefs: 0\ntier: seen\n---\n\n# BazEntity\n`);
    const idx = reverseCitationIndex(root);
    const barRefs = idx.get("BarEntity") ?? [];
    assert.equal(barRefs.length, 1, `expected 1 ref to BarEntity, got ${JSON.stringify(barRefs)}`);
    assert.equal(barRefs[0].source_path, "Sources/2026/foo.md");
    const bazRefs = idx.get("BazEntity") ?? [];
    assert.equal(bazRefs.length, 1);
    assert.ok(bazRefs[0].raw_link.includes("BazEntity"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("reverseCitationIndex: excludes Meta/ pages", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Meta/index.md", `---\ntype: meta\n---\n\nCites [[X]].\n`);
    writeFile(root, "Sources/2026/foo.md", `---\ntype: source\n---\n\nCites [[X]].\n`);
    writeFile(root, "Entities/_seen/X.md", `---\ntype: entity\n---\n\n# X\n`);
    const idx = reverseCitationIndex(root);
    const xRefs = idx.get("X") ?? [];
    assert.equal(xRefs.length, 1, "Meta/ should be excluded");
    assert.equal(xRefs[0].source_path, "Sources/2026/foo.md");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------------------
// mergeObservationBlocks
// ---------------------------------------------------------------------------

test("mergeObservationBlocks: appends source bullets with HTML merge comment", () => {
  const target = [
    "# Target",
    "",
    "## Synthesis",
    "",
    "Target syntheses.",
    "",
    "## Observations",
    "",
    "- target bullet 1 — [[s1]]",
    "- target bullet 2 — [[s2]]",
    "",
  ].join("\n");
  const source = [
    "# Source",
    "",
    "## Synthesis",
    "",
    "Source syntheses.",
    "",
    "## Observations",
    "",
    "- source bullet — [[s3]]",
    "",
  ].join("\n");
  const merged = mergeObservationBlocks(target, source, "Source", "2026-05-12");
  assert.ok(merged.includes("target bullet 1"), "preserves target bullets");
  assert.ok(merged.includes("source bullet"), "appends source bullets");
  assert.ok(merged.includes("<!-- merged from [[Source]] on 2026-05-12 -->"), "marker comment present");
});

test("mergeObservationBlocks: handles Observations as last section", () => {
  const target = "# T\n\n## Observations\n\n- a\n";
  const source = "# S\n\n## Observations\n\n- b\n";
  const merged = mergeObservationBlocks(target, source, "S", "2026-05-12");
  assert.ok(merged.includes("- a"));
  assert.ok(merged.includes("- b"));
});

test("mergeObservationBlocks: returns target unchanged if source has no Observations", () => {
  const target = "# T\n\n## Observations\n\n- a\n";
  const source = "# S\n\nNo Observations section.\n";
  const merged = mergeObservationBlocks(target, source, "S", "2026-05-12");
  assert.equal(merged, target);
});

// ---------------------------------------------------------------------------
// applyAtomically — happy path
// ---------------------------------------------------------------------------

test("applyAtomically: write + delete + rename succeed atomically", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Entities/_seen/A.md", "# A original\n");
    writeFile(root, "Entities/_seen/B.md", "# B original\n");
    const stagingDir = applyAtomically(root, "test-op-1", [
      { kind: "write", path: "Entities/_seen/A.md", body: "# A rewritten\n" },
      { kind: "delete", path: "Entities/_seen/B.md" },
      { kind: "write", path: "Entities/_seen/C.md", body: "# C new\n" },
    ]);
    assert.equal(readFileSync(join(root, "Entities/_seen/A.md"), "utf8"), "# A rewritten\n");
    assert.ok(!existsSync(join(root, "Entities/_seen/B.md")), "B should be deleted");
    assert.equal(readFileSync(join(root, "Entities/_seen/C.md"), "utf8"), "# C new\n");
    assert.ok(existsSync(stagingDir));
    cleanupStaging(root, "test-op-1");
    assert.ok(!existsSync(stagingDir), "staging dir should be cleaned");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("applyAtomically: rename op moves file", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Entities/_seen/Old.md", "# Old\n");
    applyAtomically(root, "test-op-rename", [
      { kind: "rename", from: "Entities/_seen/Old.md", path: "Entities/_seen/New.md" },
    ]);
    assert.ok(!existsSync(join(root, "Entities/_seen/Old.md")));
    assert.equal(readFileSync(join(root, "Entities/_seen/New.md"), "utf8"), "# Old\n");
    cleanupStaging(root, "test-op-rename");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("applyAtomically: Phase 1 validation fails fast on missing delete target", () => {
  const root = makeRepo();
  try {
    let threw = false;
    try {
      applyAtomically(root, "test-op-fail-1", [
        { kind: "delete", path: "Entities/_seen/DoesNotExist.md" },
      ]);
    } catch (e) {
      threw = true;
      assert.ok((e as Error).message.includes("delete op target missing"));
    }
    assert.ok(threw, "should throw on missing delete target");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------------------
// appendLogEntry
// ---------------------------------------------------------------------------

test("appendLogEntry: prepends after LOG-ENTRIES-START marker", () => {
  const root = makeRepo();
  try {
    const year = new Date().getFullYear();
    writeFile(root, `Meta/log-${year}.md`,
      `---\ncreated: 2026-05-01\nupdated: 2026-05-01\ntype: meta\n---\n\n# Log — ${year}\n\nIntro.\n\n<!-- LOG-ENTRIES-START -->\n\n## [2026-05-01] ingest | Old entry\n\nold body\n\n---\n`);
    appendLogEntry(root, "refactor", "Test rename", ["Body line 1.", "Body line 2."]);
    const content = readFileSync(join(root, `Meta/log-${year}.md`), "utf8");
    const newIdx = content.indexOf("Test rename");
    const oldIdx = content.indexOf("Old entry");
    assert.ok(newIdx > 0 && newIdx < oldIdx, "new entry should appear before old entry (newest first)");
    assert.ok(content.includes("Body line 1."));
    assert.ok(content.includes("Body line 2."));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("appendLogEntry: bootstraps a new log file if missing", () => {
  const root = makeRepo();
  try {
    const year = new Date().getFullYear();
    // Don't create the log file
    appendLogEntry(root, "refactor", "First entry", ["Initial body."]);
    const content = readFileSync(join(root, `Meta/log-${year}.md`), "utf8");
    assert.ok(content.includes("# Log —"));
    assert.ok(content.includes("First entry"));
    assert.ok(content.includes("Initial body."));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
