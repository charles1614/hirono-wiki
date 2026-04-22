import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readSourceIndexStrict,
  writeSourceIndex,
  IndexCorruptedError,
} from "../build-sources-index.ts";
import { runLint } from "../lint.ts";

// ---------------------------------------------------------------------------
// readSourceIndexStrict
// ---------------------------------------------------------------------------

test("readSourceIndexStrict: returns {} if file does not exist", () => {
  const dir = mkdtempSync(join(tmpdir(), "srcidx-"));
  try {
    const result = readSourceIndexStrict(join(dir, "missing.json"));
    assert.deepEqual(result, {});
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readSourceIndexStrict: parses valid index", () => {
  const dir = mkdtempSync(join(tmpdir(), "srcidx-"));
  try {
    const path = join(dir, "idx.json");
    writeFileSync(path, JSON.stringify({
      "https://example.com/a": {
        slug: "2026-04-19-a",
        repo_path: "Sources/2026/2026-04-19-a.md",
        raw_source: "https://example.com/a",
        ingested_at: "2026-04-19",
      },
    }));
    const result = readSourceIndexStrict(path);
    assert.equal(Object.keys(result).length, 1);
    assert.equal(result["https://example.com/a"].slug, "2026-04-19-a");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readSourceIndexStrict: throws IndexCorruptedError on garbage", () => {
  const dir = mkdtempSync(join(tmpdir(), "srcidx-"));
  try {
    const path = join(dir, "idx.json");
    writeFileSync(path, "not json {{{{{");
    assert.throws(
      () => readSourceIndexStrict(path),
      (err: unknown) => {
        assert.ok(err instanceof IndexCorruptedError);
        assert.equal((err as IndexCorruptedError).path, path);
        assert.ok((err as IndexCorruptedError).fileSize > 0);
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readSourceIndexStrict: throws IndexCorruptedError on zero-byte file", () => {
  const dir = mkdtempSync(join(tmpdir(), "srcidx-"));
  try {
    const path = join(dir, "idx.json");
    writeFileSync(path, "");
    assert.throws(
      () => readSourceIndexStrict(path),
      IndexCorruptedError,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readSourceIndexStrict: throws if top-level is an array, not object", () => {
  const dir = mkdtempSync(join(tmpdir(), "srcidx-"));
  try {
    const path = join(dir, "idx.json");
    writeFileSync(path, JSON.stringify([1, 2, 3]));
    assert.throws(
      () => readSourceIndexStrict(path),
      IndexCorruptedError,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readSourceIndexStrict: throws if top-level is null", () => {
  const dir = mkdtempSync(join(tmpdir(), "srcidx-"));
  try {
    const path = join(dir, "idx.json");
    writeFileSync(path, "null");
    assert.throws(
      () => readSourceIndexStrict(path),
      IndexCorruptedError,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// writeSourceIndex: .bak backup + atomic
// ---------------------------------------------------------------------------

test("writeSourceIndex: creates .bak of prior version", () => {
  const dir = mkdtempSync(join(tmpdir(), "srcidx-"));
  try {
    const path = join(dir, "idx.json");
    const v1 = { "url-1": { slug: "s1", repo_path: "x/s1.md", raw_source: "url-1", ingested_at: "2026-01-01" } };
    const v2 = { "url-2": { slug: "s2", repo_path: "x/s2.md", raw_source: "url-2", ingested_at: "2026-02-01" } };
    writeSourceIndex(path, v1);
    assert.equal(existsSync(`${path}.bak`), false, "first write: no bak (nothing to back up)");

    writeSourceIndex(path, v2);
    assert.ok(existsSync(`${path}.bak`), "second write: .bak should exist");

    const bakContent = JSON.parse(readFileSync(`${path}.bak`, "utf8"));
    assert.equal(Object.keys(bakContent)[0], "url-1", "bak holds prior version");

    const currentContent = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(Object.keys(currentContent)[0], "url-2", "current holds new version");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// lint sources-index check
// ---------------------------------------------------------------------------

function makeMinimalRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "lint-srcidx-"));
  mkdirSync(join(root, "Sources", "2026"), { recursive: true });
  mkdirSync(join(root, "raw", "2026", "2026-04-19-a"), { recursive: true });
  writeFileSync(join(root, "raw", "2026", "2026-04-19-a", "content.md"), "body");
  writeFileSync(join(root, "Sources", "2026", "2026-04-19-a.md"), [
    "---",
    "type: source",
    "created: 2026-04-19",
    "updated: 2026-04-19",
    "raw_source: https://example.com/a",
    "---",
    "# A",
  ].join("\n"));
  return root;
}

test("lint sources-index: no file -> clean", () => {
  const root = makeMinimalRepo();
  try {
    const issues = runLint(root, { checks: ["sources-index"] });
    assert.equal(issues.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("lint sources-index: parseable + consistent -> clean", () => {
  const root = makeMinimalRepo();
  try {
    writeFileSync(join(root, ".wiki-sources-index.json"), JSON.stringify({
      "https://example.com/a": {
        slug: "2026-04-19-a",
        repo_path: "Sources/2026/2026-04-19-a.md",
        raw_source: "https://example.com/a",
        ingested_at: "2026-04-19",
      },
    }));
    const issues = runLint(root, { checks: ["sources-index"] });
    assert.equal(issues.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("lint sources-index: corrupt JSON -> error issue", () => {
  const root = makeMinimalRepo();
  try {
    writeFileSync(join(root, ".wiki-sources-index.json"), "not json");
    const issues = runLint(root, { checks: ["sources-index"] });
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, "error");
    assert.match(issues[0].detail, /parse/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("lint sources-index: stale repo_path -> warn issue", () => {
  const root = makeMinimalRepo();
  try {
    writeFileSync(join(root, ".wiki-sources-index.json"), JSON.stringify({
      "https://example.com/gone": {
        slug: "2026-04-19-gone",
        repo_path: "Sources/2026/2026-04-19-gone.md",
        raw_source: "https://example.com/gone",
        ingested_at: "2026-04-19",
      },
    }));
    const issues = runLint(root, { checks: ["sources-index"] });
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, "warn");
    assert.match(issues[0].detail, /missing file/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("lint sources-index: array as top-level -> error issue", () => {
  const root = makeMinimalRepo();
  try {
    writeFileSync(join(root, ".wiki-sources-index.json"), "[1, 2, 3]");
    const issues = runLint(root, { checks: ["sources-index"] });
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, "error");
    assert.match(issues[0].detail, /not a JSON object/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
