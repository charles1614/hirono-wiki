/**
 * Tests for `hirono raindrop status` and the failure-kind classifier.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  classifyFromInput,
  classify,
  parseOverrides,
  isFailureKind,
  ALL_KINDS,
} from "../hirono/raindrop/failure-kind.ts";
import { buildStatusRows } from "../hirono/raindrop/status.ts";

// ─────────────────────────── failure-kind.ts ─────────────────────────

test("classifyFromInput: not yet fetched → not-yet-fetched", () => {
  const k = classifyFromInput({ url: "https://example.com/post", isFetched: false });
  assert.equal(k, "not-yet-fetched");
});

test("classifyFromInput: malformed URL", () => {
  const k = classifyFromInput({ url: "not a url", isFetched: false });
  assert.equal(k, "host-malformed");
});

test("classifyFromInput: LAN IP (10.x)", () => {
  const k = classifyFromInput({ url: "http://10.0.62.21:58990/", isFetched: true });
  assert.equal(k, "host-lan-only");
});

test("classifyFromInput: LAN IP (8.163.x)", () => {
  const k = classifyFromInput({ url: "https://8.163.30.186/", isFetched: true });
  assert.equal(k, "host-lan-only");
});

test("classifyFromInput: PDF URL", () => {
  const k = classifyFromInput({ url: "https://openreview.net/pdf?id=abc", isFetched: true });
  assert.equal(k, "upstream-not-html");
});

test("classifyFromInput: app-store URL", () => {
  const k = classifyFromInput({ url: "https://itunes.apple.com/cn/app/id741292507", isFetched: true });
  assert.equal(k, "upstream-not-html");
});

test("classifyFromInput: feishu auth-gated stub", () => {
  const k = classifyFromInput({
    url: "https://foo.feishu.cn/wiki/abc",
    isFetched: true,
    quality_status: "flagged",
    flags: ["intentional-stub", "feishu-auth-gated"],
  });
  assert.equal(k, "upstream-auth-gated");
});

test("classifyFromInput: x-twitter auth-required stub", () => {
  const k = classifyFromInput({
    url: "https://x.com/user/status/123",
    isFetched: true,
    flags: ["intentional-stub", "x-twitter-auth-required"],
  });
  assert.equal(k, "upstream-auth-gated");
});

test("classifyFromInput: reddit deleted stub", () => {
  const k = classifyFromInput({
    url: "https://reddit.com/r/X/s/Y",
    isFetched: true,
    flags: ["intentional-stub", "reddit-deleted"],
  });
  assert.equal(k, "upstream-deleted");
});

test("classifyFromInput: huggingface space stub", () => {
  const k = classifyFromInput({
    url: "https://huggingface.co/spaces/x/y",
    isFetched: true,
    flags: ["intentional-stub", "huggingface-space"],
  });
  assert.equal(k, "intentional-stub-app-only");
});

test("classifyFromInput: _default fetch failed (SPA)", () => {
  // Use a non-bare-domain URL — bare-domain `leetgpu.com` would
  // route to `intentional-stub-app-only` via the P-18 URL-pattern
  // refinement (homepage bookmark intent IS the site).
  const k = classifyFromInput({
    url: "https://leetgpu.com/problems/quicksort",
    isFetched: true,
    flags: ["intentional-stub", "_default-fetch-failed"],
  });
  assert.equal(k, "upstream-spa-no-content");
});

test("classifyFromInput: bare-domain SPA stub → intentional-stub-app-only (P-18 refinement)", () => {
  const k = classifyFromInput({
    url: "https://hjfy.top/",
    isFetched: true,
    flags: ["intentional-stub", "_default-fetch-failed"],
  });
  assert.equal(k, "intentional-stub-app-only");
});

test("classifyFromInput: search-results URL with flags → intentional-stub-app-only (P-18 refinement)", () => {
  const k = classifyFromInput({
    url: "https://open-vsx.org/?search=claude%20code",
    isFetched: true,
    flags: ["images-declared-but-none-downloaded", "_default-image-download-partial"],
  });
  assert.equal(k, "intentional-stub-app-only");
});

test("classifyFromInput: bare-domain with ONLY marker flags stays clean (P-18 marker-flag exclusion)", () => {
  // _default-used-browser-fallback is informational (records which path
  // won), not a quality issue. A bare-domain URL extracted cleanly via
  // browser-eval should classify as `clean` — the marker flag must NOT
  // trip the URL-pattern app-only reclassification.
  const k = classifyFromInput({
    url: "https://ai.meta.com/",   // bare-domain (will hit looksLikeAppShapedUrl)
    isFetched: true,
    flags: ["_default-used-browser-fallback"],
  });
  assert.equal(k, "clean");
});

test("classifyFromInput: bare-domain CLEAN extraction stays clean (no flag flip)", () => {
  const k = classifyFromInput({
    url: "https://lilianweng.github.io/",
    isFetched: true,
    flags: [],
  });
  assert.equal(k, "clean");
});

test("classifyFromInput: paywall host (economictimes)", () => {
  const k = classifyFromInput({
    url: "https://economictimes.indiatimes.com/foo",
    isFetched: true,
    quality_status: "good",
    flags: [],
  });
  assert.equal(k, "upstream-paywall");
});

test("classifyFromInput: image-download-partial", () => {
  const k = classifyFromInput({
    url: "https://example.com/post",
    isFetched: true,
    quality_status: "flagged",
    flags: ["substack-image-download-partial"],
  });
  assert.equal(k, "content-incomplete-images");
});

test("classifyFromInput: images-declared-but-none-downloaded", () => {
  const k = classifyFromInput({
    url: "https://example.com/post",
    isFetched: true,
    quality_status: "flagged",
    flags: ["images-declared-but-none-downloaded"],
  });
  assert.equal(k, "content-incomplete-images-zero");
});

test("classifyFromInput: short-body", () => {
  const k = classifyFromInput({
    url: "https://example.com/post",
    isFetched: true,
    quality_status: "flagged",
    flags: ["short-body"],
  });
  assert.equal(k, "content-too-short");
});

test("classifyFromInput: clean (no flags)", () => {
  const k = classifyFromInput({
    url: "https://blog.example.com/post",
    isFetched: true,
    quality_status: "good",
    flags: [],
  });
  assert.equal(k, "clean");
});

test("isFailureKind: validates known + rejects unknown", () => {
  assert.equal(isFailureKind("clean"), true);
  assert.equal(isFailureKind("upstream-auth-gated"), true);
  assert.equal(isFailureKind("not-a-kind"), false);
  assert.equal(isFailureKind(""), false);
});

test("ALL_KINDS contains all 16 kinds, no duplicates", () => {
  assert.equal(ALL_KINDS.length, 16);
  assert.equal(new Set(ALL_KINDS).size, 16);
});

// ─────────────────────────── parseOverrides ─────────────────────────

test("parseOverrides: parses 'pin-kind=' lines, ignores noise", () => {
  const dir = mkdtempSync(join(tmpdir(), "overrides-"));
  const path = join(dir, "overrides.md");
  writeFileSync(path, `---
type: meta
---

# Overrides

## 2026-05-08

- abc-slug: pin-kind=upstream-paywall   # NYT article
- def-slug: pin-kind=clean
- noise line that should not match
- bad-slug: pin-kind=not-a-kind
- whitespace-slug:    pin-kind=upstream-deleted
`);
  const m = parseOverrides(path);
  assert.equal(m.size, 3);
  assert.equal(m.get("abc-slug")?.pinKind, "upstream-paywall");
  assert.equal(m.get("abc-slug")?.comment, "NYT article");
  assert.equal(m.get("def-slug")?.pinKind, "clean");
  assert.equal(m.get("whitespace-slug")?.pinKind, "upstream-deleted");
  assert.equal(m.get("bad-slug"), undefined);
  rmSync(dir, { recursive: true, force: true });
});

test("classify: pinned override wins over auto-classifier", () => {
  const overrides = new Map([["my-slug", { slug: "my-slug", pinKind: "clean" as const }]]);
  const c = classify({
    url: "https://example.com/post",
    slug: "my-slug",
    isFetched: true,
    flags: ["short-body"],
  }, overrides);
  assert.equal(c.kind, "clean");
  assert.equal(c.pinned, true);
});

test("classify: no override → auto-classifier wins", () => {
  const overrides = new Map();
  const c = classify({
    url: "https://example.com/post",
    isFetched: true,
    flags: ["short-body"],
    quality_status: "flagged",
  }, overrides);
  assert.equal(c.kind, "content-too-short");
  assert.equal(c.pinned, false);
});

// ─────────────────────────── buildStatusRows ─────────────────────────

test("buildStatusRows: joins cache + index + raw correctly", () => {
  const dir = mkdtempSync(join(tmpdir(), "status-"));
  const cachePath = join(dir, "cache.json");
  const indexPath = join(dir, "index.json");
  const rawDir = join(dir, "raw");
  const overridesPath = join(dir, "overrides.md");

  writeFileSync(cachePath, JSON.stringify({
    bookmarks: [
      { bookmark_id: 1, link: "https://blog.example.com/post1", title: "Post 1" },
      { bookmark_id: 2, link: "https://x.com/user/status/123", title: "X" },
      { bookmark_id: 3, link: "https://not-yet-fetched.com/article", title: "New" },
      { bookmark_id: 4, link: "http://10.0.0.1:8080/internal", title: "LAN" },
    ],
  }));

  writeFileSync(indexPath, JSON.stringify({
    "https://blog.example.com/post1": {
      slug: "2026-05-08-blog-post1",
      repo_path: "03_Sources/2026/2026-05-08-blog-post1.md",
      source_url: "https://blog.example.com/post1",
      ingested_at: "2026-05-08",
    },
    "https://x.com/user/status/123": {
      slug: "x-status-123",
      repo_path: "03_Sources/2026/x-status-123.md",
      source_url: "https://x.com/user/status/123",
      ingested_at: "2026-05-08",
    },
  }));

  // Build a fake raw/raindrop/<host>/<slug>/source.json for two slugs
  mkdirSync(join(rawDir, "raindrop", "blog.example.com", "2026-05-08-blog-post1"), { recursive: true });
  writeFileSync(join(rawDir, "raindrop", "blog.example.com", "2026-05-08-blog-post1", "content.md"), "# Post 1\n");
  writeFileSync(join(rawDir, "raindrop", "blog.example.com", "2026-05-08-blog-post1", "source.json"), JSON.stringify({
    fetched_at: "2026-05-08T12:00:00Z",
    origin: "url:https://blog.example.com/post1",
    origin_url: "https://blog.example.com/post1",
    fetcher: "opencli",
    fetcher_reason: "direct",
    content_sha: "abc",
    content_length: 5000,
    quality_flags: [],
    quality_status: "good",
    images: [],
    notes: [],
  }));

  mkdirSync(join(rawDir, "raindrop", "x.com", "x-status-123"), { recursive: true });
  writeFileSync(join(rawDir, "raindrop", "x.com", "x-status-123", "content.md"), "# Stub\n");
  writeFileSync(join(rawDir, "raindrop", "x.com", "x-status-123", "source.json"), JSON.stringify({
    fetched_at: "2026-05-08T12:00:00Z",
    origin: "url:https://x.com/user/status/123",
    origin_url: "https://x.com/user/status/123",
    fetcher: "opencli",
    fetcher_reason: "domain-override",
    content_sha: "def",
    content_length: 500,
    quality_flags: ["intentional-stub", "x-twitter-auth-required"],
    quality_status: "flagged",
    images: [],
    notes: [],
  }));

  const rows = buildStatusRows({
    raindropCachePath: cachePath,
    sourcesIndexPath: indexPath,
    overridesPath,
    rawDir,
  });

  assert.equal(rows.length, 4);
  const byKind = new Map(rows.map(r => [r.kind, r]));

  assert.ok(byKind.has("clean"), "blog post should be clean");
  assert.equal(byKind.get("clean")!.slug, "2026-05-08-blog-post1");

  assert.ok(byKind.has("upstream-auth-gated"), "x.com stub should be auth-gated");
  assert.ok(byKind.has("not-yet-fetched"), "untouched URL should be not-yet-fetched");
  assert.ok(byKind.has("host-lan-only"), "LAN IP should be host-lan-only");

  rmSync(dir, { recursive: true, force: true });
});

test("buildStatusRows: share-aggregator bookmark resolves to slug stored under unwrapped target (P-32)", () => {
  // P-32 unwraps `share.google?link=https://linux.do/t/topic/N` at fetch
  // time, so the resulting slug lives under raw/raindrop/linux.do/ with
  // origin_url = the unwrapped target. The cache still carries the
  // wrapper URL as `b.link`. The status join MUST try
  // `unwrapShareUrl(b.link).unwrapped` against rawByUrl, otherwise the
  // bookmark looks unfetched and the slug looks orphan — the "ghost"
  // failure mode where one bookmark + one slug surface as two opposing
  // problems. See P-32 in 00_Meta/site-handling-patterns.md.
  const dir = mkdtempSync(join(tmpdir(), "status-"));
  const cachePath = join(dir, "cache.json");
  const indexPath = join(dir, "index.json");
  const rawDir = join(dir, "raw");
  const overridesPath = join(dir, "overrides.md");

  // Cache: bookmark is the wrapper URL (with utm tracking on the outside).
  writeFileSync(cachePath, JSON.stringify({
    bookmarks: [
      {
        bookmark_id: 99,
        link: "https://share.google?link=https://linux.do/t/topic/537374&utm_campaign=share-sdl",
        title: "wrapped",
      },
    ],
  }));
  writeFileSync(indexPath, JSON.stringify({}));

  // Slug landed under the unwrapped target's host.
  mkdirSync(join(rawDir, "raindrop", "linux.do", "2025-06-09-shared-topic-537374"), { recursive: true });
  writeFileSync(
    join(rawDir, "raindrop", "linux.do", "2025-06-09-shared-topic-537374", "content.md"),
    "# Topic 537374\n",
  );
  writeFileSync(
    join(rawDir, "raindrop", "linux.do", "2025-06-09-shared-topic-537374", "source.json"),
    JSON.stringify({
      fetched_at: "2025-06-09T00:00:00Z",
      origin: "url:https://linux.do/t/topic/537374",
      origin_url: "https://linux.do/t/topic/537374",
      fetcher: "opencli",
      fetcher_reason: "direct",
      content_sha: "z",
      content_length: 1500,
      quality_flags: [],
      quality_status: "good",
      images: [],
      notes: [],
    }),
  );

  const rows = buildStatusRows({
    raindropCachePath: cachePath,
    sourcesIndexPath: indexPath,
    overridesPath,
    rawDir,
  });

  // Exactly one row — bookmark+slug joined, no ghost orphan.
  assert.equal(rows.length, 1, `expected 1 row (bookmark+slug joined), got ${rows.length}`);
  const r = rows[0];
  assert.equal(r.url, "https://share.google?link=https://linux.do/t/topic/537374&utm_campaign=share-sdl");
  assert.equal(r.kind, "clean", `expected clean, got ${r.kind} (status join failed to follow unwrap)`);
  assert.equal(r.last_fetched, "2025-06-09T00:00:00Z");
  assert.ok(!/orphan/.test(r.advice ?? ""), "row should not be flagged as orphan");
  rmSync(dir, { recursive: true, force: true });
});

test("buildStatusRows: orphan raw slug surfaces as orphan with [orphan: ...] advice prefix", () => {
  const dir = mkdtempSync(join(tmpdir(), "status-"));
  const cachePath = join(dir, "cache.json");
  const indexPath = join(dir, "index.json");
  const rawDir = join(dir, "raw");
  const overridesPath = join(dir, "overrides.md");

  // Empty bookmark cache
  writeFileSync(cachePath, JSON.stringify({ bookmarks: [] }));
  writeFileSync(indexPath, JSON.stringify({}));

  // raw/ has a slug not in the cache
  mkdirSync(join(rawDir, "raindrop", "deleted-bookmark.com", "orphan-slug"), { recursive: true });
  writeFileSync(join(rawDir, "raindrop", "deleted-bookmark.com", "orphan-slug", "content.md"), "# Orphan\n");
  writeFileSync(join(rawDir, "raindrop", "deleted-bookmark.com", "orphan-slug", "source.json"), JSON.stringify({
    fetched_at: "2026-04-01T00:00:00Z",
    origin: "url:https://deleted-bookmark.com/post",
    origin_url: "https://deleted-bookmark.com/post",
    fetcher: "opencli",
    fetcher_reason: "direct",
    content_sha: "x",
    content_length: 5000,
    quality_flags: [],
    quality_status: "good",
    images: [],
    notes: [],
  }));

  const rows = buildStatusRows({
    raindropCachePath: cachePath,
    sourcesIndexPath: indexPath,
    overridesPath,
    rawDir,
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].slug, "orphan-slug");
  assert.match(rows[0].advice, /orphan: bookmark deleted from Raindrop/);
  rmSync(dir, { recursive: true, force: true });
});
