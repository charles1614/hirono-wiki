import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  hostnameOf,
  lookupDispatch,
  isArticleLikeUrl,
  classifyQuality,
  LOGIN_WALL_KEYWORDS,
  LOADING_SKELETON_KEYWORDS,
  extractImageUrls,
  localNameFor,
  yearForSlug,
  getPreferredWaitSeconds,
  DEFAULT_WEB_READ_WAIT_SECONDS,
  parseFetchDecisions,
  loadFetchDecisions,
  listRawSlugs,
  buildStatusReport,
  buildSyncPlan,
  remediationFor,
  browserTimeoutMs,
} from "../fetch-raw.ts";

// ---------------------------------------------------------------------------
// hostnameOf
// ---------------------------------------------------------------------------

test("hostnameOf: extracts host", () => {
  assert.equal(hostnameOf("https://www.xiaohongshu.com/discovery/item/xxx"), "www.xiaohongshu.com");
  assert.equal(hostnameOf("http://xhslink.com/o/abc"), "xhslink.com");
  assert.equal(hostnameOf("not-a-url"), "");
  assert.equal(hostnameOf(""), "");
});

// ---------------------------------------------------------------------------
// opencli-adapter dispatch
// ---------------------------------------------------------------------------

test("lookupDispatch: xhs variants route to xiaohongshu adapter", () => {
  assert.equal(lookupDispatch("http://xhslink.com/o/abc")?.adapter, "xiaohongshu");
  assert.equal(lookupDispatch("https://www.xiaohongshu.com/discovery/item/x")?.adapter, "xiaohongshu");
  assert.equal(lookupDispatch("https://xiaohongshu.com/explore/x")?.adapter, "xiaohongshu");
});

test("lookupDispatch: zhuanlan.zhihu.com → zhihu-article adapter", () => {
  assert.equal(lookupDispatch("https://zhuanlan.zhihu.com/p/123")?.adapter, "zhihu-article");
});

test("lookupDispatch: www.zhihu.com/question/ → zhihu-question adapter", () => {
  assert.equal(lookupDispatch("https://www.zhihu.com/question/42")?.adapter, "zhihu-question");
  assert.equal(lookupDispatch("https://zhihu.com/question/42")?.adapter, "zhihu-question");
});

test("lookupDispatch: www.zhihu.com without /question/ → no adapter (falls to web-read)", () => {
  // We intentionally don't route bare zhihu.com/ answers to a specific adapter;
  // `web read` handles them.
  assert.equal(lookupDispatch("https://www.zhihu.com/answer/7"), null);
});

test("lookupDispatch: mp.weixin.qq.com → weixin adapter", () => {
  assert.equal(lookupDispatch("https://mp.weixin.qq.com/s/abc")?.adapter, "weixin");
});

test("lookupDispatch: other domains return null (falls to web-read)", () => {
  assert.equal(lookupDispatch("https://newsletter.semianalysis.com/p/foo"), null);
  assert.equal(lookupDispatch("https://github.com/x/y"), null);
  assert.equal(lookupDispatch("https://gist.github.com/x/y"), null);
  // Guard against host-suffix spoofing (mp.weixin.qq.example.com should NOT match)
  assert.equal(lookupDispatch("https://mp.weixin.qq.example.com/fake"), null);
});

test("isArticleLikeUrl: recognizes the patterns we guard with L3 redirect detection", () => {
  assert.equal(isArticleLikeUrl("https://www.xiaohongshu.com/discovery/item/x"), true);
  assert.equal(isArticleLikeUrl("http://xhslink.com/o/abc"), true);
  assert.equal(isArticleLikeUrl("https://zhuanlan.zhihu.com/p/123"), true);
  assert.equal(isArticleLikeUrl("https://www.zhihu.com/question/42"), true);
  assert.equal(isArticleLikeUrl("https://mp.weixin.qq.com/s/abc"), true);
  assert.equal(isArticleLikeUrl("https://www.xiaohongshu.com/"), false);
  assert.equal(isArticleLikeUrl("https://example.com/article"), false);
});

// ---------------------------------------------------------------------------
// quality classifier
// ---------------------------------------------------------------------------

