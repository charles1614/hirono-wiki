import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { refineEntity } from "../hirono/refine-entity.ts";

function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "refine-entity-"));
  mkdirSync(join(root, "Sources", "2026"), { recursive: true });
  mkdirSync(join(root, "Entities", "_seen"), { recursive: true });
  mkdirSync(join(root, "Meta"), { recursive: true });
  return root;
}

function writeFile(root: string, repoPath: string, content: string): void {
  const abs = join(root, repoPath);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, content, "utf8");
}

const ENTITY_BODY = (synthesis: string, obs: string[]) => `---
created: 2026-01-01
updated: 2026-01-01
type: entity
refs: 2
tier: active
---

# TestEntity

One-line kind.

## Synthesis

${synthesis}

## Observations

${obs.map(o => `- ${o}`).join("\n")}
`;

test("refineEntity prepare: writes prompt with entity body + cited Sources", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Entities/TestEntity.md", ENTITY_BODY("Existing synthesis paragraph.", [
      "First atomic claim — [[foo-slug]]",
      "Second atomic claim — [[bar-slug]]",
    ]));
    writeFile(root, "Sources/2026/foo-slug.md", "---\ntype: source\n---\n\nFoo source body content.\n");
    writeFile(root, "Sources/2026/bar-slug.md", "---\ntype: source\n---\n\nBar source body content.\n");

    const r = refineEntity(root, "TestEntity");
    assert.equal(r.mode, "prepare");
    assert.ok(r.promptPath);
    assert.deepEqual(r.citedSources?.sort(), ["bar-slug", "foo-slug"]);
    assert.deepEqual(r.unresolvedCitations, []);

    const prompt = readFileSync(join(root, r.promptPath!), "utf8");
    // Preamble-first layout (Tier 1 of the token-cost architecture):
    // stable preamble heads the prompt; entity-specific content follows.
    assert.ok(prompt.includes("# refine-entity — Synthesis regeneration"));
    assert.ok(prompt.includes("## Subject: [[TestEntity]]"));
    assert.ok(prompt.includes("Existing synthesis paragraph"));
    // Test Sources are fixtures without curated sections, so excerptSource
    // falls back to full body — body content should be inlined.
    assert.ok(prompt.includes("Foo source body content"));
    assert.ok(prompt.includes("Bar source body content"));
    assert.ok(prompt.includes("First atomic claim"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("refineEntity prepare: reports unresolved citations", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Entities/TestEntity.md", ENTITY_BODY("syn", [
      "Real bullet — [[foo-slug]]",
      "Broken bullet — [[nonexistent-slug]]",
    ]));
    writeFile(root, "Sources/2026/foo-slug.md", "---\ntype: source\n---\n\nFoo.\n");

    const r = refineEntity(root, "TestEntity");
    assert.deepEqual(r.unresolvedCitations, ["nonexistent-slug"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("refineEntity prepare: finds entity in _seen/ tier", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Entities/_seen/SeenEntity.md", ENTITY_BODY("seen syn", [
      "bullet — [[foo-slug]]",
    ]));
    writeFile(root, "Sources/2026/foo-slug.md", "---\ntype: source\n---\n\nFoo.\n");

    const r = refineEntity(root, "SeenEntity");
    assert.equal(r.mode, "prepare");
    assert.equal(r.entityPath, "Entities/_seen/SeenEntity.md");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("refineEntity prepare: throws on missing entity", () => {
  const root = makeRepo();
  try {
    let threw = false;
    try { refineEntity(root, "NonExistent"); }
    catch (e) { threw = true; assert.ok((e as Error).message.includes("entity not found")); }
    assert.ok(threw);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("refineEntity dryrun: returns old + new without writing", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Entities/TestEntity.md", ENTITY_BODY("Old synthesis.", ["b — [[foo]]"]));
    writeFile(root, "Sources/2026/foo.md", "---\ntype: source\n---\n\nFoo.\n");
    const respPath = join(root, "resp.txt");
    writeFileSync(respPath, "New regenerated synthesis paragraph.");

    const r = refineEntity(root, "TestEntity", { responsePath: respPath });
    assert.equal(r.mode, "dryrun");
    assert.equal(r.oldSynthesis, "Old synthesis.");
    assert.equal(r.newSynthesis, "New regenerated synthesis paragraph.");

    // File NOT modified
    const after = readFileSync(join(root, "Entities/TestEntity.md"), "utf8");
    assert.ok(after.includes("Old synthesis."));
    assert.ok(!after.includes("New regenerated"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("refineEntity apply: replaces Synthesis + bumps synthesis_updated_at + log entry", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Entities/TestEntity.md", ENTITY_BODY("Old synthesis paragraph.", [
      "Bullet one — [[foo]]",
    ]));
    writeFile(root, "Sources/2026/foo.md", "---\ntype: source\n---\n\nFoo.\n");
    const respPath = join(root, "resp.txt");
    writeFileSync(respPath, "Brand new synthesis paragraph that replaces the old.");

    const r = refineEntity(root, "TestEntity", { responsePath: respPath, apply: true });
    assert.equal(r.mode, "apply");

    const after = readFileSync(join(root, "Entities/TestEntity.md"), "utf8");
    assert.ok(after.includes("Brand new synthesis paragraph"));
    assert.ok(!after.includes("Old synthesis paragraph"));
    const today = new Date().toISOString().slice(0, 10);
    assert.ok(after.includes(`synthesis_updated_at: ${today}`));
    assert.ok(after.includes(`updated: ${today}`));

    const year = new Date().getFullYear();
    const log = readFileSync(join(root, `Meta/log-${year}.md`), "utf8");
    assert.ok(log.includes("Refine [[TestEntity]] Synthesis"));
    assert.ok(log.includes("1 Observation"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("refineEntity apply: inserts synthesis_updated_at when missing", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Entities/TestEntity.md", `---
created: 2026-01-01
updated: 2026-01-01
type: entity
refs: 1
tier: seen
---

# TestEntity

## Synthesis

stub

## Observations

- bullet — [[foo]]
`);
    writeFile(root, "Sources/2026/foo.md", "---\ntype: source\n---\n\nFoo.\n");
    const respPath = join(root, "resp.txt");
    writeFileSync(respPath, "Regenerated.");

    refineEntity(root, "TestEntity", { responsePath: respPath, apply: true });
    const after = readFileSync(join(root, "Entities/TestEntity.md"), "utf8");
    const today = new Date().toISOString().slice(0, 10);
    assert.ok(after.includes(`synthesis_updated_at: ${today}`));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("refineEntity apply: refuses empty response", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Entities/TestEntity.md", ENTITY_BODY("syn", ["b — [[foo]]"]));
    writeFile(root, "Sources/2026/foo.md", "---\ntype: source\n---\n\nFoo.\n");
    const respPath = join(root, "empty-resp.txt");
    writeFileSync(respPath, "   \n  \n");
    let threw = false;
    try { refineEntity(root, "TestEntity", { responsePath: respPath, apply: true }); }
    catch (e) { threw = true; assert.ok((e as Error).message.includes("response is empty")); }
    assert.ok(threw);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
