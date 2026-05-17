import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { forget } from "../hirono/raindrop/forget.ts";

function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "forget-"));
  mkdirSync(join(root, "03_Sources", "2026"), { recursive: true });
  mkdirSync(join(root, "02_Entities", "_seen"), { recursive: true });
  mkdirSync(join(root, "00_Meta"), { recursive: true });
  return root;
}

function writeFile(root: string, repoPath: string, content: string): void {
  const abs = join(root, repoPath);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, content, "utf8");
}

test("forget: source-and-raw branch — deletes both + adds to skip-list", () => {
  const root = makeRepo();
  try {
    writeFile(root, "03_Sources/2026/test-slug.md", `---\ntype: source\n---\n\nBody.\n`);
    writeFile(root, "raw/raindrop/example.com/test-slug/content.md", "raw");
    writeFile(root, "raw/raindrop/example.com/test-slug/source.json",
      JSON.stringify({ origin_url: "https://example.com/x" }));

    const r = forget(root, "test-slug", { reason: "test cleanup" });
    assert.equal(r.branch, "source-and-raw");
    assert.equal(r.slug, "test-slug");
    assert.equal(r.url, "https://example.com/x");
    assert.equal(r.rawDeleted, true);
    assert.equal(r.skipKey, "https://example.com/x");

    assert.ok(!existsSync(join(root, "03_Sources/2026/test-slug.md")));
    assert.ok(!existsSync(join(root, "raw/raindrop/example.com/test-slug")));

    const skips = readFileSync(join(root, "00_Meta/sources-ingest-skips.md"), "utf8");
    assert.ok(skips.includes("- https://example.com/x — skip-reason=bookmarked-by-mistake · test cleanup"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("forget: raw-only branch (HSBC case) — no Source, just raw + skip-list", () => {
  const root = makeRepo();
  try {
    // No Source.md — only raw archive
    writeFile(root, "raw/raindrop/xhslink.com/hsbc-slug/content.md", "banking content");
    writeFile(root, "raw/raindrop/xhslink.com/hsbc-slug/source.json",
      JSON.stringify({ origin_url: "http://xhslink.com/o/27CkSMUziOq" }));

    const r = forget(root, "hsbc-slug", {
      skipReason: "bookmarked-by-mistake",
      reason: "Off-topic; banking content",
    });
    assert.equal(r.branch, "raw-only");
    assert.equal(r.rawDeleted, true);
    assert.equal(r.sourcePath, null);
    assert.ok(!existsSync(join(root, "raw/raindrop/xhslink.com/hsbc-slug")));

    const skips = readFileSync(join(root, "00_Meta/sources-ingest-skips.md"), "utf8");
    assert.ok(skips.includes("http://xhslink.com/o/27CkSMUziOq"));
    assert.ok(skips.includes("skip-reason=bookmarked-by-mistake"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("forget: neither branch — URL only, no local artifacts → just skip-list", () => {
  const root = makeRepo();
  try {
    const r = forget(root, "https://spam.example.com/x", { skipReason: "spam", reason: "recurring" });
    assert.equal(r.branch, "neither");
    assert.equal(r.url, "https://spam.example.com/x");
    assert.equal(r.skipKey, "https://spam.example.com/x");

    const skips = readFileSync(join(root, "00_Meta/sources-ingest-skips.md"), "utf8");
    assert.ok(skips.includes("- https://spam.example.com/x — skip-reason=spam · recurring"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("forget: accepts URL input + resolves to slug via raw archives", () => {
  const root = makeRepo();
  try {
    writeFile(root, "raw/raindrop/example.com/foo-slug/content.md", "x");
    writeFile(root, "raw/raindrop/example.com/foo-slug/source.json",
      JSON.stringify({ origin_url: "https://example.com/foo" }));

    const r = forget(root, "https://example.com/foo");
    assert.equal(r.branch, "raw-only");
    assert.equal(r.slug, "foo-slug");
    assert.equal(r.url, "https://example.com/foo");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("forget: appends to existing skip-list file", () => {
  const root = makeRepo();
  try {
    writeFile(root, "00_Meta/sources-ingest-skips.md", [
      "---", "type: meta", "---", "",
      "# Skips", "",
      "## Entries", "",
      "- https://existing.example.com — skip-reason=spam · already here",
      "",
    ].join("\n"));

    forget(root, "https://new.example.com", { skipReason: "deprecated", reason: "EOL site" });

    const skips = readFileSync(join(root, "00_Meta/sources-ingest-skips.md"), "utf8");
    assert.ok(skips.includes("- https://existing.example.com"));
    assert.ok(skips.includes("- https://new.example.com — skip-reason=deprecated"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