test("classifyQuality: healthy content → not suspicious, no flags", () => {
  const long = "A".repeat(800) + " real article body " + "B".repeat(800);
  const r = classifyQuality(long);
  assert.equal(r.suspicious, false);
  assert.equal(r.flags.length, 0);
});

test("classifyQuality: short body → flagged", () => {
  const r = classifyQuality("hello world");
  assert.equal(r.suspicious, true);
  assert.ok(r.flags.includes("short-body"));
});

test("classifyQuality: login-wall keyword → flagged even if body is long enough", () => {
  const body = "Some content ".repeat(100) + " Open in App to read more";
  const r = classifyQuality(body);
  assert.equal(r.suspicious, true);
  assert.ok(r.flags.includes("login-wall-keyword"));
});

test("classifyQuality: Chinese 登录 keyword detected", () => {
  const body = "这是一些内容 ".repeat(100) + " 登录查看全文";
  const r = classifyQuality(body);
  assert.ok(r.flags.includes("login-wall-keyword"));
});

test("LOGIN_WALL_KEYWORDS includes the key domains we care about", () => {
  // Smoke-check: a keyword for each of xhs ('打开App'), wechat ('请在微信客户端打开')
  assert.ok(LOGIN_WALL_KEYWORDS.some((k) => k.includes("打开App") || k.includes("打开小红书")));
  assert.ok(LOGIN_WALL_KEYWORDS.some((k) => k.includes("请在微信")));
});

// ---------------------------------------------------------------------------
// image extraction
// ---------------------------------------------------------------------------

test("extractImageUrls: markdown ![]() syntax", () => {
  const md = `
Text.

![alt1](https://example.com/a.png)

More text ![alt2](https://example.com/b.jpg "title").

![](https://example.com/c.webp)
`;
  const urls = extractImageUrls(md);
  assert.deepEqual(urls.sort(), [
    "https://example.com/a.png",
    "https://example.com/b.jpg",
    "https://example.com/c.webp",
  ]);
});

test("extractImageUrls: HTML <img> syntax", () => {
  const md = `Before <img src="https://example.com/x.png" alt="x"> after.
And <img alt="y" src='https://example.com/y.jpg' /> inline.`;
  const urls = extractImageUrls(md);
  assert.deepEqual(urls.sort(), [
    "https://example.com/x.png",
    "https://example.com/y.jpg",
  ]);
});

test("extractImageUrls: ignores fenced code blocks", () => {
  const md = `
Real ![real](https://example.com/real.png)

\`\`\`
![nope](https://example.com/nope.png)
\`\`\`

Also real <img src="https://example.com/also.jpg">
`;
  const urls = extractImageUrls(md);
  assert.deepEqual(urls.sort(), [
    "https://example.com/also.jpg",
    "https://example.com/real.png",
  ]);
});

test("extractImageUrls: dedupes repeats", () => {
  const md = "![a](https://example.com/x.png) and again ![b](https://example.com/x.png)";
  assert.deepEqual(extractImageUrls(md), ["https://example.com/x.png"]);
});

// ---------------------------------------------------------------------------
// local filename derivation
// ---------------------------------------------------------------------------

test("localNameFor: uses URL basename when it has a known extension", () => {
  assert.equal(localNameFor("https://example.com/path/figure-1.png", 1), "01-figure-1.png");
  assert.equal(localNameFor("https://example.com/img/photo.jpg", 3), "03-photo.jpg");
  assert.equal(localNameFor("https://example.com/w.webp", 10), "10-w.webp");
});

test("localNameFor: falls back to indexed name when basename has no image extension", () => {
  const name = localNameFor("https://cdn.xhs.com/notes/random-token-no-ext", 2);
  assert.match(name, /^02-image/);
});

test("localNameFor: sanitizes special chars", () => {
  const name = localNameFor("https://example.com/path/image%20with%20spaces.png", 1);
  assert.equal(name, "01-image-20with-20spaces.png");
});

test("localNameFor: handles malformed URLs", () => {
  assert.equal(localNameFor("garbage-not-a-url", 5), "05-image.bin");
});

// ---------------------------------------------------------------------------
// year derivation
// ---------------------------------------------------------------------------

