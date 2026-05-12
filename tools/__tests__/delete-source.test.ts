import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { deleteSource } from "../hirono/delete-source.ts";

function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "delete-source-"));
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

test("deleteSource: happy path — removes Source + raw archive + log entry", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Sources/2026/foo-slug.md", `---\ntype: source\n---\n\nBody.\n`);
    writeFile(root, "raw/raindrop/example.com/foo-slug/content.md", "raw stub");
    writeFile(root, "raw/raindrop/example.com/foo-slug/source.json", "{}");

    const r = deleteSource(root, "foo-slug", { reason: "test cleanup" });
    assert.equal(r.sourcePath, "Sources/2026/foo-slug.md");
    assert.equal(r.rawDirPath, "raw/raindrop/example.com/foo-slug");
    assert.equal(r.rawDeleted, true);
    assert.deepEqual(r.citers, []);

    assert.ok(!existsSync(join(root, "Sources/2026/foo-slug.md")));
    assert.ok(!existsSync(join(root, "raw/raindrop/example.com/foo-slug")));

    const year = new Date().getFullYear();
    const log = readFileSync(join(root, `Meta/log-${year}.md`), "utf8");
    assert.ok(log.includes("Delete Source [[foo-slug]]"));
    assert.ok(log.includes("test cleanup"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("deleteSource: --keep-raw preserves raw archive", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Sources/2026/foo.md", `---\ntype: source\n---\n\nBody.\n`);
    writeFile(root, "raw/raindrop/example.com/foo/content.md", "raw");

    const r = deleteSource(root, "foo", { keepRaw: true });
    assert.equal(r.rawDeleted, false);
    assert.ok(!existsSync(join(root, "Sources/2026/foo.md")));
    assert.ok(existsSync(join(root, "raw/raindrop/example.com/foo/content.md")));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("deleteSource: refuses when cited by Entity (dangling-ref guard)", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Sources/2026/foo-slug.md", `---\ntype: source\n---\n\nBody.\n`);
    writeFile(root, "raw/raindrop/example.com/foo-slug/content.md", "x");
    writeFile(root, "Entities/SomeEntity.md",
      `---\ntype: entity\n---\n\n## Observations\n\n- Claim — [[foo-slug]]\n`);

    let threw = false;
    try { deleteSource(root, "foo-slug"); }
    catch (e) {
      threw = true;
      assert.ok((e as Error).message.includes("cited by"));
      assert.ok((e as Error).message.includes("--force"));
    }
    assert.ok(threw);
    // Source NOT deleted
    assert.ok(existsSync(join(root, "Sources/2026/foo-slug.md")));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("deleteSource: --force overrides dangling-ref guard", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Sources/2026/foo-slug.md", `---\ntype: source\n---\n\nBody.\n`);
    writeFile(root, "Entities/SomeEntity.md",
      `---\ntype: entity\n---\n\n## Observations\n\n- [[foo-slug]]\n`);

    const r = deleteSource(root, "foo-slug", { force: true, reason: "cleanup" });
    assert.equal(r.citers.length, 1);
    assert.ok(!existsSync(join(root, "Sources/2026/foo-slug.md")));
    // Citer file is left alone (dangling ref now)
    assert.ok(existsSync(join(root, "Entities/SomeEntity.md")));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("deleteSource: throws on missing Source", () => {
  const root = makeRepo();
  try {
    let threw = false;
    try { deleteSource(root, "nonexistent"); }
    catch (e) { threw = true; assert.ok((e as Error).message.includes("Source not found")); }
    assert.ok(threw);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("deleteSource: works when no raw archive exists", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Sources/2026/no-raw.md", `---\ntype: source\n---\n\nBody.\n`);
    const r = deleteSource(root, "no-raw");
    assert.equal(r.rawDirPath, null);
    assert.equal(r.rawDeleted, false);
    assert.ok(!existsSync(join(root, "Sources/2026/no-raw.md")));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
