/**
 * Fixture-based tests for the post-processors that survive in
 * `tools/hirono/shared/post-process.ts`. Each test case pairs a canned
 * "dirty" markdown input with the expected "clean" output. Asserts on
 * SUBSTRINGS rather than exact whole-file matches so the tests tolerate
 * unrelated cosmetic touch-ups (newline collapsing, etc.).
 *
 * Retired processors (substackReformat, intuitionlabsCleanup, sspaiCleanup,
 * lmsysCleanup, blogGoogleCleanup) had their tests removed when the
 * transforms were deleted on 2026-05-04 — their hosts migrated to per-host
 * site modules whose converters own the cleanup logic now (and have their
 * own byte-equal fixture coverage under __tests__/fixtures/converters/).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  enforceSingleH1,
  stripEmptyAnchorLinks,
  stripDecorativeEmojiImages,
  stripTrailingTagList,
  stripShareWidgetLines,
  unescapeBracketsInLinks,
} from "../hirono/shared/post-process.ts";
import { applyPostCleanups } from "../sites/_shared/post-cleanup.ts";
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
// Pipeline composition: applyPostCleanups (the unified-architecture entry)
// ---------------------------------------------------------------------------

test("applyPostCleanups: runs every cross-cutting cleanup unconditionally", () => {
  // Under the unified architecture, host-scoped cleanup lives in each
  // site module's converter; only host-agnostic cleanups run centrally
  // (color-tag strip, bracket unescape, empty-anchor strip, etc.).
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
  const r = applyPostCleanups(md, "https://newsletter.semianalysis.com/p/x");
  assert.doesNotMatch(r.md, /<text color/);
  assert.doesNotMatch(r.md, /\\\[ref\\\]/, "escaped brackets should be unescaped");
  assert.doesNotMatch(r.md, /\[\]\(#empty-anchor\)/);
  assert.match(r.md, /Body text with blue color tag/);
  // Bucket A processors fire without a match check
  assert.ok(r.appliedNames.includes("strip-color-tags"));
  assert.ok(r.appliedNames.includes("unescape-brackets-in-links"));
  assert.ok(r.appliedNames.includes("strip-empty-anchor-links"));
});