test("yearForSlug: pulls year from YYYY-MM-DD prefix", () => {
  assert.equal(yearForSlug("2026-04-19-aws-trainium3-deep-dive"), "2026");
  assert.equal(yearForSlug("2025-12-31-eoy-recap"), "2025");
});

test("yearForSlug: falls back to current year for unprefixed slugs", () => {
  const now = new Date().getFullYear().toString();
  assert.equal(yearForSlug("some-topic-slug"), now);
  assert.equal(yearForSlug("just-a-name"), now);
});

// ---------------------------------------------------------------------------
// classifyQuality: new quality_status + context-aware flags
// ---------------------------------------------------------------------------

test("classifyQuality: healthy content → status=good", () => {
  const long = "A".repeat(800) + " real article body " + "B".repeat(800);
  const r = classifyQuality(long);
  assert.equal(r.quality_status, "good");
  assert.deepEqual(r.flags, []);
});

test("classifyQuality: any flag → status=flagged", () => {
  const r = classifyQuality("short");
  assert.equal(r.quality_status, "flagged");
  assert.ok(r.flags.includes("short-body"));
});

test("classifyQuality: declaredImageCount>0 && downloadedImageCount=0 → flag", () => {
  const body = "A".repeat(800) + " ![img](foo.png) " + "B".repeat(400);
  const r = classifyQuality(body, { declaredImageCount: 1, downloadedImageCount: 0 });
  assert.ok(r.flags.includes("images-declared-but-none-downloaded"));
  assert.equal(r.quality_status, "flagged");
});

test("classifyQuality: declared>0 and downloaded>0 → no image-mismatch flag", () => {
  const body = "A".repeat(800) + " ![img](foo.png) " + "B".repeat(400);
  const r = classifyQuality(body, { declaredImageCount: 1, downloadedImageCount: 1 });
  assert.ok(!r.flags.includes("images-declared-but-none-downloaded"));
  assert.equal(r.quality_status, "good");
});

test("classifyQuality: declared=0, downloaded=0 → no image-mismatch flag (not all sources have images)", () => {
  const body = "A".repeat(800) + " no images here " + "B".repeat(400);
  const r = classifyQuality(body, { declaredImageCount: 0, downloadedImageCount: 0 });
  assert.ok(!r.flags.includes("images-declared-but-none-downloaded"));
  assert.equal(r.quality_status, "good");
});

test("classifyQuality: xhsDownloadSilentFail context sets flag", () => {
  const body = "A".repeat(800) + " B".repeat(400);
  const r = classifyQuality(body, { xhsDownloadSilentFail: true });
  assert.ok(r.flags.includes("xhs-download-silent-fail"));
  assert.equal(r.quality_status, "flagged");
});

test("classifyQuality: extraFlags from caller are merged + deduped", () => {
  const body = "A".repeat(800) + " B".repeat(400);
  // Caller explicitly forwards "custom-flag" and also "short-body" (redundantly).
  // Both should appear in the final list; neither should duplicate.
  const r = classifyQuality(body, { extraFlags: ["custom-flag", "short-body"] });
  assert.ok(r.flags.includes("custom-flag"));
  assert.ok(r.flags.includes("short-body"));  // passed through from extraFlags
  const shortBodyCount = r.flags.filter((f) => f === "short-body").length;
  assert.equal(shortBodyCount, 1, "short-body should appear exactly once");
  assert.equal(r.quality_status, "flagged");
});

test("classifyQuality: caller extraFlags that overlap with content-detected flag → no dup", () => {
  // Body is short (triggers short-body from content) AND caller also lists it.
  const r = classifyQuality("tiny", { extraFlags: ["short-body"] });
  const shortBodyCount = r.flags.filter((f) => f === "short-body").length;
  assert.equal(shortBodyCount, 1, "overlapping flag should dedupe to one entry");
});

test("LOADING_SKELETON_KEYWORDS catches English + Chinese", () => {
  assert.ok(LOADING_SKELETON_KEYWORDS.some((k) => k.includes("Loading")));
  assert.ok(LOADING_SKELETON_KEYWORDS.some((k) => k.includes("加载中")));
});

test("classifyQuality: loading-skeleton flag fires", () => {
  const body = "Loading content..." + "A".repeat(800);
  const r = classifyQuality(body);
  assert.ok(r.flags.includes("loading-skeleton"));
});

