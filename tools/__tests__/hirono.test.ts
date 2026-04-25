/**
 * Unit tests for the hirono CLI. Focuses on pure-function units:
 *   - post-process.ts (each processor + pipeline composition)
 *   - check.ts buildReport (against fixtures)
 *   - export.ts resolveIdentifier (ID/URL/slug dispatch)
 *
 * No I/O against opencli or the Raindrop API — those are integration
 * surfaces tested manually.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  resolveRelativeImageUrls,
  deepwikiStripNav,
  githubStripUIChrome,
  anthropicStripSvgExplosion,
  stripColorTags,
  extractRelativeImageRefs,
  resolveAgainstOrigin,
  applyPostProcessors,
  PROCESSORS,
} from "../hirono/shared/post-process.ts";
import { buildReport, formatReport, type Cache } from "../hirono/raindrop/check.ts";
import { resolveIdentifier } from "../hirono/raindrop/export.ts";
import { slugifyTitle, deriveSlug, buildPlan } from "../hirono/raindrop/fetch-all.ts";

// ---------------------------------------------------------------------------
// extractRelativeImageRefs
// ---------------------------------------------------------------------------

test("extractRelativeImageRefs: ![]() markdown with relative paths", () => {
  const md = `
Text.

![x](/images/foo.png)
![y](/images/bar.jpg "title")
![z](https://absolute.example.com/img.png)
`;
  const refs = extractRelativeImageRefs(md);
  assert.deepEqual(refs.sort(), ["/images/bar.jpg", "/images/foo.png"]);
});

test("extractRelativeImageRefs: HTML <img> with src", () => {
  const md = `<img src="/a.png" alt="a"> and <img src='https://x.com/b.jpg'>`;
  const refs = extractRelativeImageRefs(md);
  assert.deepEqual(refs, ["/a.png"]);
});

test("extractRelativeImageRefs: ignores fenced code blocks", () => {
  const md = [
    "![real](/real.png)",
    "```",
    "![nope](/nope.png)",
    "```",
  ].join("\n");
  assert.deepEqual(extractRelativeImageRefs(md), ["/real.png"]);
});

test("extractRelativeImageRefs: SKIPS bare `images/...` local artifact refs", () => {
  // opencli adapters save images to a local `images/` subdir and emit
  // `images/img_NNN.png` refs. Those are local files, not web URLs.
  const md = `
![local](images/img_001.png)
![also local](figure-1.png)
![web](/static/x.png)
![explicit rel](./foo.png)
  `;
  const refs = extractRelativeImageRefs(md);
  assert.deepEqual(refs.sort(), ["./foo.png", "/static/x.png"]);
});

test("extractRelativeImageRefs: skips data: URIs", () => {
  const md = `![inline](data:image/png;base64,iVBORw0K...)\n![real](/real.png)`;
  assert.deepEqual(extractRelativeImageRefs(md), ["/real.png"]);
});

// ---------------------------------------------------------------------------
// resolveAgainstOrigin
// ---------------------------------------------------------------------------

test("resolveAgainstOrigin: absolute stays absolute", () => {
  assert.equal(
    resolveAgainstOrigin("https://x.com/img.png", "https://y.com/post"),
    "https://x.com/img.png",
  );
});

test("resolveAgainstOrigin: root-relative → absolute against origin", () => {
  assert.equal(
    resolveAgainstOrigin("/images/foo.png", "https://lmsys.org/blog/post"),
    "https://lmsys.org/images/foo.png",
  );
});

test("resolveAgainstOrigin: protocol-relative // → https://", () => {
  assert.equal(
    resolveAgainstOrigin("//cdn.example.com/a.png", "https://x.com/y"),
    "https://cdn.example.com/a.png",
  );
});

test("resolveAgainstOrigin: relative resolves against the URL path", () => {
  assert.equal(
    resolveAgainstOrigin("./img.png", "https://x.com/a/b/page"),
    "https://x.com/a/b/img.png",
  );
});

// ---------------------------------------------------------------------------
// resolveRelativeImageUrls processor
// ---------------------------------------------------------------------------

test("resolveRelativeImageUrls: emits absolute URLs + rewrites markdown", () => {
  const md = `Body.\n\n![diagram](/images/blog/novita-glm4/diagram.png)\n\n<img src="/assets/x.jpg">`;
  const r = resolveRelativeImageUrls.transform(md, "https://lmsys.org/blog/2026-01-21-novita-glm4/");
  assert.equal(r.newAbsoluteImageUrls.length, 2);
  assert.ok(r.newAbsoluteImageUrls.includes("https://lmsys.org/images/blog/novita-glm4/diagram.png"));
  assert.ok(r.newAbsoluteImageUrls.includes("https://lmsys.org/assets/x.jpg"));
  assert.ok(r.md.includes("https://lmsys.org/images/blog/novita-glm4/diagram.png"));
  assert.ok(!r.md.includes("(/images/blog/novita-glm4/diagram.png)"));
});

test("resolveRelativeImageUrls: no-op when all URLs absolute", () => {
  const md = `![a](https://x.com/a.png)`;
  const r = resolveRelativeImageUrls.transform(md, "https://origin.com/");
  assert.equal(r.newAbsoluteImageUrls.length, 0);
  assert.equal(r.md, md);
});

// ---------------------------------------------------------------------------
// deepwikiStripNav
// ---------------------------------------------------------------------------

test("deepwikiStripNav: strips file-navigator chrome up through Edit", () => {
  const md = [
    "# DeepWiki",
    "",
    "> 原文链接: https://wiki.litenext.digital/wiki/slime?file=01-overview",
    "",
    "---",
    "### Files",
    "",
    "← Back",
    "",
    "-   01-overview",
    "",
    "-   02-system-architecture",
    "",
    "# slime",
    "",
    "Viewing: 01-overview",
    "",
    "Edit",
    "",
    "# Overview and Core Concepts",
    "",
    "Real article body starts here.",
  ].join("\n");
  const r = deepwikiStripNav.transform(md, "https://wiki.litenext.digital/wiki/slime?file=01-overview");
  assert.ok(!r.md.includes("### Files"));
  assert.ok(!r.md.includes("← Back"));
  assert.ok(!r.md.includes("Viewing: 01-overview"));
  assert.ok(r.md.includes("# Overview and Core Concepts"));
  assert.ok(r.md.includes("Real article body starts here."));
  assert.ok(r.notes[0]?.startsWith("deepwiki: stripped"));
});

test("deepwikiStripNav: no-op when pattern absent", () => {
  const md = "# Regular article\n\nBody.";
  const r = deepwikiStripNav.transform(md, "https://wiki.litenext.digital/x");
  assert.equal(r.md, md);
  assert.deepEqual(r.notes, []);
});

test("deepwikiStripNav: only runs for wiki.litenext.digital", () => {
  assert.equal(deepwikiStripNav.match("https://example.com/", "example.com"), false);
  assert.equal(deepwikiStripNav.match("https://wiki.litenext.digital/x", "wiki.litenext.digital"), true);
});

// ---------------------------------------------------------------------------
// githubStripUIChrome
// ---------------------------------------------------------------------------

test("githubStripUIChrome: removes known UI chrome lines", () => {
  const md = [
    "# PR title",
    "",
    "## Pull Request Toolbar",
    "",
    "Expand file treeCollapse file tree",
    "",
    "0 / 3 viewed",
    "",
    "Submit commentsComments",
    "",
    "Real diff content.",
    "",
    "+12Lines changed: 12 additions & 0 deletions",
    "",
    "Actual review comment.",
  ].join("\n");
  const r = githubStripUIChrome.transform(md, "https://github.com/x/y/pull/1");
  assert.ok(!r.md.includes("Pull Request Toolbar"));
  assert.ok(!r.md.includes("Expand file tree"));
  assert.ok(!r.md.includes("0 / 3 viewed"));
  assert.ok(!r.md.includes("Submit commentsComments"));
  assert.ok(!r.md.includes("Lines changed: 12"));
  assert.ok(r.md.includes("Real diff content."));
  assert.ok(r.md.includes("Actual review comment."));
  assert.match(r.notes[0] ?? "", /stripped \d+ UI-chrome lines/);
});

test("githubStripUIChrome: only runs for github PR/issue/discussion URLs", () => {
  // Match was tightened to PR/issue/discussion URL paths only — running the
  // dup-H1 strip on raw README content (blob/tree/repo) wiped real subtitle
  // + badges + intro between frontmatter and the first H2. See fetch-raw.ts
  // augmentGithubPrIssueWithApi for the conversation-style URL shapes that
  // legitimately have GitHub UI chrome to strip.
  assert.equal(githubStripUIChrome.match("https://example.com/", "example.com"), false);
  // Bare repo URL no longer matches — chrome strip would corrupt README content.
  assert.equal(githubStripUIChrome.match("https://github.com/x/y/", "github.com"), false);
  // PR / issue / discussion URLs DO match (real conversation-style chrome).
  assert.equal(githubStripUIChrome.match("https://github.com/x/y/pull/123", "github.com"), true);
  assert.equal(githubStripUIChrome.match("https://github.com/x/y/issues/45", "github.com"), true);
  assert.equal(githubStripUIChrome.match("https://github.com/x/y/discussions/9", "github.com"), true);
});

// ---------------------------------------------------------------------------
// anthropicStripSvgExplosion
// ---------------------------------------------------------------------------

test("anthropicStripSvgExplosion: collapses 8+ short-line blocks into placeholder", () => {
  const md = [
    "Intro text.",
    "",
    "How",
    "",
    "Anthropic",
    "",
    "teams",
    "",
    "use",
    "",
    "Claude",
    "",
    "Code",
    "",
    "is",
    "",
    "amazing",
    "",
    "Back to regular paragraphs with many more than four words per line.",
  ].join("\n");
  const r = anthropicStripSvgExplosion.transform(md, "https://anthropic.com/blog/x");
  assert.ok(r.md.includes("[SVG figure — see source for visual content]"));
  assert.ok(!r.md.includes("How\n\nAnthropic\n\nteams"));
  assert.ok(r.md.includes("Back to regular paragraphs"));
  assert.equal(r.notes[0], "anthropic: collapsed 1 exploded-SVG text block(s)");
});

test("anthropicStripSvgExplosion: leaves short lists alone (not 8+ run)", () => {
  const md = [
    "Lead para.",
    "",
    "point one",
    "",
    "point two",
    "",
    "point three",
    "",
    "back to prose.",
  ].join("\n");
  const r = anthropicStripSvgExplosion.transform(md, "https://anthropic.com/");
  assert.ok(!r.md.includes("[SVG figure"));
  assert.deepEqual(r.notes, []);
});

// ---------------------------------------------------------------------------
// stripColorTags
// ---------------------------------------------------------------------------

test("stripColorTags: removes <text color=...> but keeps inner text", () => {
  const md = `See <text color="blue">item 1</text> and <text color='red'>item 2</text>.`;
  const r = stripColorTags.transform(md, "https://x.com/");
  assert.equal(r.md, `See item 1 and item 2.`);
  assert.match(r.notes[0] ?? "", /stripped \d+ chars/);
});

test("stripColorTags: no-op on clean markdown", () => {
  const md = `Plain markdown with no HTML.`;
  const r = stripColorTags.transform(md, "https://x.com/");
  assert.equal(r.md, md);
  assert.deepEqual(r.notes, []);
});

// ---------------------------------------------------------------------------
// applyPostProcessors pipeline
// ---------------------------------------------------------------------------

test("applyPostProcessors: composes DeepWiki strip + generic resolver", () => {
  const md = [
    "### Files",
    "",
    "← Back",
    "",
    "-   01-overview",
    "",
    "# repo",
    "",
    "Viewing: 01",
    "",
    "Edit",
    "",
    "# Article",
    "",
    "Body with ![diag](/assets/d.png).",
  ].join("\n");
  const r = applyPostProcessors(md, "https://wiki.litenext.digital/wiki/repo?file=01");
  assert.ok(!r.md.includes("### Files"));
  assert.ok(r.md.includes("https://wiki.litenext.digital/assets/d.png"));
  assert.ok(r.appliedNames.includes("deepwiki-strip-file-nav"));
  assert.ok(r.appliedNames.includes("resolve-relative-image-urls"));
  assert.equal(r.newAbsoluteImageUrls.length, 1);
});

test("applyPostProcessors: runs match-filtered processors only", () => {
  const md = `![](/img.png)`;
  const r = applyPostProcessors(md, "https://example.com/");
  // deepwiki + github + anthropic processors should be skipped; resolver + color-tags should run
  assert.ok(!r.appliedNames.includes("deepwiki-strip-file-nav"));
  assert.ok(!r.appliedNames.includes("github-strip-ui-chrome"));
  assert.ok(!r.appliedNames.includes("anthropic-strip-svg-explosion"));
});

test("PROCESSORS pipeline order: site-specific strips come before generic resolver", () => {
  const dwIdx = PROCESSORS.findIndex((p) => p.name === "deepwiki-strip-file-nav");
  const ghIdx = PROCESSORS.findIndex((p) => p.name === "github-strip-ui-chrome");
  const resolveIdx = PROCESSORS.findIndex((p) => p.name === "resolve-relative-image-urls");
  const colorIdx = PROCESSORS.findIndex((p) => p.name === "strip-color-tags");
  assert.ok(dwIdx < resolveIdx, "deepwiki strip should run before URL resolver");
  assert.ok(ghIdx < resolveIdx, "github strip should run before URL resolver");
  assert.ok(resolveIdx < colorIdx, "URL resolver should run before color-tag strip");
});

// ---------------------------------------------------------------------------
// buildReport (check.ts)
// ---------------------------------------------------------------------------

test("buildReport: detects duplicate URLs across bookmark IDs", () => {
  const cache: Cache = {
    fetched_at: "2026-04-21T00:00:00Z",
    total: 3,
    bookmarks: [
      { bookmark_id: 1, title: "A", link: "https://example.com/post" },
      { bookmark_id: 2, title: "A copy", link: "https://example.com/post" },
      { bookmark_id: 3, title: "B", link: "https://example.com/different" },
    ],
  };
  const r = buildReport(cache);
  assert.equal(r.duplicates.length, 1);
  assert.equal(r.duplicates[0].bookmarks.length, 2);
  assert.equal(r.unique_urls, 2);
  assert.equal(r.unique_hosts, 1);
});

test("buildReport: hostname coverage classification", () => {
  const cache: Cache = {
    fetched_at: "2026-04-21T00:00:00Z",
    total: 3,
    bookmarks: [
      { bookmark_id: 1, title: "xhs", link: "https://www.xiaohongshu.com/discovery/item/x" },
      { bookmark_id: 2, title: "gh", link: "https://github.com/x/y" },
      { bookmark_id: 3, title: "unknown", link: "https://example.com/post/1" },
    ],
  };
  const r = buildReport(cache);
  const byHost = new Map(r.hosts.map((h) => [h.hostname, h]));
  // xiaohongshu and github both now have explicit DISPATCH_RULES entries.
  // example.com is the unmatched-falls-through case.
  assert.equal(byHost.get("xiaohongshu.com")?.coverage, "dedicated-adapter");
  assert.equal(byHost.get("xiaohongshu.com")?.adapter, "xiaohongshu");
  assert.equal(byHost.get("github.com")?.coverage, "dedicated-adapter");
  assert.equal(byHost.get("example.com")?.coverage, "web-read-fallback");
});

test("buildReport: uncovered_high_frequency surfaces unmatched domains with count > 1", () => {
  const bookmarks = [];
  // 6 example.com bookmarks (uncovered, count > 1)
  for (let i = 0; i < 6; i++) bookmarks.push({ bookmark_id: i, title: `ex${i}`, link: `https://example.com/post/${i}` });
  // 1 unique-host bookmark (uncovered, but count = 1 — below threshold)
  bookmarks.push({ bookmark_id: 999, title: "long-tail", link: "https://random-once-only-host.test/page" });
  // 10 xhs (covered, should not show even though count is high)
  for (let i = 0; i < 10; i++) bookmarks.push({ bookmark_id: 200 + i, title: `xhs${i}`, link: `http://xhslink.com/o/${i}` });
  const r = buildReport({ fetched_at: "2026-04-21T00:00:00Z", total: bookmarks.length, bookmarks });
  // Only example.com appears (count 6 > 1). xhs is dedicated-adapter, the
  // long-tail host is below the count > 1 threshold.
  assert.equal(r.uncovered_high_frequency.length, 1);
  assert.equal(r.uncovered_high_frequency[0].hostname, "example.com");
  assert.equal(r.uncovered_high_frequency[0].count, 6);
});

test("formatReport: output contains expected sections", () => {
  const cache: Cache = {
    fetched_at: "2026-04-21T00:00:00Z",
    total: 2,
    bookmarks: [
      { bookmark_id: 1, title: "A", link: "https://github.com/x/y" },
      { bookmark_id: 2, title: "A copy", link: "https://github.com/x/y" },
    ],
  };
  const out = formatReport(buildReport(cache));
  assert.match(out, /Duplicates \(1\)/);
  // Section heading text was updated when threshold dropped to >1.
  assert.match(out, /Uncovered hostnames/);
  assert.match(out, /Hostname distribution/);
});

// ---------------------------------------------------------------------------
// resolveIdentifier (export.ts)
// ---------------------------------------------------------------------------

function withTmpCache<T>(cache: Cache, fn: (path: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "hirono-test-"));
  const path = join(dir, "cache.json");
  writeFileSync(path, JSON.stringify(cache), "utf8");
  try { return fn(path); }
  finally { try { rmSync(dir, { recursive: true, force: true }); } catch {} }
}

test("resolveIdentifier: plain Raindrop ID resolves via cache", () => {
  const cache: Cache = {
    fetched_at: "2026-04-21T00:00:00Z",
    total: 1,
    bookmarks: [{ bookmark_id: 123, title: "X", link: "https://example.com/x" }],
  };
  withTmpCache(cache, (cachePath) => {
    const r = resolveIdentifier("123", { cachePath });
    assert.equal(r.kind, "raindrop-id");
    assert.equal(r.url, "https://example.com/x");
    assert.ok(r.slug.length > 0);
  });
});

test("resolveIdentifier: raindrop: prefix is stripped", () => {
  const cache: Cache = {
    fetched_at: "2026-04-21T00:00:00Z",
    total: 1,
    bookmarks: [{ bookmark_id: 456, title: "Y", link: "https://example.com/y" }],
  };
  withTmpCache(cache, (cachePath) => {
    const r = resolveIdentifier("raindrop:456", { cachePath });
    assert.equal(r.kind, "raindrop-id");
    assert.equal(r.url, "https://example.com/y");
  });
});

test("resolveIdentifier: URL with explicit --slug works", () => {
  const r = resolveIdentifier("https://example.com/article", { slug: "2026-04-21-test-slug" });
  assert.equal(r.kind, "url");
  assert.equal(r.url, "https://example.com/article");
  assert.equal(r.slug, "2026-04-21-test-slug");
});

test("resolveIdentifier: URL without --slug throws", () => {
  assert.throws(() => resolveIdentifier("https://example.com/article"), /requires --slug/);
});

test("resolveIdentifier: ID not in cache throws", () => {
  const cache: Cache = { fetched_at: "2026-04-21T00:00:00Z", total: 0, bookmarks: [] };
  withTmpCache(cache, (cachePath) => {
    assert.throws(() => resolveIdentifier("999", { cachePath }), /not found in cache/);
  });
});

// ---------------------------------------------------------------------------
// fetch-all: slug derivation + plan builder
// ---------------------------------------------------------------------------

test("slugifyTitle: ASCII kebab-case", () => {
  assert.equal(slugifyTitle("Hello World"), "hello-world");
  assert.equal(slugifyTitle("DeepWiki · slime · overview"), "deepwiki-slime-overview");
  assert.equal(slugifyTitle("NVFP4 Inference (50 PFLOPS)"), "nvfp4-inference-50-pflops");
});

test("slugifyTitle: preserves Chinese characters", () => {
  assert.equal(slugifyTitle("小红书 - megatron"), "小红书-megatron");
  assert.equal(slugifyTitle("混元团队"), "混元团队");
});

test("slugifyTitle: truncates to 40 chars", () => {
  const long = "a".repeat(100);
  assert.equal(slugifyTitle(long).length, 40);
});

test("slugifyTitle: collapses repeated hyphens + trims edges", () => {
  assert.equal(slugifyTitle("!!!hello...world!!!"), "hello-world");
});

test("deriveSlug: combines date + slugified title", () => {
  const b = { bookmark_id: 123, title: "AWS Trainium3 Deep Dive", link: "https://x.com/", created: "2026-02-04T01:08:19Z" };
  assert.equal(deriveSlug(b), "2026-02-04-aws-trainium3-deep-dive");
});

test("deriveSlug: falls back to bookmark_id when title empty", () => {
  const b = { bookmark_id: 123, title: "", link: "https://x.com/", created: "2026-01-15" };
  assert.equal(deriveSlug(b), "2026-01-15-raindrop-123");
});

test("deriveSlug: today's date when created missing", () => {
  const today = new Date().toISOString().slice(0, 10);
  const b = { bookmark_id: 1, title: "Foo", link: "https://x.com/" };
  assert.equal(deriveSlug(b), `${today}-foo`);
});

test("buildPlan: dedupes by normalized URL, keeps smallest bookmark_id", () => {
  const cache: Cache = {
    fetched_at: "2026-04-21T00:00:00Z",
    total: 2,
    bookmarks: [
      { bookmark_id: 200, title: "A copy", link: "https://example.com/post", created: "2026-04-01" },
      { bookmark_id: 100, title: "A original", link: "https://example.com/post", created: "2026-04-01" },
    ],
  };
  const plan = buildPlan(cache);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].bookmark_id, 100);
  assert.equal(plan[0].title, "A original");
});

test("buildPlan: --only-host filters", () => {
  const cache: Cache = {
    fetched_at: "2026-04-21T00:00:00Z",
    total: 3,
    bookmarks: [
      { bookmark_id: 1, title: "github", link: "https://github.com/x/y", created: "2026-04-01" },
      { bookmark_id: 2, title: "lmsys", link: "https://lmsys.org/blog/x", created: "2026-04-01" },
      { bookmark_id: 3, title: "www.github.com", link: "https://www.github.com/a/b", created: "2026-04-01" },
    ],
  };
  const plan = buildPlan(cache, { onlyHost: "github.com" });
  assert.equal(plan.length, 2);
  assert.ok(plan.every((p) => p.host === "github.com"));
});

test("buildPlan: --limit caps fetch actions", () => {
  const cache: Cache = {
    fetched_at: "2026-04-21T00:00:00Z",
    total: 5,
    bookmarks: Array.from({ length: 5 }, (_, i) => ({
      bookmark_id: i + 1,
      title: `post ${i}`,
      link: `https://example.com/${i}`,
      created: "2026-04-01",
    })),
  };
  const plan = buildPlan(cache, { limit: 2 });
  const fetches = plan.filter((p) => p.action === "fetch");
  const overLimit = plan.filter((p) => p.action === "skip-already-planned");
  assert.equal(fetches.length, 2);
  assert.equal(overLimit.length, 3);
});

test("buildPlan: slug collisions disambiguated by bookmark_id suffix", () => {
  // Two bookmarks that would produce the same derived slug (same title + date).
  const cache: Cache = {
    fetched_at: "2026-04-21T00:00:00Z",
    total: 2,
    bookmarks: [
      { bookmark_id: 1, title: "Same title", link: "https://a.example.com/", created: "2026-04-01" },
      { bookmark_id: 2, title: "Same title", link: "https://b.example.com/", created: "2026-04-01" },
    ],
  };
  const plan = buildPlan(cache);
  assert.equal(plan.length, 2);
  const slugs = plan.map((p) => p.slug);
  assert.equal(new Set(slugs).size, 2, "slugs should be unique after disambiguation");
});
