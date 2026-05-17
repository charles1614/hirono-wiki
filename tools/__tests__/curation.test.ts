import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  applyAtomically,
  appendLogEntry,
  cleanupStaging,
  isInSkipList,
  loadEntityAliases,
  loadIngestSkips,
  mergeObservationBlocks,
  normalizeEntityName,
  reverseCitationIndex,
  rewriteWikilinksInBody,
} from "../curation.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "curation-"));
  mkdirSync(join(root, "03_Sources", "2026"), { recursive: true });
  mkdirSync(join(root, "02_Entities", "_seen"), { recursive: true });
  mkdirSync(join(root, "01_Topics"), { recursive: true });
  mkdirSync(join(root, "00_Meta"), { recursive: true });
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
    writeFile(root, "03_Sources/2026/foo.md",
      `---\ncreated: 2026-05-12\ntype: source\nsource_url: https://example.com\ntags: [inference]\n---\n\n# Foo\n\nCites [[BarEntity]] and [[BazEntity|alias]].\n`);
    writeFile(root, "02_Entities/_seen/BarEntity.md",
      `---\ncreated: 2026-05-12\ntype: entity\nrefs: 0\ntier: seen\n---\n\n# BarEntity\n`);
    writeFile(root, "02_Entities/_seen/BazEntity.md",
      `---\ncreated: 2026-05-12\ntype: entity\nrefs: 0\ntier: seen\n---\n\n# BazEntity\n`);
    const idx = reverseCitationIndex(root);
    const barRefs = idx.get("BarEntity") ?? [];
    assert.equal(barRefs.length, 1, `expected 1 ref to BarEntity, got ${JSON.stringify(barRefs)}`);
    assert.equal(barRefs[0].source_path, "03_Sources/2026/foo.md");
    const bazRefs = idx.get("BazEntity") ?? [];
    assert.equal(bazRefs.length, 1);
    assert.ok(bazRefs[0].raw_link.includes("BazEntity"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("reverseCitationIndex: excludes Meta/ pages", () => {
  const root = makeRepo();
  try {
    writeFile(root, "00_Meta/index.md", `---\ntype: meta\n---\n\nCites [[X]].\n`);
    writeFile(root, "03_Sources/2026/foo.md", `---\ntype: source\n---\n\nCites [[X]].\n`);
    writeFile(root, "02_Entities/_seen/X.md", `---\ntype: entity\n---\n\n# X\n`);
    const idx = reverseCitationIndex(root);
    const xRefs = idx.get("X") ?? [];
    assert.equal(xRefs.length, 1, "00_Meta/ should be excluded");
    assert.equal(xRefs[0].source_path, "03_Sources/2026/foo.md");
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
  assert.ok(merged.includes("<!-- merged from `Source` on 2026-05-12 -->"), "marker comment present");
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
    writeFile(root, "02_Entities/_seen/A.md", "# A original\n");
    writeFile(root, "02_Entities/_seen/B.md", "# B original\n");
    const stagingDir = applyAtomically(root, "test-op-1", [
      { kind: "write", path: "02_Entities/_seen/A.md", body: "# A rewritten\n" },
      { kind: "delete", path: "02_Entities/_seen/B.md" },
      { kind: "write", path: "02_Entities/_seen/C.md", body: "# C new\n" },
    ]);
    assert.equal(readFileSync(join(root, "02_Entities/_seen/A.md"), "utf8"), "# A rewritten\n");
    assert.ok(!existsSync(join(root, "02_Entities/_seen/B.md")), "B should be deleted");
    assert.equal(readFileSync(join(root, "02_Entities/_seen/C.md"), "utf8"), "# C new\n");
    assert.ok(existsSync(stagingDir));
    cleanupStaging(root, "test-op-1");
    assert.ok(!existsSync(stagingDir), "staging dir should be cleaned");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("applyAtomically: rename op moves file", () => {
  const root = makeRepo();
  try {
    writeFile(root, "02_Entities/_seen/Old.md", "# Old\n");
    applyAtomically(root, "test-op-rename", [
      { kind: "rename", from: "02_Entities/_seen/Old.md", path: "02_Entities/_seen/New.md" },
    ]);
    assert.ok(!existsSync(join(root, "02_Entities/_seen/Old.md")));
    assert.equal(readFileSync(join(root, "02_Entities/_seen/New.md"), "utf8"), "# Old\n");
    cleanupStaging(root, "test-op-rename");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("applyAtomically: Phase 1 validation fails fast on missing delete target", () => {
  const root = makeRepo();
  try {
    let threw = false;
    try {
      applyAtomically(root, "test-op-fail-1", [
        { kind: "delete", path: "02_Entities/_seen/DoesNotExist.md" },
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
    writeFile(root, `00_Meta/log-${year}.md`,
      `---\ncreated: 2026-05-01\nupdated: 2026-05-01\ntype: meta\n---\n\n# Log — ${year}\n\nIntro.\n\n<!-- LOG-ENTRIES-START -->\n\n## [2026-05-01] ingest | Old entry\n\nold body\n\n---\n`);
    appendLogEntry(root, "refactor", "Test rename", ["Body line 1.", "Body line 2."]);
    const content = readFileSync(join(root, `00_Meta/log-${year}.md`), "utf8");
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
    const content = readFileSync(join(root, `00_Meta/log-${year}.md`), "utf8");
    assert.ok(content.includes("# Log —"));
    assert.ok(content.includes("First entry"));
    assert.ok(content.includes("Initial body."));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------------------
// loadEntityAliases + normalizeEntityName
// ---------------------------------------------------------------------------

test("loadEntityAliases: returns empty map when file missing", () => {
  const root = makeRepo();
  try {
    const aliases = loadEntityAliases(root);
    assert.equal(aliases.size, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("loadEntityAliases: parses entries under ## Aliases with → arrow", () => {
  const root = makeRepo();
  try {
    writeFile(root, "00_Meta/entity-aliases.md", [
      "---", "type: meta", "---", "",
      "# Aliases doc", "",
      "## Aliases", "",
      "- LLaMA → Llama",
      "- bfloat16 → BF16",
      "- Tile IR → CUDA Tile IR",
      "",
    ].join("\n"));
    const aliases = loadEntityAliases(root);
    assert.equal(aliases.get("LLaMA"), "Llama");
    assert.equal(aliases.get("bfloat16"), "BF16");
    assert.equal(aliases.get("Tile IR"), "CUDA Tile IR");
    assert.equal(aliases.size, 3);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("loadEntityAliases: also accepts -> ASCII arrow", () => {
  const root = makeRepo();
  try {
    writeFile(root, "00_Meta/entity-aliases.md", [
      "## Aliases", "",
      "- VLLM -> vLLM",
      "",
    ].join("\n"));
    const aliases = loadEntityAliases(root);
    assert.equal(aliases.get("VLLM"), "vLLM");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("loadEntityAliases: ignores lines outside ## Aliases section", () => {
  const root = makeRepo();
  try {
    writeFile(root, "00_Meta/entity-aliases.md", [
      "## Notes", "",
      "- Foo → Bar",  // should NOT be parsed
      "",
      "## Aliases", "",
      "- Real → Variant",
      "",
      "## Other", "",
      "- Excluded → AlsoExcluded",  // should NOT be parsed
      "",
    ].join("\n"));
    const aliases = loadEntityAliases(root);
    assert.equal(aliases.size, 1);
    assert.equal(aliases.get("Real"), "Variant");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("loadEntityAliases: skips identity mappings (variant == canonical)", () => {
  const root = makeRepo();
  try {
    writeFile(root, "00_Meta/entity-aliases.md", [
      "## Aliases", "",
      "- Llama → Llama",  // identity - skip
      "- LLaMA → Llama",
      "",
    ].join("\n"));
    const aliases = loadEntityAliases(root);
    assert.equal(aliases.size, 1);
    assert.equal(aliases.get("LLaMA"), "Llama");
    assert.equal(aliases.has("Llama"), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("normalizeEntityName: maps variant to canonical", () => {
  const aliases = new Map([["LLaMA", "Llama"], ["VLLM", "vLLM"]]);
  assert.equal(normalizeEntityName("LLaMA", aliases), "Llama");
  assert.equal(normalizeEntityName("VLLM", aliases), "vLLM");
});

test("normalizeEntityName: returns name unchanged when no alias", () => {
  const aliases = new Map([["LLaMA", "Llama"]]);
  assert.equal(normalizeEntityName("FlashAttention", aliases), "FlashAttention");
});

// ---------------------------------------------------------------------------
// loadIngestSkips + isInSkipList
// ---------------------------------------------------------------------------

test("loadIngestSkips: returns empty list when file missing", () => {
  const root = makeRepo();
  try {
    assert.equal(loadIngestSkips(root).length, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("loadIngestSkips: parses em-dash entries with skip-reason", () => {
  const root = makeRepo();
  try {
    writeFile(root, "00_Meta/sources-ingest-skips.md", [
      "# Skips",
      "",
      "## Entries",
      "",
      "- https://spam.example.com/a — skip-reason=spam · recurring spam",
      "- https://b.example.com — skip-reason=duplicate · canonical at https://c.example.com",
      "- 2026-04-23-hsbc-slug — skip-reason=bookmarked-by-mistake · off-topic banking",
      "",
    ].join("\n"));
    const skips = loadIngestSkips(root);
    assert.equal(skips.length, 3);
    assert.equal(skips[0].reason, "spam");
    assert.equal(skips[0].rationale, "recurring spam");
    assert.equal(skips[1].reason, "duplicate");
    assert.equal(skips[2].key, "2026-04-23-hsbc-slug");
    assert.equal(skips[2].reason, "bookmarked-by-mistake");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("loadIngestSkips: accepts ASCII -- arrow", () => {
  const root = makeRepo();
  try {
    writeFile(root, "00_Meta/sources-ingest-skips.md", [
      "## Entries", "",
      "- https://x.example.com -- skip-reason=spam · whatever",
      "",
    ].join("\n"));
    const skips = loadIngestSkips(root);
    assert.equal(skips.length, 1);
    assert.equal(skips[0].key, "https://x.example.com");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("isInSkipList: exact match", () => {
  const skips = [
    { key: "https://spam.example.com", reason: "spam", rationale: "" },
    { key: "2026-04-23-foo", reason: "bookmarked-by-mistake", rationale: "" },
  ];
  assert.equal(isInSkipList("https://spam.example.com", skips)?.reason, "spam");
  assert.equal(isInSkipList("2026-04-23-foo", skips)?.reason, "bookmarked-by-mistake");
  assert.equal(isInSkipList("https://ok.example.com", skips), null);
});

test("isInSkipList: case-insensitive + trailing-slash tolerant", () => {
  const skips = [{ key: "https://spam.example.com/", reason: "spam", rationale: "" }];
  assert.equal(isInSkipList("HTTPS://SPAM.example.com", skips)?.reason, "spam");
  assert.equal(isInSkipList("https://spam.example.com", skips)?.reason, "spam");
});