// ---------------------------------------------------------------------------
// per-domain wait overrides
// ---------------------------------------------------------------------------

test("getPreferredWaitSeconds: default for unknown hosts", () => {
  assert.equal(getPreferredWaitSeconds("https://github.com/x/y"), DEFAULT_WEB_READ_WAIT_SECONDS);
  assert.equal(getPreferredWaitSeconds("https://newsletter.semianalysis.com/p/foo"), DEFAULT_WEB_READ_WAIT_SECONDS);
});

test("getPreferredWaitSeconds: DeepWiki gets 20s (client-rendered SPA)", () => {
  assert.equal(getPreferredWaitSeconds("https://wiki.litenext.digital/wiki/jax?file=01-overview"), 20);
});

test("getPreferredWaitSeconds: notion + vercel subdomain overrides", () => {
  assert.equal(getPreferredWaitSeconds("https://charles.notion.so/page"), 20);
  assert.equal(getPreferredWaitSeconds("https://notion.so/page"), 20);
  assert.equal(getPreferredWaitSeconds("https://foo.vercel.app/docs"), 20);
});

test("getPreferredWaitSeconds: doesn't match suffix spoofing", () => {
  assert.equal(
    getPreferredWaitSeconds("https://notion.so.evil.example.com/"),
    DEFAULT_WEB_READ_WAIT_SECONDS,
  );
});

// ---------------------------------------------------------------------------
// Meta/fetch-decisions.md parser
// ---------------------------------------------------------------------------

test("parseFetchDecisions: basic bullets under H2", () => {
  const content = `
## 2026-04-21 · xhs app-only posts accepted as-is

- 2026-03-30-xhs-cuda-black-magic — xhs app-only URL; content gone
- 2026-02-15-xhs-other-post — paywall / private
`;
  const d = parseFetchDecisions(content);
  assert.equal(d.size, 2);
  assert.match(d.get("2026-03-30-xhs-cuda-black-magic")!, /app-only/);
  assert.match(d.get("2026-02-15-xhs-other-post")!, /paywall/);
});

test("parseFetchDecisions: ignores HTML-commented examples", () => {
  const content = `
## 2026-04-21 · real

- 2026-04-20-real-slug — real reason

<!--
## examples

- fake-slug — fake reason
-->
`;
  const d = parseFetchDecisions(content);
  assert.equal(d.size, 1);
  assert.ok(d.has("2026-04-20-real-slug"));
  assert.ok(!d.has("fake-slug"));
});

test("parseFetchDecisions: accepts en-dash / em-dash / double-hyphen separators", () => {
  const content = `
## date

- 2026-01-01-em — em-dash reason
- 2026-01-02-en – en-dash reason
- 2026-01-03-hy -- double-hyphen reason
`;
  const d = parseFetchDecisions(content);
  assert.equal(d.size, 3);
});

test("parseFetchDecisions: skips non-matching lines", () => {
  const content = `
# Title

Some prose.

- Not a slug — this is a regular markdown bullet in prose context
- This isn't a slug either (no kebab) — noise

## real section

- 2026-04-20-good-slug — captured

Regular paragraph continues.
`;
  const d = parseFetchDecisions(content);
  // "Not a slug" has a space, "This isn't" has an apostrophe/paren — neither match /^[a-z0-9][a-z0-9-]*[a-z0-9]$/i
  assert.equal(d.size, 1);
  assert.ok(d.has("2026-04-20-good-slug"));
});

test("loadFetchDecisions: returns empty map when file missing", () => {
  const tmp = join(tmpdir(), `decisions-missing-${Date.now()}.md`);
  const d = loadFetchDecisions(tmp);
  assert.equal(d.size, 0);
});

// ---------------------------------------------------------------------------
// listRawSlugs + buildStatusReport
// ---------------------------------------------------------------------------

interface TmpTree {
  root: string;
  addSource(slug: string, year: string, source: Record<string, unknown>, contentMd?: string): void;
  cleanup(): void;
}

