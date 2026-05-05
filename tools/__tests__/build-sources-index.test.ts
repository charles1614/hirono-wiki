import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildIndex, normalizeUrl } from "../bin/build-sources-index.ts";

test("normalizeUrl: lowercases scheme/host, drops trailing slash", () => {
  assert.equal(
    normalizeUrl("HTTPS://Newsletter.SemiAnalysis.com/p/foo/"),
    "https://newsletter.semianalysis.com/p/foo",
  );
});

test("normalizeUrl: strips utm_* and other tracking params", () => {
  const out = normalizeUrl("https://example.com/article?utm_source=newsletter&utm_medium=email&id=42&fbclid=abc");
  assert.equal(out, "https://example.com/article?id=42");
});

test("normalizeUrl: drops fragment", () => {
  assert.equal(normalizeUrl("https://example.com/foo#section-2"), "https://example.com/foo");
});

test("normalizeUrl: alphabetizes remaining params", () => {
  assert.equal(
    normalizeUrl("https://example.com/x?z=1&a=2&m=3"),
    "https://example.com/x?a=2&m=3&z=1",
  );
});

test("normalizeUrl: passes through non-HTTP schemes", () => {
  assert.equal(normalizeUrl("lark://wiki/space_id/node_token"), "lark://wiki/space_id/node_token");
  assert.equal(normalizeUrl("LARK://wiki/X"), "lark://wiki/X");
});

test("normalizeUrl: empty / malformed input", () => {
  assert.equal(normalizeUrl(""), "");
  assert.equal(normalizeUrl("   "), "");
  assert.equal(normalizeUrl("not-a-url"), "not-a-url");
});

test("buildIndex: extracts raw_source from each Source page", () => {
  const root = mkdtempSync(join(tmpdir(), "src-idx-"));
  try {
    mkdirSync(join(root, "Sources/2026"), { recursive: true });
    mkdirSync(join(root, "Entities"));
    mkdirSync(join(root, "Topics"));
    mkdirSync(join(root, "Meta"));

    writeFileSync(
      join(root, "Sources/2026/2026-04-19-foo.md"),
      `---
type: source
created: 2026-04-19
raw_source: https://example.com/foo
---

# foo
`,
    );
    writeFileSync(
      join(root, "Sources/2026/2026-04-20-bar.md"),
      `---
type: source
created: 2026-04-20
raw_source: https://Example.com/bar/?utm_source=x
---

# bar
`,
    );
    // entity / topic should be ignored
    writeFileSync(
      join(root, "Entities/Foo.md"),
      `---
type: entity
---

# Foo`,
    );

    const idx = buildIndex(root);
    assert.equal(Object.keys(idx).length, 2, "two source URLs indexed");
    assert.ok(idx["https://example.com/foo"]);
    assert.equal(idx["https://example.com/foo"].slug, "2026-04-19-foo");
    assert.equal(idx["https://example.com/foo"].ingested_at, "2026-04-19");
    // bar URL got normalized (case + utm strip)
    assert.ok(idx["https://example.com/bar"]);
    assert.equal(idx["https://example.com/bar"].slug, "2026-04-20-bar");
  } finally {
    rmSync(root, { recursive: true });
  }
});

test("buildIndex: skips sources with empty raw_source", () => {
  const root = mkdtempSync(join(tmpdir(), "src-idx-empty-"));
  try {
    mkdirSync(join(root, "Sources/2026"), { recursive: true });
    writeFileSync(
      join(root, "Sources/2026/no-raw.md"),
      `---
type: source
---

# No raw source
`,
    );
    const idx = buildIndex(root);
    assert.equal(Object.keys(idx).length, 0);
  } finally {
    rmSync(root, { recursive: true });
  }
});
