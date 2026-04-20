import { test } from "node:test";
import assert from "node:assert/strict";
import { preprocess, splitFrontmatter } from "../preprocess.ts";

test("splitFrontmatter: returns empty frontmatter when file has none", () => {
  const { frontmatter, body } = splitFrontmatter("# Title\n\nBody\n");
  assert.equal(frontmatter, "");
  assert.equal(body, "# Title\n\nBody\n");
});

test("splitFrontmatter: captures YAML block byte-exactly", () => {
  const raw = `---
type: source
created: 2026-04-20
---

# Title

Body.
`;
  const { frontmatter, body } = splitFrontmatter(raw);
  assert.equal(frontmatter, "---\ntype: source\ncreated: 2026-04-20\n---\n");
  assert.equal(body, "\n# Title\n\nBody.\n");
});

test("splitFrontmatter: only recognized when file STARTS with ---", () => {
  const raw = "Some text\n---\ntype: not-frontmatter\n---\nmore.";
  const { frontmatter, body } = splitFrontmatter(raw);
  assert.equal(frontmatter, "");
  assert.equal(body, raw);
});

test("preprocess: preserves frontmatter byte-exactly", () => {
  const raw = `---
type: source
created: 2026-04-20
tags: [a, b]
---

body with [[KnownSlug]]
`;
  const linkMap = { KnownSlug: { doc_token: "t", url: "https://example.com/k" } };
  const out = preprocess(raw, { linkMap });
  // Frontmatter should be byte-identical
  assert.ok(out.startsWith("---\ntype: source\ncreated: 2026-04-20\ntags: [a, b]\n---\n"));
  // Body should have wikilink rewritten
  assert.ok(out.includes("[KnownSlug](https://example.com/k)"));
});

test("preprocess: [[Slug]] resolved via linkMap", () => {
  const input = `See [[Megatron]] and [[NVIDIA|Nvidia Corp]].`;
  const linkMap = {
    Megatron: { doc_token: "tokA", url: "https://my.feishu.cn/wiki/A" },
    NVIDIA: { doc_token: "tokB", url: "https://my.feishu.cn/wiki/B" },
  };
  const out = preprocess(input, { linkMap });
  assert.ok(out.includes("[Megatron](https://my.feishu.cn/wiki/A)"));
  assert.ok(out.includes("[Nvidia Corp](https://my.feishu.cn/wiki/B)"));
  assert.ok(!out.includes("[[Megatron]]"));
});

test("preprocess: [[Slug]] unresolved → placeholder URL (default)", () => {
  const out = preprocess("See [[Ghost Entity]].");
  assert.match(out, /\[Ghost Entity\]\(wiki-unresolved:Ghost%20Entity\)/);
});

test("preprocess: [[Slug]] unresolved with mode=plain → text only", () => {
  const out = preprocess("See [[Ghost]].", { missingLinkMode: "plain" });
  assert.ok(out.includes("See Ghost."));
  assert.ok(!out.includes("wiki-unresolved"));
});

test("preprocess: [[Slug]] unresolved with mode=fail throws", () => {
  assert.throws(
    () => preprocess("[[X]]", { missingLinkMode: "fail" }),
    /Unresolved wikilink: \[\[X\]\]/,
  );
});

test("preprocess: wikilinks inside fenced code are left untouched", () => {
  const input = `Before.

\`\`\`
[[DoNotTouch]]
\`\`\`

After [[Resolve]].`;
  const linkMap = { Resolve: { doc_token: "t", url: "https://example.com/r" } };
  const out = preprocess(input, { linkMap });
  assert.ok(out.includes("[[DoNotTouch]]"), "fence content preserved literally");
  assert.ok(out.includes("[Resolve](https://example.com/r)"), "post-fence wikilink rewritten");
});

test("preprocess: does not touch text inside frontmatter block", () => {
  // Frontmatter YAML shouldn't normally contain wikilinks, but if a tag or
  // description happens to look like one, it should stay as authored — the
  // frontmatter is passed through byte-exactly, not reparsed.
  const raw = `---
type: source
note: "mentions [[Foo]] in text"
---

# Body

Actual link: [[Foo]]
`;
  const linkMap = { Foo: { doc_token: "t", url: "https://example.com/f" } };
  const out = preprocess(raw, { linkMap });
  // The frontmatter copy of [[Foo]] survives verbatim
  assert.ok(out.includes(`note: "mentions [[Foo]] in text"`));
  // The body one gets rewritten
  assert.ok(out.includes("[Foo](https://example.com/f)"));
});

test("preprocess: no frontmatter, just body", () => {
  const out = preprocess("Body with [[X]].", { missingLinkMode: "plain" });
  assert.equal(out, "Body with X.");
});

test("preprocess: strips leading H1 by default", () => {
  const raw = `---
type: source
---

# Trainium3

Body.
`;
  const out = preprocess(raw);
  // frontmatter preserved; leading H1 removed
  assert.ok(out.startsWith("---\ntype: source\n---\n"));
  assert.ok(!out.includes("# Trainium3"), "leading H1 stripped");
  assert.ok(out.includes("Body."));
});

test("preprocess: stripFirstH1: false preserves H1", () => {
  const raw = `# Keep Me\n\nBody.\n`;
  const out = preprocess(raw, { stripFirstH1: false });
  assert.ok(out.includes("# Keep Me"));
});

test("preprocess: only the FIRST H1 gets stripped", () => {
  const raw = `# First\n\nIntro.\n\n# Second\n\nMore.\n`;
  const out = preprocess(raw);
  assert.ok(!out.includes("# First"));
  assert.ok(out.includes("# Second"), "later H1s survive");
});

test("preprocess: H2 / H3 never stripped", () => {
  const out = preprocess(`## Subhead\n\nBody.\n`);
  assert.ok(out.includes("## Subhead"));
});