function makeTmpRawTree(): TmpTree {
  const root = mkdtempSync(join(tmpdir(), "fetch-raw-test-"));
  return {
    root,
    addSource(slug, year, source, contentMd = "A".repeat(1000)) {
      const dir = join(root, year, slug);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "content.md"), contentMd, "utf8");
      writeFileSync(join(dir, "source.json"), JSON.stringify(source, null, 2), "utf8");
    },
    cleanup() {
      try { rmSync(root, { recursive: true, force: true }); } catch {}
    },
  };
}

test("listRawSlugs: finds sources, classifies by source.json.quality_status", () => {
  const t = makeTmpRawTree();
  try {
    t.addSource("2026-04-01-good", "2026", {
      origin: "url:https://a.example.com",
      origin_url: "https://a.example.com",
      fetcher: "opencli",
      fetcher_reason: "direct",
      content_sha: "a",
      content_length: 1000,
      quality_flags: [],
      quality_status: "good",
      images: [],
      notes: [],
    });
    t.addSource("2026-04-02-flagged", "2026", {
      origin: "url:https://b.example.com",
      origin_url: "https://b.example.com",
      fetcher: "opencli",
      fetcher_reason: "direct",
      content_sha: "b",
      content_length: 1000,
      quality_flags: ["short-body"],
      quality_status: "flagged",
      images: [],
      notes: [],
    });
    const r = listRawSlugs(t.root);
    assert.equal(r.length, 2);
    const good = r.find((x) => x.slug === "2026-04-01-good");
    const flagged = r.find((x) => x.slug === "2026-04-02-flagged");
    assert.equal(good?.quality_status, "good");
    assert.equal(flagged?.quality_status, "flagged");
  } finally {
    t.cleanup();
  }
});

test("listRawSlugs: legacy source.json without quality_status → classify on the fly", () => {
  const t = makeTmpRawTree();
  try {
    t.addSource("2026-04-01-legacy", "2026", {
      origin: "url:https://legacy.example.com",
      origin_url: "https://legacy.example.com",
      fetcher: "opencli",
      fetcher_reason: "direct",
      content_sha: "c",
      content_length: 50,
      quality_flags: [],
      images: [],
      notes: [],
      // no quality_status field
    }, "short");  // triggers short-body via live classify
    const r = listRawSlugs(t.root);
    assert.equal(r[0].quality_status, "flagged");
  } finally {
    t.cleanup();
  }
});

test("listRawSlugs: missing content.md → quality_status=failed", () => {
  const root = mkdtempSync(join(tmpdir(), "fetch-raw-test-"));
  try {
    const dir = join(root, "2026", "2026-04-01-failed");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "source.json"), JSON.stringify({
      origin: "url:https://x.example.com", origin_url: "https://x.example.com",
      fetcher: "opencli", fetcher_reason: "direct",
      content_sha: "", content_length: 0,
      quality_flags: [], images: [], notes: [],
    }), "utf8");
    const r = listRawSlugs(root);
    assert.equal(r[0].quality_status, "failed");
    assert.equal(r[0].hasContent, false);
  } finally {
    try { rmSync(root, { recursive: true, force: true }); } catch {}
  }
});

test("buildStatusReport: partitions into good / needsAttention / acceptedAsIs", () => {
  const t = makeTmpRawTree();
  const decisionsPath = join(t.root, "fetch-decisions.md");
  writeFileSync(decisionsPath, `
## date
- 2026-04-02-flagged — accepted lost-cause
`, "utf8");
  try {
    t.addSource("2026-04-01-good", "2026", {
      origin: "url:a", origin_url: "a", fetcher: "opencli", fetcher_reason: "direct",
      content_sha: "a", content_length: 1000, quality_flags: [], quality_status: "good",
      images: [], notes: [],
    });
    t.addSource("2026-04-02-flagged", "2026", {
      origin: "url:b", origin_url: "b", fetcher: "opencli", fetcher_reason: "direct",
      content_sha: "b", content_length: 100, quality_flags: ["short-body"], quality_status: "flagged",
      images: [], notes: [],
    });
    t.addSource("2026-04-03-flagged-not-accepted", "2026", {
      origin: "url:c", origin_url: "c", fetcher: "opencli", fetcher_reason: "direct",
      content_sha: "c", content_length: 100, quality_flags: ["short-body"], quality_status: "flagged",
      images: [], notes: [],
    });
    const report = buildStatusReport(t.root, decisionsPath);
    assert.equal(report.good.length, 1);
    assert.equal(report.good[0].slug, "2026-04-01-good");
    assert.equal(report.acceptedAsIs.length, 1);
    assert.equal(report.acceptedAsIs[0].info.slug, "2026-04-02-flagged");
    assert.equal(report.needsAttention.length, 1);
    assert.equal(report.needsAttention[0].slug, "2026-04-03-flagged-not-accepted");
  } finally {
    t.cleanup();
  }
});

