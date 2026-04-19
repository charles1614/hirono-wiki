import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  slugOf,
  bucketOf,
  typeForBucket,
  sha256,
  loadMap,
  saveMap,
  walkWikiDocs,
  type LinkMap,
} from "../link-map.ts";

test("slugOf strips .md and returns basename", () => {
  assert.equal(slugOf("Meta/schema.md"), "schema");
  assert.equal(slugOf("Sources/2026/2026-04-19-aws-trainium3.md"), "2026-04-19-aws-trainium3");
  assert.equal(slugOf("Entities/_seen/Megatron.md"), "Megatron");
  assert.equal(slugOf("Topics/Training Infrastructure.md"), "Training Infrastructure");
});

test("bucketOf detects top-level bucket", () => {
  assert.equal(bucketOf("Meta/schema.md"), "Meta");
  assert.equal(bucketOf("Sources/2026/x.md"), "Sources");
  assert.equal(bucketOf("Entities/_seen/y.md"), "Entities");
  assert.equal(bucketOf("Topics/z.md"), "Topics");
  assert.equal(bucketOf("README.md"), null);
  assert.equal(bucketOf("tools/x.ts"), null);
});

test("typeForBucket returns the right type", () => {
  assert.equal(typeForBucket("Meta"), "meta");
  assert.equal(typeForBucket("Sources"), "source");
  assert.equal(typeForBucket("Entities"), "entity");
  assert.equal(typeForBucket("Topics"), "topic");
});

test("sha256 is stable and differs for different input", () => {
  const a = sha256("abc");
  const b = sha256("abc");
  const c = sha256("abd");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("loadMap returns defaults when file missing", () => {
  const tmp = mkdtempSync(join(tmpdir(), "map-test-"));
  try {
    const m = loadMap(join(tmp, "nonexistent.json"));
    assert.equal(m.space_id, "7630375570303372466");
    assert.deepEqual(m.parents, {});
    assert.deepEqual(m.docs, {});
  } finally {
    rmSync(tmp, { recursive: true });
  }
});

test("saveMap + loadMap round-trip", () => {
  const tmp = mkdtempSync(join(tmpdir(), "map-test-"));
  try {
    const path = join(tmp, "map.json");
    const map: LinkMap = {
      space_id: "X",
      parents: { Meta: { doc_id: "p1", url: "https://example/p1" } },
      docs: {
        Megatron: {
          repo_path: "Entities/Megatron.md",
          bucket: "Entities",
          type: "entity",
          doc_id: "d1",
          url: "https://example/d1",
          content_sha: "abc",
          uploaded_at: "2026-04-19T00:00:00Z",
        },
      },
    };
    saveMap(path, map);
    const loaded = loadMap(path);
    assert.deepEqual(loaded, map);
  } finally {
    rmSync(tmp, { recursive: true });
  }
});

test("walkWikiDocs finds .md in buckets; skips .gitkeep, README, tools", () => {
  const root = mkdtempSync(join(tmpdir(), "walk-test-"));
  try {
    mkdirSync(join(root, "Meta"));
    mkdirSync(join(root, "Sources/2026"), { recursive: true });
    mkdirSync(join(root, "Entities/_seen"), { recursive: true });
    mkdirSync(join(root, "Topics"));
    mkdirSync(join(root, "tools"));
    writeFileSync(join(root, "Meta/schema.md"), "x");
    writeFileSync(join(root, "Meta/index.md"), "x");
    writeFileSync(join(root, "Sources/2026/2026-04-19-foo.md"), "x");
    writeFileSync(join(root, "Entities/_seen/.gitkeep"), "");
    writeFileSync(join(root, "Entities/Megatron.md"), "x");
    writeFileSync(join(root, "Topics/A.md"), "x");
    writeFileSync(join(root, "README.md"), "x");
    writeFileSync(join(root, "tools/foo.ts"), "x");

    const paths = walkWikiDocs(root);
    assert.deepEqual(
      paths,
      [
        "Entities/Megatron.md",
        "Meta/index.md",
        "Meta/schema.md",
        "Sources/2026/2026-04-19-foo.md",
        "Topics/A.md",
      ],
    );
  } finally {
    rmSync(root, { recursive: true });
  }
});

test("walkWikiDocs throws on slug collision at caller site", () => {
  // Note: walkWikiDocs doesn't detect collisions itself (sync.ts does).
  // This test just confirms duplicate slug names appear as two distinct paths.
  const root = mkdtempSync(join(tmpdir(), "walk-collide-"));
  try {
    mkdirSync(join(root, "Entities/_seen"), { recursive: true });
    writeFileSync(join(root, "Entities/Foo.md"), "x");
    writeFileSync(join(root, "Entities/_seen/Foo.md"), "x");

    const paths = walkWikiDocs(root);
    const slugs = paths.map(slugOf);
    // Both paths survive; collision detection is caller's job.
    assert.equal(paths.length, 2);
    assert.equal(slugs[0], slugs[1]);
  } finally {
    rmSync(root, { recursive: true });
  }
});
