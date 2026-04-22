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
 *   - deepwikiWrapDiagramNodes (1 case)
 *   - stripEmptyAnchorLinks (2 cases)
 *   - unescapeBracketsInLinks (2 cases)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  substackReformat,
  xhsReformatNoteTable,
  arxivStripTrailingChrome,
  arxivStructureImprove,
  deepwikiWrapDiagramNodes,
  stripEmptyAnchorLinks,
  unescapeBracketsInLinks,
  applyPostProcessors,
} from "../hirono/shared/post-process.ts";

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
  assert.ok(r.notes.some((n) => /stripped.*header/i.test(n)));
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
  assert.match(r.md, /\*\*来源 \/ Source:\*\* https:\/\/www\.xiaohongshu\.com/);
  assert.match(r.md, /\*\*作者 \/ Author:\*\* someone/);
  assert.match(r.md, /123 likes.*67 collects.*45 comments/);
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

test("arxivStripTrailingChrome: only runs for arxiv.org", () => {
  assert.equal(arxivStripTrailingChrome.match("https://notarxiv.com/x", "notarxiv.com"), false);
  assert.equal(arxivStripTrailingChrome.match("https://arxiv.org/abs/x", "arxiv.org"), true);
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

// ---------------------------------------------------------------------------
// deepwikiWrapDiagramNodes
// ---------------------------------------------------------------------------

test("deepwikiWrapDiagramNodes: wraps 6+ diagram-node run in ```text block", () => {
  const md = [
    "# Overview",
    "",
    "Some prose paragraph.",
    "",
    "User",
    "Client",
    "API",
    "Server",
    "Database",
    "Cache",
    "Queue",
    "",
    "More prose after.",
  ].join("\n");
  const r = deepwikiWrapDiagramNodes.transform(md, "https://wiki.litenext.digital/foo");
  assert.match(r.md, /```text[\s\S]*Diagram \(mermaid nodes[\s\S]*User[\s\S]*```/);
  assert.match(r.md, /Some prose paragraph/);
  assert.match(r.md, /More prose after/);
  assert.ok(r.notes.some((n) => /wrapped.*diagram-node/i.test(n)));
});

test("deepwikiWrapDiagramNodes: does NOT wrap <6 short lines", () => {
  const md = "# Title\n\nFoo\nBar\nBaz\n\nMore prose.";
  const r = deepwikiWrapDiagramNodes.transform(md, "https://wiki.litenext.digital/x");
  assert.doesNotMatch(r.md, /```text/);
  assert.equal(r.notes.length, 0);
});

test("deepwikiWrapDiagramNodes: does not re-wrap existing code-fenced block", () => {
  const md = [
    "# X",
    "",
    "```mermaid",
    "flowchart TD",
    "  A[One] --> B[Two]",
    "  B --> C[Three]",
    "  C --> D[Four]",
    "  D --> E[Five]",
    "  E --> F[Six]",
    "  F --> G[Seven]",
    "```",
  ].join("\n");
  const r = deepwikiWrapDiagramNodes.transform(md, "https://wiki.litenext.digital/y");
  // Our wrapper uses ```text, not ```mermaid. Count ```text occurrences.
  const textFences = (r.md.match(/```text/g) || []).length;
  assert.equal(textFences, 0, "existing mermaid fence should not trigger a nested ```text wrap");
});

test("deepwikiWrapDiagramNodes: only runs for wiki.litenext.digital", () => {
  assert.equal(deepwikiWrapDiagramNodes.match("https://github.com/x", "github.com"), false);
});

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

test("applyPostProcessors: pipeline runs all processors on substack-like input", () => {
  const md = [
    "# Our synthesized title",
    "",
    "---",
    "",
    "# Actual article H1",
    "",
    "[Author](https://substack.com/@x)",
    "",
    "Jun 1, 2025",
    "",
    "1",
    "",
    "2",
    "",
    "Share",
    "",
    "The body has <text color=\"blue\">blue</text> text.",
    "",
    "And a [\\[ref\\]](https://example.com/ref) link.",
    "",
    "[](#empty-anchor)",
    "",
    "Final paragraph.",
  ].join("\n");
  const r = applyPostProcessors(md, "https://newsletter.semianalysis.com/p/x");
  assert.doesNotMatch(r.md, /Jun 1, 2025/);
  assert.doesNotMatch(r.md, /<text color/);
  assert.doesNotMatch(r.md, /\\\[ref\\\]/, "escaped brackets should be unescaped");
  assert.doesNotMatch(r.md, /\[\]\(#empty-anchor\)/);
  assert.match(r.md, /The body has blue text/);
  assert.ok(r.appliedNames.includes("substack-reformat"));
  assert.ok(r.appliedNames.includes("strip-color-tags"));
  assert.ok(r.appliedNames.includes("unescape-brackets-in-links"));
  assert.ok(r.appliedNames.includes("strip-empty-anchor-links"));
});