// ---------------------------------------------------------------------------
// buildSyncPlan: filtering semantics
// ---------------------------------------------------------------------------

test("buildSyncPlan: good slug → skip-good by default", () => {
  const t = makeTmpRawTree();
  try {
    t.addSource("2026-04-01-good", "2026", {
      origin: "url:a", origin_url: "a", fetcher: "opencli", fetcher_reason: "direct",
      content_sha: "a", content_length: 1000, quality_flags: [], quality_status: "good",
      images: [], notes: [],
    });
    const decisionsPath = join(t.root, "decisions.md");
    writeFileSync(decisionsPath, "", "utf8");
    const plan = buildSyncPlan({
      retryFlagged: false, dryRun: true, reclassify: false,
      rawRoot: t.root, decisionsPath, ingestBatchPath: join(t.root, "no-batch.json"),
    });
    assert.equal(plan.length, 1);
    assert.equal(plan[0].action, "skip-good");
  } finally {
    t.cleanup();
  }
});

test("buildSyncPlan: flagged slug → skip-good by default, fetch with --retry-flagged", () => {
  const t = makeTmpRawTree();
  try {
    t.addSource("2026-04-02-flagged", "2026", {
      origin: "url:b", origin_url: "https://b.example.com", fetcher: "opencli", fetcher_reason: "direct",
      content_sha: "b", content_length: 100, quality_flags: ["short-body"], quality_status: "flagged",
      images: [], notes: [],
    });
    const decisionsPath = join(t.root, "decisions.md");
    writeFileSync(decisionsPath, "", "utf8");

    // Without --retry-flagged
    const planA = buildSyncPlan({
      retryFlagged: false, dryRun: true, reclassify: false,
      rawRoot: t.root, decisionsPath, ingestBatchPath: join(t.root, "no-batch.json"),
    });
    assert.equal(planA[0].action, "skip-good");

    // With --retry-flagged
    const planB = buildSyncPlan({
      retryFlagged: true, dryRun: true, reclassify: false,
      rawRoot: t.root, decisionsPath, ingestBatchPath: join(t.root, "no-batch.json"),
    });
    assert.equal(planB[0].action, "fetch");
    assert.equal(planB[0].originUrl, "https://b.example.com");
  } finally {
    t.cleanup();
  }
});

test("buildSyncPlan: decisions always skip, even with --retry-flagged", () => {
  const t = makeTmpRawTree();
  try {
    t.addSource("2026-04-02-flagged", "2026", {
      origin: "url:b", origin_url: "b", fetcher: "opencli", fetcher_reason: "direct",
      content_sha: "b", content_length: 100, quality_flags: ["short-body"], quality_status: "flagged",
      images: [], notes: [],
    });
    const decisionsPath = join(t.root, "decisions.md");
    writeFileSync(decisionsPath, "## d\n- 2026-04-02-flagged — accepted\n", "utf8");
    const plan = buildSyncPlan({
      retryFlagged: true, dryRun: true, reclassify: false,
      rawRoot: t.root, decisionsPath, ingestBatchPath: join(t.root, "no-batch.json"),
    });
    assert.equal(plan[0].action, "skip-decisioned");
  } finally {
    t.cleanup();
  }
});

