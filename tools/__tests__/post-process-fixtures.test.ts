/**
 * Fixture-based tests for the post-processors that had zero coverage
 * before plan H3. Each test case pairs a canned "dirty" markdown input
 * with the expected "clean" output. Asserts on SUBSTRINGS rather than
 * exact whole-file matches so the tests tolerate unrelated cosmetic
 * touch-ups (newline collapsing, etc.).
 *
 * Processors covered here:
 *   - substackReformat (4 cases)
 *   - xhsReformatNoteTable (3 cases)
 *   - arxivStripTrailingChrome + arxivStructureImprove (2 cases each)
 *   - stripEmptyAnchorLinks (2 cases)
 *   - unescapeBracketsInLinks (2 cases)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { xhsReformatNoteTable } from "../hirono/processors/xiaohongshu.ts";
import {
  substackReformat,
  arxivStripTrailingChrome,
  arxivStructureImprove,
  arxivPdfNote,
  enforceSingleH1,
  stripEmptyAnchorLinks,
  stripDecorativeEmojiImages,
  stripTrailingTagList,
  stripShareWidgetLines,
  blogGoogleCleanup,
  huggingfaceBlogReformat,
  redditReformat,
  unescapeBracketsInLinks,
  xMetadataStub,
  applyPostProcessors,
} from "../hirono/shared/post-process.ts";
import { validateStructure, formatViolations } from "./structural-rules.ts";

/**
 * Assert that processor output passes the structural-rule layer.
 * Use this as a backstop for post-processor tests where substring
 * matchers might false-pass on broken output (e.g. multi-line link
 * wrappers, over-escaped emoji shortcodes, triple newlines).
 *
 * Layer this ON TOP of existing substring assertions:
 *   assert.match(r.md, /Actual article body/);  // content survives
 *   assertStructurallyClean(r.md, "case label");  // shape is clean
 */
function assertStructurallyClean(md: string, label: string): void {
  const violations = validateStructure(md);
  if (violations.length > 0) {
    assert.fail(formatViolations(violations, label));
  }
}

// ---------------------------------------------------------------------------
// substackReformat
// ---------------------------------------------------------------------------

test("substackReformat: strips header chrome (author, date, counters)", () => {
  const md = [
    "# Our Title",
    "",
    "---",
    "",
    "# AWS Trainium3 Deep Dive",
    "",
    "### A potential path to winning back share",
    "",
    "[Dylan Patel](https://substack.com/@semianalysis), [Kimbo Chen](https://substack.com/@kimbobachen)",
    "",
    "Jun 23, 2025",
    "",
    "∙ Paid",
    "",
    "19",
    "",
    "1",
    "",
    "Share",
    "",
    "Actual article body starts here.",
    "",
    "More content.",
  ].join("\n");
  const r = substackReformat.transform(md, "https://newsletter.semianalysis.com/p/aws-trainium3");
  assert.match(r.md, /Actual article body/);
  assert.doesNotMatch(r.md, /∙ Paid/);
  assert.doesNotMatch(r.md, /Jun 23, 2025/);
  assert.doesNotMatch(r.md, /AWS Trainium3 Deep Dive/, "article's own H1 is chrome (second H1 dropped)");
  assert.doesNotMatch(r.md, /^\d+$/m, "raw counter lines should be gone");
  // Shape-anchored: no chrome line MUST appear — line-anchor each label
  assert.doesNotMatch(r.md, /^Share$/m, "bare 'Share' line is chrome");
  assert.doesNotMatch(r.md, /^∙ Paid$/m, "bare '∙ Paid' line is chrome");
  assert.ok(r.notes.some((n) => /stripped.*header/i.test(n)));
  // Structural-rule backstop: catches multi-line wrappers, over-escapes,
  // triple newlines, etc. that substring matchers miss.
  assertStructurallyClean(r.md, "substackReformat: header chrome");
});

