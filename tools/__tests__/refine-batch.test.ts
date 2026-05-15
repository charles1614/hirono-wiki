/**
 * Unit tests for refine-batch:
 *   - parseBatchResponse: marker-delimited parser
 *   - refineBatch prepare: builds merged prompt with preamble + N entity blocks
 *   - refineBatch dryrun: cross-checks parsed names against batch.md
 *   - refineBatch apply: invokes refineEntity per item, partial-success OK
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { refineBatch, parseBatchResponse } from "../hirono/refine-batch.ts";

function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "refine-batch-"));
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

const ENTITY = (name: string, syn: string, obs: string[]) => `---
created: 2026-01-01
updated: 2026-01-01
type: entity
refs: 2
tier: active
---

# ${name}

One-line kind.

## Synthesis

${syn}

## Observations

${obs.map(o => `- ${o}`).join("\n")}
`;

test("parseBatchResponse: extracts (name, paragraph) pairs from marker-delimited text", () => {
  const raw = `Some preamble text the subagent emitted.

=== entity: Foo ===
Foo paragraph line one. Foo paragraph line two.

=== entity: Bar Baz ===
Bar Baz paragraph.
Multiple lines.

=== entity: Qux ===
Qux paragraph.
`;
  const parsed = parseBatchResponse(raw);
  assert.equal(parsed.size, 3);
  assert.ok(parsed.get("Foo")?.startsWith("Foo paragraph line one"));
  assert.ok(parsed.get("Bar Baz")?.includes("Multiple lines"));
  assert.equal(parsed.get("Qux"), "Qux paragraph.");
});

test("parseBatchResponse: empty input → empty map", () => {
  assert.equal(parseBatchResponse("").size, 0);
  assert.equal(parseBatchResponse("no markers here, just text").size, 0);
});

test("parseBatchResponse: strips trailing code fence", () => {
  const raw = `=== entity: Foo ===
Foo paragraph.
\`\`\`
some trailing garbage
\`\`\``;
  const parsed = parseBatchResponse(raw);
  assert.equal(parsed.get("Foo"), "Foo paragraph.");
});

test("refineBatch prepare: writes batch.md with preamble + per-entity blocks", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Entities/Foo.md", ENTITY("Foo", "Foo synthesis.", ["claim — [[foo-src]]"]));
    writeFile(root, "Entities/Bar.md", ENTITY("Bar", "Bar synthesis.", ["claim — [[bar-src]]"]));
    writeFile(root, "Sources/2026/foo-src.md", "---\ntype: source\n---\n\nFoo Source body.\n");
    writeFile(root, "Sources/2026/bar-src.md", "---\ntype: source\n---\n\nBar Source body.\n");

    const r = refineBatch(root, { names: ["Foo", "Bar"] });
    assert.equal(r.mode, "prepare");
    assert.equal(r.itemCount, 2);
    assert.equal(r.promptPath, ".refine-prompts/batch.md");

    const prompt = readFileSync(join(root, r.promptPath!), "utf8");
    assert.ok(prompt.includes("# refine-entity — Synthesis regeneration"));
    assert.ok(prompt.includes("## Batch mode: 2 entities"));
    assert.ok(prompt.includes("## (1/2) Subject: [[Foo]]"));
    assert.ok(prompt.includes("## (2/2) Subject: [[Bar]]"));
    assert.ok(prompt.includes("Foo synthesis"));
    assert.ok(prompt.includes("Bar synthesis"));
    assert.ok(prompt.includes("Foo Source body"));
    assert.ok(prompt.includes("Bar Source body"));
    assert.ok(prompt.includes("=== entity: <Name1> ==="));  // format instruction
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("refineBatch prepare: throws when entity not found", () => {
  const root = makeRepo();
  try {
    assert.throws(() => refineBatch(root, { names: ["Missing"] }), /entity not found/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("refineBatch dryrun: cross-checks response names against batch.md", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Entities/Foo.md", ENTITY("Foo", "Foo synthesis.", []));
    writeFile(root, "Entities/Bar.md", ENTITY("Bar", "Bar synthesis.", []));
    refineBatch(root, { names: ["Foo", "Bar"] });

    // Response includes Foo + Baz (typo), missing Bar
    writeFile(root, ".refine-prompts/batch-response.txt",
      `=== entity: Foo ===\nFoo new synthesis paragraph.\n\n=== entity: Baz ===\nBaz typo paragraph.\n`);
    const r = refineBatch(root, { responsePath: ".refine-prompts/batch-response.txt" });
    assert.equal(r.mode, "dryrun");
    assert.equal(r.itemCount, 2);
    assert.deepEqual(r.missingFromResponse, ["Bar"]);
    assert.deepEqual(r.unmatchedInResponse, ["Baz"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("refineBatch apply: invokes refineEntity per parsed entity, atomic per item", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Entities/Foo.md", ENTITY("Foo", "Old Foo synthesis.", []));
    writeFile(root, "Entities/Bar.md", ENTITY("Bar", "Old Bar synthesis.", []));
    refineBatch(root, { names: ["Foo", "Bar"] });

    writeFile(root, ".refine-prompts/batch-response.txt",
      `=== entity: Foo ===\nNew Foo synthesis paragraph.\n\n=== entity: Bar ===\nNew Bar synthesis paragraph.\n`);
    const r = refineBatch(root, { responsePath: ".refine-prompts/batch-response.txt", apply: true });
    assert.equal(r.mode, "apply");
    assert.deepEqual(r.applied?.sort(), ["Bar", "Foo"]);
    assert.deepEqual(r.failed, []);

    // Verify Entity files updated
    const foo = readFileSync(join(root, "Entities/Foo.md"), "utf8");
    const bar = readFileSync(join(root, "Entities/Bar.md"), "utf8");
    assert.ok(foo.includes("New Foo synthesis paragraph"));
    assert.ok(bar.includes("New Bar synthesis paragraph"));
    assert.ok(!foo.includes("Old Foo synthesis."));
    assert.ok(!bar.includes("Old Bar synthesis."));
    // synthesis_updated_at bumped
    assert.match(foo, /^synthesis_updated_at:\s*\d{4}-\d{2}-\d{2}$/m);
    assert.match(bar, /^synthesis_updated_at:\s*\d{4}-\d{2}-\d{2}$/m);
    // refactor log entry written (Meta/log-YYYY.md, current year)
    const year = new Date().getFullYear();
    const log = readFileSync(join(root, "Meta", `log-${year}.md`), "utf8");
    assert.ok(log.includes("Refine [[Foo]] Synthesis"));
    assert.ok(log.includes("Refine [[Bar]] Synthesis"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("refineBatch apply: partial success — one bad entity doesn't block the rest", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Entities/Foo.md", ENTITY("Foo", "Old Foo.", []));
    // Bar deliberately absent → refineEntity throws on apply
    refineBatch(root, { names: ["Foo"] });

    writeFile(root, ".refine-prompts/batch-response.txt",
      `=== entity: Foo ===\nNew Foo synthesis.\n\n=== entity: NonExistent ===\nBogus paragraph.\n`);
    const r = refineBatch(root, { responsePath: ".refine-prompts/batch-response.txt", apply: true });
    assert.equal(r.applied?.length, 1);
    assert.equal(r.failed?.length, 1);
    assert.equal(r.failed?.[0].name, "NonExistent");
    assert.match(r.failed?.[0].error ?? "", /not found/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("refineBatch apply: empty response throws", () => {
  const root = makeRepo();
  try {
    writeFileSync(join(root, "empty.txt"), "no markers in here\n");
    assert.throws(
      () => refineBatch(root, { responsePath: join(root, "empty.txt"), apply: true }),
      /zero.*blocks/,
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
});