test("buildSyncPlan: --only whitelists (forces good to fetch, drops others)", () => {
  const t = makeTmpRawTree();
  try {
    t.addSource("2026-04-01-good", "2026", {
      origin: "url:a", origin_url: "https://a.example.com", fetcher: "opencli", fetcher_reason: "direct",
      content_sha: "a", content_length: 1000, quality_flags: [], quality_status: "good",
      images: [], notes: [],
    });
    t.addSource("2026-04-02-good2", "2026", {
      origin: "url:b", origin_url: "b", fetcher: "opencli", fetcher_reason: "direct",
      content_sha: "b", content_length: 1000, quality_flags: [], quality_status: "good",
      images: [], notes: [],
    });
    const decisionsPath = join(t.root, "decisions.md");
    writeFileSync(decisionsPath, "", "utf8");
    const plan = buildSyncPlan({
      retryFlagged: false, dryRun: true, reclassify: false,
      only: new Set(["2026-04-01-good"]),
      rawRoot: t.root, decisionsPath, ingestBatchPath: join(t.root, "no-batch.json"),
    });
    const first = plan.find((p) => p.slug === "2026-04-01-good");
    const second = plan.find((p) => p.slug === "2026-04-02-good2");
    assert.equal(first?.action, "fetch", "whitelisted good slug should fetch");
    assert.equal(second?.action, "skip-not-in-only");
  } finally {
    t.cleanup();
  }
});

test("buildSyncPlan: --limit caps fetches", () => {
  const t = makeTmpRawTree();
  try {
    for (let i = 1; i <= 4; i++) {
      t.addSource(`2026-04-0${i}-flagged`, "2026", {
        origin: `url:${i}`, origin_url: `https://${i}.example.com`, fetcher: "opencli", fetcher_reason: "direct",
        content_sha: "x", content_length: 100, quality_flags: ["short-body"], quality_status: "flagged",
        images: [], notes: [],
      });
    }
    const decisionsPath = join(t.root, "decisions.md");
    writeFileSync(decisionsPath, "", "utf8");
    const plan = buildSyncPlan({
      retryFlagged: true, dryRun: true, reclassify: false, limit: 2,
      rawRoot: t.root, decisionsPath, ingestBatchPath: join(t.root, "no-batch.json"),
    });
    const fetching = plan.filter((p) => p.action === "fetch");
    const overLimit = plan.filter((p) => p.action === "skip-over-limit");
    assert.equal(fetching.length, 2);
    assert.equal(overLimit.length, 2);
  } finally {
    t.cleanup();
  }
});

test("buildSyncPlan: merges in ingest_batch pending entries with slug", () => {
  const t = makeTmpRawTree();
  try {
    // One existing raw slug (good, so skipped), one new via batch
    t.addSource("2026-04-01-existing", "2026", {
      origin: "url:a", origin_url: "a", fetcher: "opencli", fetcher_reason: "direct",
      content_sha: "a", content_length: 1000, quality_flags: [], quality_status: "good",
      images: [], notes: [],
    });
    const decisionsPath = join(t.root, "decisions.md");
    writeFileSync(decisionsPath, "", "utf8");
    const batchPath = join(t.root, "batch.json");
    writeFileSync(batchPath, JSON.stringify({
      version: 1,
      entries: {
        "raindrop:123": {
          id: "raindrop:123",
          url: "https://new.example.com/post",
          status: "pending",
          slug: "2026-04-05-new",
          added_at: "2026-04-20T00:00:00Z",
        },
        "raindrop:124": {
          id: "raindrop:124",
          url: "https://no-slug.example.com/post",
          status: "pending",
          // no slug → should be skipped at sync layer (we don't synthesize slugs)
          added_at: "2026-04-20T00:00:00Z",
        },
      },
    }), "utf8");
    const plan = buildSyncPlan({
      retryFlagged: false, dryRun: true, reclassify: false,
      rawRoot: t.root, decisionsPath, ingestBatchPath: batchPath,
    });
    const newOne = plan.find((p) => p.slug === "2026-04-05-new");
    assert.ok(newOne, "batch entry with slug should appear in plan");
    assert.equal(newOne!.action, "fetch");
    assert.equal(newOne!.originUrl, "https://new.example.com/post");
    // The slugless batch entry should NOT appear (we skip at load time)
    assert.ok(!plan.some((p) => p.origin === "raindrop:124"));
  } finally {
    t.cleanup();
  }
});

// ---------------------------------------------------------------------------
// remediation hints
// ---------------------------------------------------------------------------