test("substackReformat: collapses embedded post-card", () => {
  const md = [
    "# Our Title",
    "",
    "---",
    "",
    "# Article Title",
    "",
    "[Dylan Patel](https://substack.com/@semianalysis)",
    "",
    "Nov 1, 2025",
    "",
    "42",
    "",
    "10",
    "",
    "Share",
    "",
    "Some body text.",
    "",
    "[",
    "",
    "#### Google AI Infrastructure Supremacy",
    "",
    "](https://newsletter.semianalysis.com/p/google-infra-supremacy)",
    "",
    "[](https://newsletter.semianalysis.com/p/google-infra-supremacy)[Dylan Patel](https://substack.com/profile/abc) and 2 others",
    "",
    "·",
    "",
    "Jun 15, 2025",
    "",
    "[",
    "",
    "Read full story",
    "",
    "](https://newsletter.semianalysis.com/p/google-infra-supremacy)",
    "",
    "More body text after.",
  ].join("\n");
  const r = substackReformat.transform(md, "https://newsletter.semianalysis.com/p/x");
  assert.match(r.md, /Related:.*Google AI Infrastructure/);
  assert.match(r.md, /Dylan Patel/);
  assert.doesNotMatch(r.md, /#### Google AI/, "embedded H4 title gone; collapsed to blockquote");
  assert.doesNotMatch(r.md, /Read full story/);
  assert.ok(r.notes.some((n) => /collapsed.*card/i.test(n)));
});

test("substackReformat: unwraps click-to-enlarge image links", () => {
  const md = [
    "# Foo",
    "",
    "Paragraph.",
    "",
    "[",
    "",
    "![figure](https://substackcdn.com/image/fetch/f_auto,q_auto:good/abc.png)",
    "",
    "](https://substackcdn.com/image/fetch/abc.png)",
    "",
    "More text.",
  ].join("\n");
  const r = substackReformat.transform(md, "https://substack.com/foo");
  // After unwrap, the `![]()` should be standalone, NOT wrapped in `[...]()`
  assert.match(r.md, /!\[figure\]\(https:\/\/substackcdn\.com\/image\/fetch\/f_auto,q_auto:good\/abc\.png\)/);
  assert.doesNotMatch(r.md, /\]\(https:\/\/substackcdn\.com\/image\/fetch\/abc\.png\)/);
  assert.ok(r.notes.some((n) => /unwrapped.*click-to-enlarge/i.test(n)));
});

test("substackReformat: truncates at paywall marker", () => {
  const md = [
    "# Article",
    "",
    "Body paragraph before paywall.",
    "",
    "## This post is for paid subscribers",
    "",
    "## Continue reading",
    "",
    "[Subscribe](https://example.substack.com/subscribe?ref=paywall)",
  ].join("\n");
  const r = substackReformat.transform(md, "https://newsletter.semianalysis.com/foo");
  assert.match(r.md, /Body paragraph before paywall/);
  assert.doesNotMatch(r.md, /This post is for paid/);
  assert.doesNotMatch(r.md, /Continue reading/);
  assert.ok(r.notes.some((n) => /truncated.*paywall/i.test(n)));
});

test("substackReformat: no-op on non-substack URL", () => {
  const md = "# Not substack\n\n[Author](https://substack.com/@foo)\n\nNov 1, 2025\n\nBody.";
  assert.equal(substackReformat.match("https://example.com/x", "example.com"), false);
});

// ---------------------------------------------------------------------------
// xhsReformatNoteTable
// ---------------------------------------------------------------------------

