import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  hostnameOf,
  isArticleLikeUrl,
  classifyQuality,
  LOGIN_WALL_KEYWORDS,
  LOADING_SKELETON_KEYWORDS,
  extractImageUrls,
  localNameFor,
  yearForSlug,
  parseFetchDecisions,
  loadFetchDecisions,
  listRawSlugs,
  buildStatusReport,
  buildSyncPlan,
  remediationFor,
  rebuildRawIndex,
  isFetchRegression,
  cleanRawResidue,
  type SourceJson,
} from "../fetch-raw.ts";
import { browserTimeoutMs } from "../sites/_shared/browser-helpers.ts";
import { routeSite } from "../sites/index.ts";

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
// site-router dispatch (replaces the legacy DISPATCH_RULES + lookupDispatch)
// ---------------------------------------------------------------------------

test("routeSite: xhs variants route to the xhs site module", () => {
  assert.equal(routeSite("http://xhslink.com/o/abc").name, "xhs");
  assert.equal(routeSite("https://www.xiaohongshu.com/discovery/item/x").name, "xhs");
  assert.equal(routeSite("https://xiaohongshu.com/explore/x").name, "xhs");
});

test("routeSite: zhuanlan.zhihu.com → zhihu-article site module", () => {
  assert.equal(routeSite("https://zhuanlan.zhihu.com/p/123").name, "zhihu-article");
});

test("routeSite: mp.weixin.qq.com → weixin site module", () => {
  assert.equal(routeSite("https://mp.weixin.qq.com/s/abc").name, "weixin");
});

test("routeSite: unmatched domains fall through to _default catch-all", () => {
  // Routing is total — every URL matches some module. Hosts without a
  // dedicated module get the _default catch-all.
  assert.equal(routeSite("https://example.com/post").name, "_default");
  // Host-suffix spoofing must NOT trick the xhs/weixin matchers.
  assert.equal(routeSite("https://mp.weixin.qq.example.com/fake").name, "_default");
});

