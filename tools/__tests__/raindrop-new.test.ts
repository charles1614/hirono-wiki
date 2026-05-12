/**
 * Tests for `hirono raindrop new` (new-bookmarks subcommand).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { findNewBookmarks } from "../hirono/raindrop/new-bookmarks.ts";

test("findNewBookmarks: returns bookmarks not in the sources index", () => {
  const dir = mkdtempSync(join(tmpdir(), "raindrop-new-"));
  const cachePath = join(dir, "cache.json");
  const indexPath = join(dir, "index.json");

  writeFileSync(cachePath, JSON.stringify({
    bookmarks: [
      { bookmark_id: 1, link: "https://example.com/already-ingested", title: "Old" },
      { bookmark_id: 2, link: "https://example.com/new-post", title: "New", tags: ["tag1"] },
      { bookmark_id: 3, link: "https://example.com/another-new", title: "New2" },
    ],
  }));
  writeFileSync(indexPath, JSON.stringify({
    "https://example.com/already-ingested": {
      slug: "old-slug",
      repo_path: "Sources/2026/old-slug.md",
      source_url: "https://example.com/already-ingested",
    },
  }));

  const items = findNewBookmarks({ raindropCachePath: cachePath, sourcesIndexPath: indexPath });
  assert.equal(items.length, 2);
  assert.equal(items[0].id, "raindrop:2");
  assert.equal(items[0].url, "https://example.com/new-post");
  assert.deepEqual(items[0].tags, ["tag1"]);
  assert.equal(items[1].id, "raindrop:3");

  rmSync(dir, { recursive: true, force: true });
});

test("findNewBookmarks: empty index → all bookmarks new", () => {
  const dir = mkdtempSync(join(tmpdir(), "raindrop-new-"));
  const cachePath = join(dir, "cache.json");
  const indexPath = join(dir, "index.json");
  writeFileSync(cachePath, JSON.stringify({
    bookmarks: [
      { bookmark_id: 1, link: "https://a.com/x", title: "A" },
      { bookmark_id: 2, link: "https://b.com/y", title: "B" },
    ],
  }));
  writeFileSync(indexPath, "{}");
  const items = findNewBookmarks({ raindropCachePath: cachePath, sourcesIndexPath: indexPath });
  assert.equal(items.length, 2);
  rmSync(dir, { recursive: true, force: true });
});

test("findNewBookmarks: full overlap → empty result", () => {
  const dir = mkdtempSync(join(tmpdir(), "raindrop-new-"));
  const cachePath = join(dir, "cache.json");
  const indexPath = join(dir, "index.json");
  writeFileSync(cachePath, JSON.stringify({
    bookmarks: [{ bookmark_id: 1, link: "https://a.com/x", title: "A" }],
  }));
  writeFileSync(indexPath, JSON.stringify({
    "https://a.com/x": { slug: "a-x", repo_path: "Sources/a-x.md", source_url: "https://a.com/x" },
  }));
  const items = findNewBookmarks({ raindropCachePath: cachePath, sourcesIndexPath: indexPath });
  assert.equal(items.length, 0);
  rmSync(dir, { recursive: true, force: true });
});

test("findNewBookmarks: applies normalizeUrl (utm-stripped URLs match)", () => {
  const dir = mkdtempSync(join(tmpdir(), "raindrop-new-"));
  const cachePath = join(dir, "cache.json");
  const indexPath = join(dir, "index.json");
  // Bookmark URL has utm; index has the normalized form.
  writeFileSync(cachePath, JSON.stringify({
    bookmarks: [{ bookmark_id: 1, link: "https://blog.example.com/post?utm_source=newsletter" }],
  }));
  writeFileSync(indexPath, JSON.stringify({
    "https://blog.example.com/post": {
      slug: "blog-post",
      repo_path: "Sources/blog-post.md",
      source_url: "https://blog.example.com/post",
    },
  }));
  const items = findNewBookmarks({ raindropCachePath: cachePath, sourcesIndexPath: indexPath });
  assert.equal(items.length, 0, "utm-stripped URL should match the indexed normalized URL");
  rmSync(dir, { recursive: true, force: true });
});