test("remediationFor: login-wall on xhs → xhs-specific hint", () => {
  const r = remediationFor(["login-wall-keyword"], "https://www.xiaohongshu.com/discovery/item/abc");
  assert.match(r, /xiaohongshu\.com/);
  assert.match(r, /refetch/);
});

test("remediationFor: xhs-silent-fail → wait-and-retry hint", () => {
  const r = remediationFor(["xhs-download-silent-fail"], "https://www.xiaohongshu.com/x");
  assert.match(r, /wait.*min/i);
});

test("remediationFor: loading-skeleton → SPA hint", () => {
  const r = remediationFor(["loading-skeleton"], "https://wiki.litenext.digital/x");
  assert.match(r, /SPA/);
});

test("remediationFor: no recognized flag → fallback hint", () => {
  const r = remediationFor(["unknown-flag"], "https://x.example.com");
  assert.match(r, /inspect/);
});

// ---------------------------------------------------------------------------
// browserTimeoutMs
// ---------------------------------------------------------------------------

test("browserTimeoutMs: defaults when env unset", () => {
  const save = {
    open: process.env.HIRONO_BROWSER_OPEN_TIMEOUT_MS,
    eval: process.env.HIRONO_BROWSER_EVAL_TIMEOUT_MS,
    close: process.env.HIRONO_BROWSER_CLOSE_TIMEOUT_MS,
    doctor: process.env.HIRONO_BROWSER_DOCTOR_TIMEOUT_MS,
  };
  delete process.env.HIRONO_BROWSER_OPEN_TIMEOUT_MS;
  delete process.env.HIRONO_BROWSER_EVAL_TIMEOUT_MS;
  delete process.env.HIRONO_BROWSER_CLOSE_TIMEOUT_MS;
  delete process.env.HIRONO_BROWSER_DOCTOR_TIMEOUT_MS;
  try {
    assert.equal(browserTimeoutMs("open"),   30_000);
    assert.equal(browserTimeoutMs("eval"),   15_000);
    assert.equal(browserTimeoutMs("close"),  5_000);
    assert.equal(browserTimeoutMs("doctor"), 10_000);
  } finally {
    if (save.open)   process.env.HIRONO_BROWSER_OPEN_TIMEOUT_MS   = save.open;
    if (save.eval)   process.env.HIRONO_BROWSER_EVAL_TIMEOUT_MS   = save.eval;
    if (save.close)  process.env.HIRONO_BROWSER_CLOSE_TIMEOUT_MS  = save.close;
    if (save.doctor) process.env.HIRONO_BROWSER_DOCTOR_TIMEOUT_MS = save.doctor;
  }
});

test("browserTimeoutMs: honors env overrides", () => {
  const prev = process.env.HIRONO_BROWSER_OPEN_TIMEOUT_MS;
  process.env.HIRONO_BROWSER_OPEN_TIMEOUT_MS = "60000";
  try {
    assert.equal(browserTimeoutMs("open"), 60_000);
  } finally {
    if (prev === undefined) delete process.env.HIRONO_BROWSER_OPEN_TIMEOUT_MS;
    else process.env.HIRONO_BROWSER_OPEN_TIMEOUT_MS = prev;
  }
});

test("browserTimeoutMs: ignores garbage env values", () => {
  const prev = process.env.HIRONO_BROWSER_OPEN_TIMEOUT_MS;
  process.env.HIRONO_BROWSER_OPEN_TIMEOUT_MS = "not-a-number";
  try {
    assert.equal(browserTimeoutMs("open"), 30_000);
  } finally {
    if (prev === undefined) delete process.env.HIRONO_BROWSER_OPEN_TIMEOUT_MS;
    else process.env.HIRONO_BROWSER_OPEN_TIMEOUT_MS = prev;
  }
});

test("browserTimeoutMs: ignores negative / zero values", () => {
  const prev = process.env.HIRONO_BROWSER_EVAL_TIMEOUT_MS;
  process.env.HIRONO_BROWSER_EVAL_TIMEOUT_MS = "0";
  try {
    assert.equal(browserTimeoutMs("eval"), 15_000);
  } finally {
    if (prev === undefined) delete process.env.HIRONO_BROWSER_EVAL_TIMEOUT_MS;
    else process.env.HIRONO_BROWSER_EVAL_TIMEOUT_MS = prev;
  }
});