test("routeSite: gist.github.com URLs route to site:github", () => {
  // The github module claims gist.github.com so gist URLs go through
  // the structured Gist API path rather than the catch-all.
  assert.equal(
    routeSite("https://gist.github.com/alirezarezvani/a0f6e0a984d4a4adc4842bbe124c5935").name,
    "github",
  );
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

test("classifyQuality: login-wall keyword in thin body → flagged", () => {
  // Short body (<1500 chars) — full body is scanned for login walls.
  const body = "Open in App to continue reading.";
  const r = classifyQuality(body);
  assert.equal(r.suspicious, true);
  assert.ok(r.flags.includes("login-wall-keyword"));
});

test("classifyQuality: Chinese 登录 keyword in first 500 chars → flagged", () => {
  // Long body where 登录 appears near the top (where a real login wall
  // would intercept) — should still flag.
  const body = "登录查看全文。" + "这是一些正文内容 ".repeat(500);
  const r = classifyQuality(body);
  assert.ok(r.flags.includes("login-wall-keyword"));
});

test("classifyQuality: login-wall keyword deep in long prose → NOT flagged", () => {
  // Long body where the keyword appears only deep in the article — natural
  // prose mention of 登录 (e.g. tech article describing user login flow),
  // not a wall. Per the tightened heuristic, only the first 500 chars are
  // scanned when the body is ≥ 1500 chars. So a deep-only keyword should
  // NOT trigger the flag — that was the false-positive we were chasing on
  // mp.weixin Chinese articles.
  const long = "正文内容 ".repeat(400);  // ~3200 chars, no keyword
  const body = long + "需要 登录 微信账号。";  // keyword in last 100 chars
  const r = classifyQuality(body);
  assert.ok(!r.flags.includes("login-wall-keyword"));
});

test("classifyQuality: linux.do thread with 登陆 in title → NOT flagged (host-denylist)", () => {
  // Thread on linux.do whose title is literally "cursor 官网账号登陆方式" —
  // login keyword in the H1, body discusses login mechanics. Without
  // the host denylist this would false-positive as a wall page.
  const body =
    "# cursor 官网账号登陆方式不能多人共享了？\n\n" +
    "> 原文链接: https://linux.do/t/topic/537374\n\n" +
    "---\n\n" +
    "## #1 @user\n\n一直和朋友一起用的cursor 今天发现官网登陆不能共享…\n";
  const r = classifyQuality(body, { originUrl: "https://linux.do/t/topic/537374" });
  assert.ok(!r.flags.includes("login-wall-keyword"),
    `linux.do should be exempt from login-wall flag; got: ${r.flags.join(",")}`);
});

test("classifyQuality: structured article (≥3 headings) with login keyword in body → NOT flagged", () => {
  // Even when the host isn't on the denylist, a body with substantial
  // hierarchy (≥3 headings) is structurally an article — never a wall.
  const body =
    "# How to log in to Cursor\n\n" +
    "## Section 1\nlong content...\n" +
    "## Section 2\n登录 mechanics described in detail…\n" +
    "## Section 3\nmore content...\n" +
    "正文 ".repeat(50);
  const r = classifyQuality(body, { originUrl: "https://blog.example.com/post" });
  assert.ok(!r.flags.includes("login-wall-keyword"),
    "≥3 headings should suppress the login-wall flag");
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

// (per-domain wait overrides retired with the legacy web-read path —
//  site modules that need slow-hydration browser handling drive their
//  own wait timing inside fetcher.ts files now.)

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
  /**
   * Lays down `<root>/raindrop/<hostname>/<slug>/{content.md, source.json}`.
   * Hostname is derived from `source.origin_url`; the `year` parameter is
   * kept for call-site readability but is no longer a path component.
   */
  addSource(slug: string, year: string, source: Record<string, unknown>, contentMd?: string): void;
  cleanup(): void;
}

function hostFromUrl(u: string): string {
  try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return "_unknown"; }
}

function makeTmpRawTree(): TmpTree {
  const root = mkdtempSync(join(tmpdir(), "fetch-raw-test-"));
  return {
    root,
    addSource(slug, _year, source, contentMd = "A".repeat(1000)) {
      const host = hostFromUrl((source.origin_url as string) ?? "");
      const dir = join(root, "raindrop", host, slug);
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
    const dir = join(root, "raindrop", "x.example.com", "2026-04-01-failed");
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

test("cleanRawResidue: removes phantom dirs / image-only dirs / atomic-write tmp orphans, preserves real slugs", () => {
  const root = mkdtempSync(join(tmpdir(), "fetch-raw-test-"));
  try {
    // 1. Real slug — must be preserved
    const real = join(root, "raindrop", "real.example.com", "real-slug");
    mkdirSync(real, { recursive: true });
    writeFileSync(join(real, "source.json"), "{}");
    writeFileSync(join(real, "content.md"), "real");

    // 2. Phantom dir (empty) — should be removed
    const phantom = join(root, "raindrop", "phantom.example.com", "phantom-slug");
    mkdirSync(phantom, { recursive: true });

    // 3. Image-only dir (images, no markdown) — should be removed
    const imgOnly = join(root, "raindrop", "img.example.com", "image-only-slug");
    mkdirSync(imgOnly, { recursive: true });
    writeFileSync(join(imgOnly, "img-001.png"), Buffer.from([0x89, 0x50, 0x4E, 0x47]));
    writeFileSync(join(imgOnly, "img-002.png"), Buffer.from([0x89, 0x50, 0x4E, 0x47]));

    // 4. Real slug WITH a tmp orphan inside — slug preserved, tmp removed
    const realWithTmp = join(root, "raindrop", "real2.example.com", "tmp-slug");
    mkdirSync(realWithTmp, { recursive: true });
    writeFileSync(join(realWithTmp, "source.json"), "{}");
    writeFileSync(join(realWithTmp, "content.md"), "real with tmp");
    writeFileSync(join(realWithTmp, ".source.json.tmp-12345-1234567890"), "interrupted");

    // 5. Legacy slug (content.md but no source.json) — preserved
    const legacy = join(root, "raindrop", "legacy.example.com", "legacy-slug");
    mkdirSync(legacy, { recursive: true });
    writeFileSync(join(legacy, "content.md"), "# legacy");

    const r = cleanRawResidue(root);
    assert.equal(r.phantomDirs, 1, "phantom dir count");
    assert.equal(r.imageOnlyDirs, 1, "image-only dir count");
    assert.equal(r.tmpOrphans, 1, "tmp orphan count");

    // Surviving slugs
    assert.ok(existsSync(join(real, "content.md")), "real slug preserved");
    assert.ok(existsSync(join(realWithTmp, "content.md")), "real-with-tmp preserved");
    assert.ok(!existsSync(join(realWithTmp, ".source.json.tmp-12345-1234567890")), "tmp orphan inside real slug removed");
    assert.ok(existsSync(join(legacy, "content.md")), "legacy slug preserved");

    // Removed dirs
    assert.ok(!existsSync(phantom), "phantom dir removed");
    assert.ok(!existsSync(imgOnly), "image-only dir removed");
  } finally {
    try { rmSync(root, { recursive: true, force: true }); } catch {}
  }
});

test("listRawSlugs: phantom directory (no source.json, no content.md) is skipped", () => {
  // Regression: when an L3 halt fires after mkdirSync but before any
  // file write, the slug directory exists but is empty. Earlier code
  // returned this slug with `quality_status="failed"`, which made
  // fetch-all dedupe the URL as "already fetched" and silently route
  // it to skip-flagged. The fix: treat such directories as
  // non-existent so the URL flows through the normal "never fetched"
  // path on the next run.
  const root = mkdtempSync(join(tmpdir(), "fetch-raw-test-"));
  try {
    // Real slug — should be returned
    const real = join(root, "raindrop", "real.example.com", "2026-04-01-real");
    mkdirSync(real, { recursive: true });
    writeFileSync(join(real, "source.json"), JSON.stringify({
      origin: "url:https://real.example.com", origin_url: "https://real.example.com",
      fetcher: "opencli", fetcher_reason: "direct",
      content_sha: "a", content_length: 1000, quality_flags: [], quality_status: "good",
      images: [], notes: [],
    }), "utf8");
    writeFileSync(join(real, "content.md"), "real content", "utf8");

    // Phantom slug — empty dir; should be skipped
    const phantom = join(root, "raindrop", "phantom.example.com", "2026-04-01-phantom");
    mkdirSync(phantom, { recursive: true });

    // Legacy slug — content.md but no source.json (older code shape).
    // Should still appear; backward compat.
    const legacy = join(root, "raindrop", "legacy.example.com", "2026-04-01-legacy");
    mkdirSync(legacy, { recursive: true });
    writeFileSync(join(legacy, "content.md"), "# legacy\n\nlegacy body", "utf8");

    const r = listRawSlugs(root);
    const slugs = r.map(x => x.slug).sort();
    assert.deepEqual(slugs, ["2026-04-01-legacy", "2026-04-01-real"],
      "phantom should be skipped; real + legacy should be returned");
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

test("buildSyncPlan: --exclude-host suffix-matches tenants and skips them", () => {
  const t = makeTmpRawTree();
  try {
    t.addSource("2026-04-01-feishu-tenant", "2026", {
      origin: "url:https://abc.feishu.cn/wiki/X", origin_url: "https://abc.feishu.cn/wiki/X",
      fetcher: "opencli", fetcher_reason: "direct",
      content_sha: "a", content_length: 100, quality_flags: ["short-body"], quality_status: "flagged",
      images: [], notes: [],
    });
    t.addSource("2026-04-02-weixin", "2026", {
      origin: "url:https://mp.weixin.qq.com/s/Z", origin_url: "https://mp.weixin.qq.com/s/Z",
      fetcher: "opencli", fetcher_reason: "direct",
      content_sha: "b", content_length: 100, quality_flags: ["short-body"], quality_status: "flagged",
      images: [], notes: [],
    });
    t.addSource("2026-04-03-other", "2026", {
      origin: "url:https://other.example.com/post", origin_url: "https://other.example.com/post",
      fetcher: "opencli", fetcher_reason: "direct",
      content_sha: "c", content_length: 100, quality_flags: ["short-body"], quality_status: "flagged",
      images: [], notes: [],
    });
    const decisionsPath = join(t.root, "decisions.md");
    writeFileSync(decisionsPath, "", "utf8");
    const plan = buildSyncPlan({
      retryFlagged: true, dryRun: true, reclassify: false,
      excludeHosts: new Set(["feishu.cn", "mp.weixin.qq.com"]),
      rawRoot: t.root, decisionsPath, ingestBatchPath: join(t.root, "no-batch.json"),
    });
    const bySlug = new Map(plan.map(p => [p.slug, p]));
    // feishu tenant matches via suffix `feishu.cn`.
    assert.equal(bySlug.get("2026-04-01-feishu-tenant")!.action, "skip-excluded-host");
    // weixin matches exactly.
    assert.equal(bySlug.get("2026-04-02-weixin")!.action, "skip-excluded-host");
    // Other host falls through to fetch (retry-flagged).
    assert.equal(bySlug.get("2026-04-03-other")!.action, "fetch");
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
// Feature 2: --retry-kind / --retry-prefix / --check-stale
// ---------------------------------------------------------------------------

test("buildSyncPlan: --retry-kind picks only matching slugs (and ignores --retry-flagged)", () => {
  const t = makeTmpRawTree();
  try {
    t.addSource("2026-04-01-good", "2026", {
      origin: "url:https://a.example.com", origin_url: "https://a.example.com",
      fetcher: "opencli", fetcher_reason: "direct", content_sha: "a",
      content_length: 1000, quality_flags: [], quality_status: "good",
      images: [], notes: [],
    });
    t.addSource("2026-04-02-paywall", "2026", {
      origin: "url:https://economictimes.indiatimes.com/x", origin_url: "https://economictimes.indiatimes.com/x",
      fetcher: "opencli", fetcher_reason: "direct", content_sha: "b",
      content_length: 5000, quality_flags: [], quality_status: "good",
      images: [], notes: [],
    });
    t.addSource("2026-04-03-feishu-stub", "2026", {
      origin: "url:https://upiwgvvcb4.feishu.cn/wiki/abc", origin_url: "https://upiwgvvcb4.feishu.cn/wiki/abc",
      fetcher: "opencli", fetcher_reason: "domain-override", content_sha: "c",
      content_length: 400, quality_flags: ["intentional-stub", "feishu-auth-gated"],
      quality_status: "flagged", images: [], notes: [],
    });
    const decisionsPath = join(t.root, "decisions.md");
    writeFileSync(decisionsPath, "", "utf8");

    const plan = buildSyncPlan({
      retryFlagged: false, retryKind: "upstream-paywall",
      dryRun: true, reclassify: false,
      rawRoot: t.root, decisionsPath, ingestBatchPath: join(t.root, "no.json"),
    });

    const fetchSlugs = plan.filter(p => p.action === "fetch").map(p => p.slug);
    assert.deepEqual(fetchSlugs, ["2026-04-02-paywall"]);
    const skipped = plan.find(p => p.slug === "2026-04-03-feishu-stub");
    assert.equal(skipped?.action, "skip-not-in-retry-kind");
    assert.equal(skipped?.failure_kind, "upstream-auth-gated");
  } finally {
    t.cleanup();
  }
});

test("buildSyncPlan: --retry-prefix matches kind family", () => {
  const t = makeTmpRawTree();
  try {
    t.addSource("2026-04-01-clean", "2026", {
      origin: "url:https://blog.example.com/x", origin_url: "https://blog.example.com/x",
      fetcher: "opencli", fetcher_reason: "direct", content_sha: "a",
      content_length: 1000, quality_flags: [], quality_status: "good",
      images: [], notes: [],
    });
    t.addSource("2026-04-02-auth-stub", "2026", {
      origin: "url:https://up.feishu.cn/wiki/x", origin_url: "https://up.feishu.cn/wiki/x",
      fetcher: "opencli", fetcher_reason: "direct", content_sha: "b",
      content_length: 400, quality_flags: ["intentional-stub", "feishu-auth-gated"],
      quality_status: "flagged", images: [], notes: [],
    });
    t.addSource("2026-04-03-deleted-stub", "2026", {
      origin: "url:https://reddit.com/r/X/s/Y", origin_url: "https://reddit.com/r/X/s/Y",
      fetcher: "opencli", fetcher_reason: "direct", content_sha: "c",
      content_length: 400, quality_flags: ["intentional-stub", "reddit-deleted"],
      quality_status: "flagged", images: [], notes: [],
    });
    const decisionsPath = join(t.root, "decisions.md");
    writeFileSync(decisionsPath, "", "utf8");

    const plan = buildSyncPlan({
      retryFlagged: false, retryPrefix: "upstream-",
      dryRun: true, reclassify: false,
      rawRoot: t.root, decisionsPath, ingestBatchPath: join(t.root, "no.json"),
    });

    const fetchSlugs = plan.filter(p => p.action === "fetch").map(p => p.slug).sort();
    assert.deepEqual(fetchSlugs, ["2026-04-02-auth-stub", "2026-04-03-deleted-stub"]);
    const skip = plan.find(p => p.slug === "2026-04-01-clean");
    assert.equal(skip?.action, "skip-not-in-retry-kind");
    assert.equal(skip?.failure_kind, "clean");
  } finally {
    t.cleanup();
  }
});

test("buildSyncPlan: --check-stale + --max-age queues head-check for old good slugs", () => {
  const t = makeTmpRawTree();
  try {
    const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    t.addSource("2026-04-01-old-good", "2026", {
      fetched_at: old,
      origin: "url:https://blog.example.com/old", origin_url: "https://blog.example.com/old",
      fetcher: "opencli", fetcher_reason: "direct", content_sha: "a",
      content_length: 1000, quality_flags: [], quality_status: "good",
      images: [], notes: [],
    });
    t.addSource("2026-04-02-recent-good", "2026", {
      fetched_at: recent,
      origin: "url:https://blog.example.com/recent", origin_url: "https://blog.example.com/recent",
      fetcher: "opencli", fetcher_reason: "direct", content_sha: "b",
      content_length: 1000, quality_flags: [], quality_status: "good",
      images: [], notes: [],
    });
    const decisionsPath = join(t.root, "decisions.md");
    writeFileSync(decisionsPath, "", "utf8");

    const plan = buildSyncPlan({
      retryFlagged: false, checkStale: true, maxAgeDays: 30,
      dryRun: true, reclassify: false,
      rawRoot: t.root, decisionsPath, ingestBatchPath: join(t.root, "no.json"),
    });

    const old_ = plan.find(p => p.slug === "2026-04-01-old-good")!;
    const rec = plan.find(p => p.slug === "2026-04-02-recent-good")!;
    assert.equal(old_.action, "head-check");
    assert.match(old_.reason, />= 30d threshold/);
    assert.equal(rec.action, "skip-good");
  } finally {
    t.cleanup();
  }
});

test("buildSyncPlan: ingested slug → skip-frozen-slug, --force bypasses", () => {
  const t = makeTmpRawTree();
  try {
    t.addSource("2026-04-01-ingested", "2026", {
      origin: "url:https://blog.example.com/post", origin_url: "https://blog.example.com/post",
      fetcher: "opencli", fetcher_reason: "direct", content_sha: "a",
      content_length: 1000, quality_flags: [], quality_status: "good",
      images: [], notes: [],
    });
    t.addSource("2026-04-02-not-ingested", "2026", {
      origin: "url:https://blog.example.com/other", origin_url: "https://blog.example.com/other",
      fetcher: "opencli", fetcher_reason: "direct", content_sha: "b",
      content_length: 1000, quality_flags: ["short-body"], quality_status: "flagged",
      images: [], notes: [],
    });
    const decisionsPath = join(t.root, "decisions.md");
    writeFileSync(decisionsPath, "", "utf8");
    // sources-index has the first slug's URL → ingested
    const sourcesIndexPath = join(t.root, ".wiki-sources-index.json");
    writeFileSync(sourcesIndexPath, JSON.stringify({
      "https://blog.example.com/post": {
        slug: "2026-04-01-ingested",
        repo_path: "Sources/2026/2026-04-01-ingested.md",
        raw_source: "https://blog.example.com/post",
        ingested_at: "2026-04-01",
      },
    }));
    // Without --force: ingested slug is skipped even with --retry-flagged
    const planA = buildSyncPlan({
      retryFlagged: true, dryRun: true, reclassify: false,
      rawRoot: t.root, decisionsPath, ingestBatchPath: join(t.root, "no.json"),
      sourcesIndexPath,
    });
    const ingested = planA.find(p => p.slug === "2026-04-01-ingested");
    const notIngested = planA.find(p => p.slug === "2026-04-02-not-ingested");
    assert.equal(ingested?.action, "skip-frozen-slug", "ingested slug should be skip-frozen-slug");
    assert.equal(notIngested?.action, "fetch", "non-ingested flagged slug should still fetch");

    // With --force: gate bypassed, ingested slug fetches
    const planB = buildSyncPlan({
      retryFlagged: true, dryRun: true, reclassify: false,
      rawRoot: t.root, decisionsPath, ingestBatchPath: join(t.root, "no.json"),
      sourcesIndexPath, force: true,
    });
    const ingestedForced = planB.find(p => p.slug === "2026-04-01-ingested");
    assert.equal(ingestedForced?.action, "skip-good", "force bypasses frozen guard; good slug falls to skip-good");
  } finally {
    t.cleanup();
  }
});

test("buildSyncPlan: missing sources-index file → no frozen guard, all proceed", () => {
  const t = makeTmpRawTree();
  try {
    t.addSource("2026-04-01-good", "2026", {
      origin: "url:https://example.com", origin_url: "https://example.com",
      fetcher: "opencli", fetcher_reason: "direct", content_sha: "a",
      content_length: 1000, quality_flags: [], quality_status: "good",
      images: [], notes: [],
    });
    const decisionsPath = join(t.root, "decisions.md");
    writeFileSync(decisionsPath, "", "utf8");
    // sourcesIndexPath points to a non-existent file
    const plan = buildSyncPlan({
      retryFlagged: false, dryRun: true, reclassify: false,
      rawRoot: t.root, decisionsPath, ingestBatchPath: join(t.root, "no.json"),
      sourcesIndexPath: join(t.root, "missing.json"),
    });
    assert.equal(plan[0].action, "skip-good", "no index → no frozen guard fired");
  } finally {
    t.cleanup();
  }
});

test("buildSyncPlan: failure_kind populated on every existing slug", () => {
  const t = makeTmpRawTree();
  try {
    t.addSource("2026-04-01-good", "2026", {
      origin: "url:https://blog.example.com", origin_url: "https://blog.example.com",
      fetcher: "opencli", fetcher_reason: "direct", content_sha: "a",
      content_length: 1000, quality_flags: [], quality_status: "good",
      images: [], notes: [],
    });
    const decisionsPath = join(t.root, "decisions.md");
    writeFileSync(decisionsPath, "", "utf8");
    const plan = buildSyncPlan({
      retryFlagged: false, dryRun: true, reclassify: false,
      rawRoot: t.root, decisionsPath, ingestBatchPath: join(t.root, "no.json"),
    });
    assert.equal(plan[0].failure_kind, "clean");
  } finally {
    t.cleanup();
  }
});

// ---------------------------------------------------------------------------
// rebuildRawIndex — derives the 3-state field
// ---------------------------------------------------------------------------

test("rebuildRawIndex: state field is 'not-yet-good' for flagged slugs", () => {
  const t = makeTmpRawTree();
  try {
    t.addSource("2026-04-01-flagged", "2026", {
      origin: "url:https://example.com/flagged", origin_url: "https://example.com/flagged",
      fetcher: "opencli", fetcher_reason: "direct", content_sha: "a",
      content_length: 100, quality_flags: ["short-body"], quality_status: "flagged",
      images: [], notes: [],
    });
    const index = rebuildRawIndex(t.root, join(t.root, "no-cache.json"), join(t.root, "no-sources.json"));
    assert.equal(index.slugs["2026-04-01-flagged"].state, "not-yet-good");
  } finally { t.cleanup(); }
});

test("rebuildRawIndex: state field is 'ingest-ready' for good + not-in-index slugs", () => {
  const t = makeTmpRawTree();
  try {
    t.addSource("2026-04-01-good", "2026", {
      origin: "url:https://example.com/good", origin_url: "https://example.com/good",
      fetcher: "opencli", fetcher_reason: "direct", content_sha: "a",
      content_length: 5000, quality_flags: [], quality_status: "good",
      images: [], notes: [],
    });
    // Empty sources index → not ingested
    const sourcesIndexPath = join(t.root, "sources.json");
    writeFileSync(sourcesIndexPath, "{}");
    const index = rebuildRawIndex(t.root, join(t.root, "no-cache.json"), sourcesIndexPath);
    assert.equal(index.slugs["2026-04-01-good"].state, "ingest-ready");
  } finally { t.cleanup(); }
});

test("rebuildRawIndex: state field is 'ingested' when URL is in sources index", () => {
  const t = makeTmpRawTree();
  try {
    t.addSource("2026-04-01-ingested", "2026", {
      origin: "url:https://example.com/ingested", origin_url: "https://example.com/ingested",
      fetcher: "opencli", fetcher_reason: "direct", content_sha: "a",
      content_length: 5000, quality_flags: [], quality_status: "good",
      images: [], notes: [],
    });
    const sourcesIndexPath = join(t.root, "sources.json");
    writeFileSync(sourcesIndexPath, JSON.stringify({
      "https://example.com/ingested": {
        slug: "2026-04-01-ingested",
        repo_path: "Sources/2026/2026-04-01-ingested.md",
        raw_source: "https://example.com/ingested",
        ingested_at: "2026-04-01",
      },
    }));
    const index = rebuildRawIndex(t.root, join(t.root, "no-cache.json"), sourcesIndexPath);
    assert.equal(index.slugs["2026-04-01-ingested"].state, "ingested");
  } finally { t.cleanup(); }
});

test("rebuildRawIndex: 'ingested' wins over 'not-yet-good' when slug is in sources index AND raw is flagged", () => {
  // Edge case: a slug is ingested into the wiki layer (Sources/.../<slug>.md
  // exists, URL is in the sources-index), then later a refetch flags the raw
  // archive (e.g. one image fails to download). The wiki layer is still the
  // canonical artifact; quality regressions on the raw side after-the-fact
  // don't reset the slug to not-yet-good. Operator may choose to re-ingest
  // (or not) but until they do, the state is 'ingested'. Surfaced concretely
  // by the blog.google Ironwood slug after the srcset-fix refetch flagged
  // one image-download as partial.
  const t = makeTmpRawTree();
  try {
    t.addSource("2026-04-01-ingested-but-flagged", "2026", {
      origin: "url:https://example.com/ingested-flagged",
      origin_url: "https://example.com/ingested-flagged",
      fetcher: "opencli", fetcher_reason: "direct", content_sha: "a",
      content_length: 5000,
      // raw is flagged (image-download-partial-style scenario)
      quality_flags: ["image-download-partial"],
      quality_status: "flagged",
      images: [], notes: [],
    });
    const sourcesIndexPath = join(t.root, "sources.json");
    // Sources/<slug>.md exists (URL in index)
    writeFileSync(sourcesIndexPath, JSON.stringify({
      "https://example.com/ingested-flagged": {
        slug: "2026-04-01-ingested-but-flagged",
        repo_path: "Sources/2026/2026-04-01-ingested-but-flagged.md",
        raw_source: "https://example.com/ingested-flagged",
        ingested_at: "2026-04-01",
      },
    }));
    const index = rebuildRawIndex(t.root, join(t.root, "no-cache.json"), sourcesIndexPath);
    assert.equal(
      index.slugs["2026-04-01-ingested-but-flagged"].state,
      "ingested",
      "Ingested-with-flagged-raw should stay ingested — the wiki layer is the canonical artifact",
    );
  } finally { t.cleanup(); }
});

test("rebuildRawIndex: state field handles share-aggregator unwrap (P-32)", () => {
  // Slug stored under the unwrapped target; sources-index keyed by
  // the wrapper URL. The unwrap-aware widening in loadIngestedUrlSet
  // means the slug should still resolve as `ingested`.
  const t = makeTmpRawTree();
  try {
    t.addSource("2025-06-09-shared", "2025", {
      origin: "url:https://linux.do/t/topic/537374", origin_url: "https://linux.do/t/topic/537374",
      fetcher: "opencli", fetcher_reason: "direct", content_sha: "a",
      content_length: 5000, quality_flags: [], quality_status: "good",
      images: [], notes: [],
    });
    const sourcesIndexPath = join(t.root, "sources.json");
    // Operator wrote the wrapper URL in Sources/<slug>.md frontmatter
    writeFileSync(sourcesIndexPath, JSON.stringify({
      "https://share.google?link=https://linux.do/t/topic/537374": {
        slug: "2025-06-09-shared",
        repo_path: "Sources/2025/2025-06-09-shared.md",
        raw_source: "https://share.google?link=https://linux.do/t/topic/537374",
        ingested_at: "2025-06-09",
      },
    }));
    const index = rebuildRawIndex(t.root, join(t.root, "no-cache.json"), sourcesIndexPath);
    assert.equal(index.slugs["2025-06-09-shared"].state, "ingested");
  } finally { t.cleanup(); }
});

// ---------------------------------------------------------------------------
// isFetchRegression — downgrade-protection heuristic
// ---------------------------------------------------------------------------

function mkSource(over: Partial<SourceJson> = {}): SourceJson {
  return {
    fetched_at: "2026-05-01T00:00:00Z",
    origin: "url:https://example.com",
    origin_url: "https://example.com",
    fetcher: "opencli",
    fetcher_reason: "direct",
    content_sha: "abc",
    content_length: 5000,
    quality_flags: [],
    quality_status: "good",
    images: [],
    notes: [],
    ...over,
  };
}

test("isFetchRegression: prev good (5000c) + new stub (200c, intentional-stub) → true", () => {
  const prev = mkSource({ content_length: 5000, quality_flags: [] });
  const next = { content_length: 200, quality_flags: ["intentional-stub", "_default-fetch-failed"] };
  assert.equal(isFetchRegression(prev, next), true);
});

test("isFetchRegression: prev good + new good but smaller (within factor of 3) → false", () => {
  const prev = mkSource({ content_length: 5000, quality_flags: [] });
  // 4500 / 5000 = 90% — well above 30% threshold, no regression
  const next = { content_length: 4500, quality_flags: [] };
  assert.equal(isFetchRegression(prev, next), false);
});

test("isFetchRegression: prev good + new good but tiny (no stub flags) → false", () => {
  const prev = mkSource({ content_length: 5000, quality_flags: [] });
  // 100 / 5000 = 2% — but no stub flags. Treat as legitimate edit, don't refuse.
  const next = { content_length: 100, quality_flags: ["short-body"] };
  assert.equal(isFetchRegression(prev, next), false);
});

test("isFetchRegression: prev stub + new stub → false (no preservable content)", () => {
  const prev = mkSource({ content_length: 200, quality_flags: ["intentional-stub", "_default-fetch-failed"] });
  const next = { content_length: 100, quality_flags: ["intentional-stub", "_default-fetch-failed"] };
  assert.equal(isFetchRegression(prev, next), false);
});

test("isFetchRegression: prev null → false (no comparison possible)", () => {
  const next = { content_length: 200, quality_flags: ["intentional-stub"] };
  assert.equal(isFetchRegression(null, next), false);
});

test("isFetchRegression: real corpus pattern — wangzhiyu 9674c → 802c stub", () => {
  // From revisions.jsonl observed in the live corpus.
  const prev = mkSource({ content_length: 9674, quality_flags: ["_default-used-browser-fallback"] });
  const next = { content_length: 802, quality_flags: ["intentional-stub", "_default-fetch-failed"] };
  assert.equal(isFetchRegression(prev, next), true);
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