test("xhsReformatNoteTable: standard note with title + author + content + images", () => {
  const md = [
    "| field | value |",
    "| --- | --- |",
    "| title | Megatron 训练心得 |",
    "| author | someone |",
    "| likes | 123 |",
    "| comments | 45 |",
    "| collects | 67 |",
    "| content | 今天分享一下训练过程  📌 第一点很重要  👉 看这里 |",
    "| tags | #AI #training |",
    "",
    "## Images",
    "",
    "![](images/img_001.jpg)",
  ].join("\n");
  const r = xhsReformatNoteTable.transform(md, "https://www.xiaohongshu.com/discovery/item/abc");
  assert.match(r.md, /^# Megatron 训练心得/m);
  assert.match(r.md, /^> 原文链接: https:\/\/www\.xiaohongshu\.com/m);
  assert.match(r.md, /^> 作者: someone/m);
  assert.match(r.md, /^> 互动: 123 likes.*67 collects.*45 comments/m);
  assert.match(r.md, /\*\*标签 \/ Tags:\*\* #AI #training/);
  assert.match(r.md, /## Images[\s\S]*img_001\.jpg/);
  // emoji-based line-breaks
  assert.match(r.md, /\n\n📌 第一点很重要/);
  assert.match(r.md, /\n\n👉 看这里/);
});

test("xhsReformatNoteTable: image-only post (no content)", () => {
  const md = [
    "| field | value |",
    "| --- | --- |",
    "| title | 图片笔记 |",
    "| content |  |",
    "",
    "## Images",
    "",
    "![](images/a.jpg)",
  ].join("\n");
  const r = xhsReformatNoteTable.transform(md, "https://xhslink.com/x/abc");
  assert.match(r.md, /Text content unavailable/);
  assert.match(r.md, /image-only post/);
  assert.match(r.md, /## Images[\s\S]*a\.jpg/);
});

test("xhsReformatNoteTable: no table → no-op", () => {
  const md = "# Normal markdown\n\nNo table here.";
  const r = xhsReformatNoteTable.transform(md, "https://www.xiaohongshu.com/foo");
  assert.equal(r.md, md);
  assert.equal(r.notes.length, 0);
});

// ---------------------------------------------------------------------------
// arxivStripTrailingChrome
// ---------------------------------------------------------------------------

test("arxivStripTrailingChrome: cuts at 'Submission history'", () => {
  const md = [
    "# Foo",
    "Body of the page.",
    "## Abstract",
    "Abstract text.",
    "## Submission history",
    "v1 submitted blah.",
    "",
    "### Bookmark",
    "Bookmark stuff.",
  ].join("\n");
  const r = arxivStripTrailingChrome.transform(md, "https://arxiv.org/abs/1234.5678");
  assert.match(r.md, /Abstract text/);
  assert.doesNotMatch(r.md, /Submission history/);
  assert.doesNotMatch(r.md, /Bookmark/);
  assert.ok(r.notes.some((n) => /truncated.*trailing/i.test(n)));
});

test("arxivStripTrailingChrome: cuts at 'Full-text links'", () => {
  const md = [
    "# Paper",
    "Abstract:",
    "Some abstract.",
    "Full-text links:",
    "PDF link stuff.",
  ].join("\n");
  const r = arxivStripTrailingChrome.transform(md, "https://arxiv.org/abs/1234");
  assert.doesNotMatch(r.md, /Full-text links/);
  assert.doesNotMatch(r.md, /PDF link stuff/);
});

test("arxivStripTrailingChrome: no-op when no chrome markers", () => {
  const md = "# Clean\n\nBody.";
  const r = arxivStripTrailingChrome.transform(md, "https://arxiv.org/abs/x");
  assert.equal(r.md, md);
  assert.equal(r.notes.length, 0);
});

test("arxivStripTrailingChrome: only runs for non-/abs/ arxiv URLs (abstract pages handled by tools/sites/arxiv/)", () => {
  assert.equal(arxivStripTrailingChrome.match("https://notarxiv.com/x", "notarxiv.com"), false);
  // /abs/ URLs are now handled by the arxiv site module; the legacy
  // chrome-strip post-processor must NOT fire on them.
  assert.equal(arxivStripTrailingChrome.match("https://arxiv.org/abs/x", "arxiv.org"), false);
  // Other arxiv paths (e.g. /pdf/) still go through the legacy path.
  assert.equal(arxivStripTrailingChrome.match("https://arxiv.org/pdf/x", "arxiv.org"), true);
});

// ---------------------------------------------------------------------------
// arxivStructureImprove
// ---------------------------------------------------------------------------

test("arxivStructureImprove: rebuilds into title + metadata + abstract", () => {
  const md = [
    "# Computer Science > Machine Learning",
    "",
    "# Attention Is All You Need",
    "",
    "Authors: [Ashish Vaswani](x), [Noam Shazeer](y), [Niki Parmar](z)",
    "",
    "Subjects:",
    "",
    "Machine Learning (cs.LG); Computation and Language (cs.CL)",
    "",
    "\\[Submitted on 12 Jun 2017 ([v1](x))\\]",
    "",
    "> Abstract: The dominant sequence transduction models...",
    "> continue abstract on next line",
    "",
    "[View PDF](/pdf/1706.03762v5)",
    "",
    "[HTML (experimental)](https://arxiv.org/html/1706.03762)",
    "",
    "[https://doi.org/10.48550/arXiv.1706.03762](https://example)",
  ].join("\n");
  const r = arxivStructureImprove.transform(md, "https://arxiv.org/abs/1706.03762");
  assert.match(r.md, /^# Attention Is All You Need|^# Computer Science/m);
  assert.match(r.md, /\*\*arXiv ID:\*\*/);
  assert.match(r.md, /\*\*Submitted:\*\* 12 Jun 2017/);
  assert.match(r.md, /\*\*Subjects:\*\* Machine Learning/);
  assert.match(r.md, /\*\*Authors:\*\* Ashish Vaswani, Noam Shazeer, Niki Parmar/);
  assert.match(r.md, /\*\*Links:\*\*.*PDF.*HTML.*DOI/);
  assert.match(r.md, /## Abstract[\s\S]*dominant sequence/);
});

test("arxivStructureImprove: collapses >10 authors", () => {
  const authorLinks = Array.from({ length: 15 }, (_, i) => `[Author ${i + 1}](u${i})`).join(", ");
  const md = [
    "# Paper",
    "",
    `Authors: ${authorLinks}`,
    "",
    "> Abstract: Lorem ipsum.",
  ].join("\n");
  const r = arxivStructureImprove.transform(md, "https://arxiv.org/abs/9999");
  assert.match(r.md, /\*\*Authors:\*\* Author 1, Author 2[^\n]*and 5 more/);
  assert.ok(r.notes.some((n) => /collapsed 15-author/.test(n)));
});

// (deepwikiWrapDiagramNodes retired — wiki.litenext.digital + deepwiki.com
//  migrated to tools/sites/deepwiki/ which extracts mermaid sources directly,
//  so the exploded-node-list runs this processor wrapped never appear in the
//  pipeline. The 4 tests for it were deleted along with the code.)

// ---------------------------------------------------------------------------
// stripEmptyAnchorLinks
// ---------------------------------------------------------------------------

test("stripEmptyAnchorLinks: removes `[](#anchor)` lines", () => {
  const md = [
    "# Title",
    "",
    "[](#section-id)",
    "Body text.",
    "",
    "[](#another)",
    "More body.",
  ].join("\n");
  const r = stripEmptyAnchorLinks.transform(md, "https://example.com");
  assert.doesNotMatch(r.md, /\[\]\(#section-id\)/);
  assert.doesNotMatch(r.md, /\[\]\(#another\)/);
  assert.match(r.md, /Body text/);
  assert.match(r.md, /More body/);
  assert.ok(r.notes.some((n) => /stripped 2 empty-text anchor/.test(n)));
});

test("stripEmptyAnchorLinks: leaves `[text](#anchor)` alone", () => {
  const md = "# X\n\n[Jump to section](#foo)\n\nBody.";
  const r = stripEmptyAnchorLinks.transform(md, "https://example.com");
  assert.match(r.md, /\[Jump to section\]\(#foo\)/);
  assert.equal(r.notes.length, 0);
});

// ---------------------------------------------------------------------------
// unescapeBracketsInLinks
// ---------------------------------------------------------------------------

test("unescapeBracketsInLinks: unescapes backslash-bracket inside link text", () => {
  const md = "See [\\[profile\\_data\\]](https://example.com/x) for details.";
  const r = unescapeBracketsInLinks.transform(md, "https://example.com");
  assert.match(r.md, /\[\[profile_data\]\]\(https:\/\/example\.com\/x\)/);
  assert.ok(r.notes.some((n) => /un-escaped/.test(n)));
});

test("unescapeBracketsInLinks: no-op when nothing escaped", () => {
  const md = "[plain link](https://example.com)";
  const r = unescapeBracketsInLinks.transform(md, "https://example.com");
  assert.equal(r.md, md);
  assert.equal(r.notes.length, 0);
});

test("unescapeBracketsInLinks: does not break on URL containing `)`", () => {
  // Regex stops at first `)`. This is a known limitation but shouldn't crash.
  const md = "[text](https://example.com/foo)";
  const r = unescapeBracketsInLinks.transform(md, "https://example.com");
  assert.equal(r.md, md);
});

// ---------------------------------------------------------------------------
// Pipeline smoke test — processors compose without errors on combined input
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// enforceSingleH1
// ---------------------------------------------------------------------------

test("enforceSingleH1: demotes body H1s to H2 (fence-aware)", () => {
  const md = [
    "# Frontmatter Title",
    "",
    "> 原文链接: https://example.com/x",
    "",
    "---",
    "",
    "# Section A",
    "",
    "Body of A.",
    "",
    "```python",
    "# This is a code comment, not a heading",
    "x = 1",
    "```",
    "",
    "# Section B",
    "",
    "Body of B.",
  ].join("\n");
  const r = enforceSingleH1.transform(md, "https://example.com/x");
  // Only the frontmatter H1 should remain at column 0 outside fences.
  assert.match(r.md, /^# Frontmatter Title$/m);
  assert.match(r.md, /^## Section A$/m);
  assert.match(r.md, /^## Section B$/m);
  // Code-fence comment was preserved as `# This is a code comment`
  assert.match(r.md, /# This is a code comment/);
});

test("enforceSingleH1: dedupes consecutive identical demoted H2 pair", () => {
  // The dedup fires when the BODY contains two consecutive identical H1s
  // (substack pattern — opening title + repeated subhead). After demoting
  // both to H2 they collapse to one.
  const md = [
    "# Frontmatter",
    "",
    "---",
    "",
    "# Body Title",
    "",
    "# Body Title",
    "",
    "Body.",
  ].join("\n");
  const r = enforceSingleH1.transform(md, "https://example.com/x");
  // Two `# Body Title` body H1s → demote to ## → dedup → one H2
  const h2Count = (r.md.match(/^## Body Title$/gm) || []).length;
  assert.equal(h2Count, 1);
});

test("enforceSingleH1: replaces truncated preamble title with full body H1", () => {
  // When the preamble H1 is a strict prefix of the body H1 ending at a word
  // boundary (slug-truncation case, e.g. blog.google), promote the body title.
  const md = [
    "# Introducing Pathways: A next",
    "",
    "> 发布时间: 2021-10-28",
    "> 原文链接: https://blog.google/foo/",
    "",
    "---",
    "",
    "# Introducing Pathways: A next-generation AI architecture",
    "",
    "Body.",
  ].join("\n");
  const r = enforceSingleH1.transform(md, "https://blog.google/foo/");
  assert.match(r.md, /^# Introducing Pathways: A next-generation AI architecture$/m);
  // The duplicate body H1 is gone (NOT demoted to H2 — fully removed).
  const fullCount = (r.md.match(/Introducing Pathways: A next-generation/g) || []).length;
  assert.equal(fullCount, 1, "full title should appear exactly once (preamble only)");
});

test("enforceSingleH1: strips orphan content between title and metadata", () => {
  // Multi-line tweet titles produce orphan paragraphs between the H1 and
  // the `> 原文链接:` blockquote. Those paragraphs should be stripped.
  const md = [
    "# (20) X 上的 Garry Tan: tweet text starts here",
    "",
    "It's exactly my OpenClaw setup.",
    "",
    'https://t.co/abc" / X',
    "",
    "> 发布时间: 2026-04-10",
    "> 原文链接: https://x.com/garrytan/status/12345",
    "",
    "---",
    "",
    "Real body.",
  ].join("\n");
  const r = enforceSingleH1.transform(md, "https://x.com/garrytan/status/12345");
  assert.doesNotMatch(r.md, /It's exactly my OpenClaw setup/);
  assert.doesNotMatch(r.md, /https:\/\/t\.co\/abc/);
  // H1 and metadata both survive
  assert.match(r.md, /^# \(20\) X 上的 Garry Tan: tweet text starts here$/m);
  assert.match(r.md, /^> 原文链接: https:\/\/x\.com/m);
  assert.match(r.md, /^Real body\./m);
});

test("enforceSingleH1: no-op when there's no separator", () => {
  // Files without `\n---\n` (some legacy fetches) should pass through unchanged.
  const md = "# Just a Title\n\nNo separator here.\n";
  const r = enforceSingleH1.transform(md, "https://example.com/x");
  assert.equal(r.md, md);
});

// ---------------------------------------------------------------------------
// stripDecorativeEmojiImages
// ---------------------------------------------------------------------------

test("stripDecorativeEmojiImages: replaces twemoji image refs with shortcode", () => {
  const md = "Cool ![:high_voltage:](https://linux.do/images/emoji/twemoji/high_voltage.png?v=15) feature.";
  const r = stripDecorativeEmojiImages.transform(md, "https://linux.do/t/topic/1");
  assert.match(r.md, /Cool :high_voltage: feature/);
  assert.doesNotMatch(r.md, /twemoji/);
});

test("stripDecorativeEmojiImages: leaves real images alone", () => {
  const md = "![Fig 1: Architecture](images/img_001.png)";
  const r = stripDecorativeEmojiImages.transform(md, "https://example.com/x");
  assert.equal(r.md, md);
});

// ---------------------------------------------------------------------------
// stripTrailingTagList
// ---------------------------------------------------------------------------

test("stripTrailingTagList: strips concatenated tag-link footer line", () => {
  const md = [
    "Real article body.",
    "",
    "Final prose paragraph.",
    "",
    "[Developer Platform](/tag/developer-platform/)[AI](/tag/ai/)[Workers](/tag/workers/)",
  ].join("\n");
  const r = stripTrailingTagList.transform(md, "https://blog.cloudflare.com/x");
  assert.doesNotMatch(r.md, /\/tag\//);
  assert.match(r.md, /Final prose paragraph/);
});

test("stripTrailingTagList: ignores tag-list NOT at the tail", () => {
  // Same shape, but with prose AFTER it — only trailing chrome is stripped.
  const md = [
    "Intro.",
    "",
    "[A](/tag/a/)[B](/tag/b/)",
    "",
    "More content here.",
  ].join("\n");
  const r = stripTrailingTagList.transform(md, "https://example.com/x");
  // Should be a no-op since the tag-list isn't at the tail
  assert.equal(r.md, md);
});

// ---------------------------------------------------------------------------
// stripShareWidgetLines
// ---------------------------------------------------------------------------

test("stripShareWidgetLines: strips bare `Share` / `Copy link` lines in body", () => {
  const md = [
    "# Title",
    "",
    "> 原文链接: https://example.com/x",
    "",
    "---",
    "",
    "Article body.",
    "",
    "Share",
    "",
    "More body.",
    "",
    "Copy link",
    "",
    "Final.",
  ].join("\n");
  const r = stripShareWidgetLines.transform(md, "https://example.com/x");
  assert.doesNotMatch(r.md, /^Share$/m);
  assert.doesNotMatch(r.md, /^Copy link$/m);
  assert.match(r.md, /Article body/);
  assert.match(r.md, /More body/);
  assert.match(r.md, /Final/);
});

test("stripShareWidgetLines: leaves preamble metadata blockquotes alone", () => {
  // A `> Share: ...` line in preamble should NOT be touched.
  const md = [
    "# Title",
    "",
    "> Share: https://example.com",
    "",
    "---",
    "",
    "Body.",
  ].join("\n");
  const r = stripShareWidgetLines.transform(md, "https://example.com/x");
  assert.match(r.md, /^> Share: https:\/\//m);
});

test("stripShareWidgetLines: leaves prose containing 'Share' alone", () => {
  // 'Share' as part of a sentence (not a bare line) should survive.
  const md = [
    "# Title",
    "",
    "---",
    "",
    "Click Share to share this article.",
  ].join("\n");
  const r = stripShareWidgetLines.transform(md, "https://example.com/x");
  assert.match(r.md, /Click Share to share/);
});

// ---------------------------------------------------------------------------
// blogGoogleCleanup
// ---------------------------------------------------------------------------

test("blogGoogleCleanup: strips social-share + author block + byline", () => {
  const md = [
    "# Title",
    "",
    "---",
    "",
    "[",
    "",
    "x.com",
    "",
    "](https://twitter.com/intent/tweet?text=foo)[",
    "",
    "Facebook",
    "",
    "](https://www.facebook.com/sharer/sharer.php?u=foo)[",
    "",
    "LinkedIn",
    "",
    "](https://www.linkedin.com/shareArticle?url=foo)[",
    "",
    "Mail",
    "",
    "](mailto:?subject=foo)",
    "Copy link",
    "",
    "Real article body.",
    "",
    "Oct 28, 2021",
    "",
    "·",
    "",
    "5 min read",
    "",
    "More body.",
  ].join("\n");
  const r = blogGoogleCleanup.transform(md, "https://blog.google/foo/");
  assert.doesNotMatch(r.md, /twitter\.com\/intent/);
  assert.doesNotMatch(r.md, /facebook\.com\/sharer/);
  assert.doesNotMatch(r.md, /Copy link/);
  assert.doesNotMatch(r.md, /Oct 28, 2021/);
  assert.doesNotMatch(r.md, /5 min read/);
  assert.match(r.md, /Real article body/);
  assert.match(r.md, /More body/);
});

test("blogGoogleCleanup: only fires for blog.google", () => {
  assert.equal(blogGoogleCleanup.match("https://blog.google/foo", "blog.google"), true);
  assert.equal(blogGoogleCleanup.match("https://example.com/", "example.com"), false);
});

// ---------------------------------------------------------------------------
// huggingfaceBlogReformat: 404 stub branch
// ---------------------------------------------------------------------------

test("huggingfaceBlogReformat: 404 page short-circuits to intentional-stub", () => {
  const md = [
    "# 404",
    "",
    "This blog post does not exist",
  ].join("\n");
  const r = huggingfaceBlogReformat.transform(md, "https://huggingface.co/blog/bogus-slug");
  assert.match(r.md, /HuggingFace Blog Post \(not found\)/);
  assert.match(r.md, /\*\*Source:\*\* https:\/\/huggingface\.co\/blog\/bogus-slug/);
  assert.match(r.md, /\*\*Status:\*\* page-removed/);
  assert.ok(r.extraFlags?.includes("intentional-stub"));
});

test("huggingfaceBlogReformat: real blog post does NOT short-circuit", () => {
  const md = [
    "# SmolLM3: smol, multilingual, long",
    "",
    "Real intro paragraph.",
  ].join("\n");
  const r = huggingfaceBlogReformat.transform(md, "https://huggingface.co/blog/smollm3");
  // Should pass through (no 404 stub)
  assert.doesNotMatch(r.md, /page-removed/);
  assert.ok(!r.extraFlags?.includes("intentional-stub"));
});

// ---------------------------------------------------------------------------
// redditReformat: deleted / blocked stubs
// ---------------------------------------------------------------------------

test("redditReformat: [deleted by user] short-circuits to intentional-stub", () => {
  const md = [
    "# [deleted by user] : r/ClaudeAI",
    "",
    "> 发布时间: 2025-10-07",
    "",
    "---",
    "",
    "Some chrome.",
  ].join("\n");
  const r = redditReformat.transform(md, "https://www.reddit.com/r/ClaudeAI/s/abc");
  assert.match(r.md, /Reddit post \(deleted or removed\)/);
  assert.match(r.md, /page-removed/);
  assert.ok(r.extraFlags?.includes("intentional-stub"));
});

test("redditReformat: rate-limited (Check Claude service status) → stub", () => {
  const md = [
    "# Pro Tip: ... : r/ClaudeAI",
    "",
    "---",
    "",
    "[Check Claude service status.](http://status.claude.com)",
  ].join("\n");
  const r = redditReformat.transform(md, "https://www.reddit.com/r/ClaudeAI/s/xyz");
  assert.match(r.md, /Reddit post \(unreachable\)/);
  assert.match(r.md, /fetch-blocked/);
  assert.ok(r.extraFlags?.includes("intentional-stub"));
});

test("redditReformat: real long post is NOT stubbed", () => {
  const md = [
    "# Some interesting Reddit thread : r/ClaudeAI",
    "",
    "---",
    "",
    // Long real body
    "This is a substantive Reddit thread with multiple paragraphs of content. ".repeat(20),
  ].join("\n");
  const r = redditReformat.transform(md, "https://www.reddit.com/r/ClaudeAI/comments/abc");
  assert.doesNotMatch(r.md, /Reddit post \(deleted/);
  assert.doesNotMatch(r.md, /Reddit post \(unreachable\)/);
  assert.ok(!r.extraFlags?.includes("intentional-stub"));
});

// ---------------------------------------------------------------------------
// arxivPdfNote: thin-fetch stub
// ---------------------------------------------------------------------------

test("arxivPdfNote: thin PDF fetch (<1500 chars) → stub pointing at abstract", () => {
  const md = "# untitled\n\nSome very thin PDF text.";
  const r = arxivPdfNote.transform(md, "https://arxiv.org/pdf/2402.13499");
  assert.match(r.md, /arXiv Paper \(PDF-only fetch\)/);
  assert.match(r.md, /\*\*Abstract:\*\* https:\/\/arxiv\.org\/abs\/2402\.13499/);
  assert.match(r.md, /pdf-extraction-incomplete/);
  assert.ok(r.extraFlags?.includes("intentional-stub"));
});

test("arxivPdfNote: substantial PDF fetch keeps body + adds abstract note", () => {
  const md = "# Paper Title\n\n" + "Real paper body. ".repeat(200);
  const r = arxivPdfNote.transform(md, "https://arxiv.org/pdf/2402.13499");
  assert.match(r.md, /Paper Title/);
  assert.match(r.md, /Note:\*\* This was fetched from a PDF URL/);
  assert.match(r.md, /\[abstract page\]\(https:\/\/arxiv\.org\/abs\/2402\.13499\)/);
  assert.ok(!r.extraFlags?.includes("intentional-stub"));
});

// (deepwikiStripNav extended-test retired together with the processor —
//  see the deepwiki migration commit. The `.prose`-direct extraction in
//  tools/sites/deepwiki/ never includes the sidebar nav / dup H1 / trailing
//  TOC, so the post-processor stripping them is no longer needed.)

// ---------------------------------------------------------------------------
// Pipeline composition: applyPostProcessors with the new processors
// ---------------------------------------------------------------------------

test("applyPostProcessors: blog.google end-to-end (chrome + truncated H1)", () => {
  const md = [
    "# Introducing Pathways: A next",
    "",
    "> 原文链接: https://blog.google/innovation-and-ai/products/introducing-pathways/",
    "",
    "---",
    "# Introducing Pathways: A next-generation AI architecture",
    "",
    "Oct 28, 2021",
    "",
    "·",
    "",
    "5 min read",
    "",
    "Real body content.",
  ].join("\n");
  const r = applyPostProcessors(md, "https://blog.google/innovation-and-ai/products/introducing-pathways/");
  assert.match(r.md, /^# Introducing Pathways: A next-generation AI architecture$/m);
  // Body H1 dedup'd, byline stripped
  assert.doesNotMatch(r.md, /^# Introducing Pathways: A next$/m);
  assert.doesNotMatch(r.md, /Oct 28, 2021/);
  assert.doesNotMatch(r.md, /5 min read/);
  assert.match(r.md, /Real body content/);
  assert.ok(r.appliedNames.includes("blog-google-cleanup"));
  assert.ok(r.appliedNames.includes("enforce-single-h1"));
});

test("applyPostProcessors: cross-host processors run on substack-like input (substack-reformat retired — site module owns it)", () => {
  // substack hosts now flow through `tools/sites/substack/`; the legacy
  // `substackReformat` post-processor's match() returns false. The
  // cross-host processors below (strip-color-tags, unescape-brackets,
  // strip-empty-anchor-links) still run because they apply to ANY host.
  const md = [
    "# Our synthesized title",
    "",
    "---",
    "",
    "Body text with <text color=\"blue\">blue</text> color tag.",
    "",
    "And a [\\[ref\\]](https://example.com/ref) link.",
    "",
    "[](#empty-anchor)",
    "",
    "Final paragraph.",
  ].join("\n");
  const r = applyPostProcessors(md, "https://newsletter.semianalysis.com/p/x");
  assert.doesNotMatch(r.md, /<text color/);
  assert.doesNotMatch(r.md, /\\\[ref\\\]/, "escaped brackets should be unescaped");
  assert.doesNotMatch(r.md, /\[\]\(#empty-anchor\)/);
  assert.match(r.md, /Body text with blue color tag/);
  // substack-reformat is retired — the site module handles substack URLs
  assert.ok(!r.appliedNames.includes("substack-reformat"),
    "substack-reformat should be retired; site module handles substack hosts now");
  // Cross-host processors still apply
  assert.ok(r.appliedNames.includes("strip-color-tags"));
  assert.ok(r.appliedNames.includes("unescape-brackets-in-links"));
  assert.ok(r.appliedNames.includes("strip-empty-anchor-links"));
});

// ---------------------------------------------------------------------------
// xMetadataStub
// ---------------------------------------------------------------------------

test("xMetadataStub: gated body produces metadata stub", () => {
  const md = "Sign in to X to see this tweet";
  const r = xMetadataStub.transform(md, "https://x.com/foo/status/1");
  assert.match(r.md, /# Tweet \/ X post/);
  assert.match(r.md, /auth-gated/);
  assert.deepEqual(r.extraFlags, ["intentional-stub"]);
});

test("xMetadataStub: visible conversation cleans handle, name, content", () => {
  const md = [
    "# (10) X 上的 Foo Bar：\"Hello world\" / X",
    "",
    "> 原文链接: https://x.com/foobar/status/1",
    "",
    "## 对话",
    "",
    "[",
    "",
    "![](img1.jpg)",
    "",
    "](/foobar)",
    "[",
    "",
    "Foo Bar",
    "![](img2.png)",
    "",
    "](/foobar)",
    "[",
    "",
    "@foobar",
    "",
    "](/foobar)",
    "点击 订阅 到 foobar",
    "Hello world tweet body. " + "x".repeat(800),
    "[下午3:00 · 2026年4月10日](/foobar/status/1)",
    "·",
    "[",
    "",
    "10万",
    "",
    "查看](/foobar/status/1/analytics)",
    "[查看引用](/foobar/status/1/quotes)",
    "## 当前趋势",
    "",
    "trending junk",
  ].join("\n");
  const r = xMetadataStub.transform(md, "https://x.com/foobar/status/1");
  assert.match(r.md, /^# @foobar on X/m);
  // Byline collapsed: name + linked @handle on one line.
  assert.match(r.md, /\*\*Foo Bar\*\* \[@foobar\]\(https:\/\/x\.com\/foobar\)/);
  assert.match(r.md, /Hello world tweet body\./);
  assert.match(r.md, /\[下午3:00 · 2026年4月10日\]\(https:\/\/x\.com\/foobar\/status\/1\)/);
  assert.doesNotMatch(r.md, /img1\.jpg|img2\.png/);
  assert.doesNotMatch(r.md, /点击\s+订阅/);
  assert.doesNotMatch(r.md, /10万/);
  assert.doesNotMatch(r.md, /查看引用/);
  assert.doesNotMatch(r.md, /当前趋势|trending junk/);
  assert.doesNotMatch(r.md, /^·$/m);
});

test("xMetadataStub: link card flattens to image + plain link on separate lines", () => {
  const md = [
    "# t",
    "",
    "[",
    "",
    "![](thumb.jpg)",
    "",
    "GitHub - foo/bar: A repo description",
    "",
    "](https://t.co/abc)",
    "",
    "Body text. " + "z".repeat(800),
  ].join("\n");
  const r = xMetadataStub.transform(md, "https://x.com/foo/status/1");
  // Image standalone, link standalone — no multi-line `[\n![](...)`.
  assert.match(r.md, /!\[\]\(thumb\.jpg\)/);
  assert.match(r.md, /\[GitHub - foo\/bar: A repo description\]\(https:\/\/t\.co\/abc\)/);
  assert.doesNotMatch(r.md, /\[\s*\n\s*!\[/, "no multi-line link wrapping an image");
});

test("xMetadataStub: photo embed unwraps to plain image", () => {
  const md = [
    "# t",
    "",
    "[",
    "",
    "![图像](photo1.jpg)",
    "",
    "](/foo/status/1/photo/1)",
    "",
    "Body text. " + "y".repeat(800),
  ].join("\n");
  const r = xMetadataStub.transform(md, "https://x.com/foo/status/1");
  assert.match(r.md, /!\[\]\(photo1\.jpg\)/);
  assert.doesNotMatch(r.md, /\/photo\/1/);
});
