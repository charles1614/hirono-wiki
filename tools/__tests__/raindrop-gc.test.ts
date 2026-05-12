import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { planGc, applyGc } from "../hirono/raindrop/gc.ts";

function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "gc-"));
  mkdirSync(join(root, "raw", "raindrop"), { recursive: true });
  return root;
}

function seedSlug(root: string, host: string, slug: string, revs: number[]): void {
  const dir = `raw/raindrop/${host}/${slug}`;
  mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, dir, "content.md"), "current");
  writeFileSync(join(root, dir, "source.json"), "{}");
  const jsonl: string[] = [];
  for (const r of revs) {
    writeFileSync(join(root, dir, `content-rev${r}.md`), `body rev${r}`);
    jsonl.push(JSON.stringify({ rev: r, content_sha: `sha${r}`, fetched_at: `2026-0${r}-01T00:00:00Z` }));
  }
  writeFileSync(join(root, dir, "revisions.jsonl"), jsonl.join("\n") + "\n");
}

test("planGc: keeps last N revs, returns older ones to delete", () => {
  const root = makeRepo();
  try {
    seedSlug(root, "example.com", "slug-a", [1, 2, 3, 4, 5]);
    const actions = planGc(root, { keepLast: 3 });
    assert.equal(actions.length, 1);
    assert.deepEqual(actions[0].toDelete.sort(), ["content-rev1.md", "content-rev2.md"]);
    assert.deepEqual(actions[0].kept.sort(), ["content-rev3.md", "content-rev4.md", "content-rev5.md"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("planGc: no-op when rev count <= keep-last", () => {
  const root = makeRepo();
  try {
    seedSlug(root, "example.com", "slug-a", [2, 3, 4]);
    const actions = planGc(root, { keepLast: 3 });
    assert.equal(actions.length, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("planGc: slug filter limits scope", () => {
  const root = makeRepo();
  try {
    seedSlug(root, "example.com", "slug-a", [1, 2, 3, 4]);
    seedSlug(root, "example.com", "slug-b", [1, 2, 3, 4]);
    const actions = planGc(root, { keepLast: 2, slugFilter: "slug-b" });
    assert.equal(actions.length, 1);
    assert.equal(actions[0].slug, "slug-b");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("applyGc: deletes files + marks revisions.jsonl body_pruned=true", () => {
  const root = makeRepo();
  try {
    seedSlug(root, "example.com", "slug-a", [1, 2, 3]);
    const actions = planGc(root, { keepLast: 1 });
    const r = applyGc(root, actions);
    assert.equal(r.deletedCount, 2);
    assert.ok(!existsSync(join(root, "raw/raindrop/example.com/slug-a/content-rev1.md")));
    assert.ok(!existsSync(join(root, "raw/raindrop/example.com/slug-a/content-rev2.md")));
    assert.ok(existsSync(join(root, "raw/raindrop/example.com/slug-a/content-rev3.md")));
    // current content.md preserved
    assert.ok(existsSync(join(root, "raw/raindrop/example.com/slug-a/content.md")));

    const revLines = readFileSync(join(root, "raw/raindrop/example.com/slug-a/revisions.jsonl"), "utf8")
      .trim().split("\n").map(l => JSON.parse(l));
    assert.equal(revLines.find(r => r.rev === 1)?.body_pruned, true);
    assert.equal(revLines.find(r => r.rev === 2)?.body_pruned, true);
    assert.equal(revLines.find(r => r.rev === 3)?.body_pruned, undefined);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
