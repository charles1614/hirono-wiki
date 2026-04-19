import { test } from "node:test";
import assert from "node:assert/strict";
import { preprocess } from "../preprocess.ts";

test("frontmatter → Meta callout", () => {
  const input = `---
created: 2026-04-19
type: source
raw_source: https://example.com
tags: [a, b]
---

Body text.
`;
  const out = preprocess(input);
  assert.ok(out.startsWith("> **Meta**"), "starts with Meta callout header");
  assert.match(out, /> - \*\*Type\*\*: source/);
  assert.match(out, /> - \*\*Created\*\*: 2026-04-19/);
  assert.match(out, /> - \*\*Raw source\*\*: https:\/\/example\.com/);
  assert.match(out, /> - \*\*Tags\*\*: a, b/);
  assert.ok(out.includes("Body text."), "body preserved");
});

test("frontmatter key order follows FRONTMATTER_ORDER", () => {
  const input = `---
tags: [x]
type: source
raw_source: https://example.com
created: 2026-04-19
---
body`;
  const out = preprocess(input);
  const typeIdx = out.indexOf("**Type**");
  const createdIdx = out.indexOf("**Created**");
  const rawSrcIdx = out.indexOf("**Raw source**");
  const tagsIdx = out.indexOf("**Tags**");
  assert.ok(
    typeIdx < createdIdx && createdIdx < rawSrcIdx && rawSrcIdx < tagsIdx,
    `expected ordered callout; got indices type=${typeIdx} created=${createdIdx} raw=${rawSrcIdx} tags=${tagsIdx}`,
  );
});

test("[[Slug]] resolved via linkMap", () => {
  const input = `---
type: source
---

See [[Megatron]] and [[NVIDIA|Nvidia Corp]].
`;
  const linkMap = {
    Megatron: { doc_token: "tokA", url: "https://my.feishu.cn/wiki/A" },
    NVIDIA: { doc_token: "tokB", url: "https://my.feishu.cn/wiki/B" },
  };
  const out = preprocess(input, { linkMap });
  assert.ok(out.includes("[Megatron](https://my.feishu.cn/wiki/A)"));
  assert.ok(out.includes("[Nvidia Corp](https://my.feishu.cn/wiki/B)"));
  assert.ok(!out.includes("[[Megatron]]"));
});

test("[[Slug]] unresolved → placeholder URL", () => {
  const input = `---
type: source
---

See [[Ghost Entity]].
`;
  const out = preprocess(input, { missingLinkMode: "placeholder" });
  assert.match(out, /\[Ghost Entity\]\(wiki-unresolved:Ghost%20Entity\)/);
});

test("[[Slug]] unresolved with mode=plain → text only", () => {
  const input = `---
type: source
---

See [[Ghost]].`;
  const out = preprocess(input, { missingLinkMode: "plain" });
  assert.ok(out.includes("See Ghost."));
  assert.ok(!out.includes("wiki-unresolved"));
});

test("[[Slug]] unresolved with mode=fail throws", () => {
  const input = `---
type: source
---
[[X]]`;
  assert.throws(
    () => preprocess(input, { missingLinkMode: "fail" }),
    /Unresolved wikilink: \[\[X\]\]/,
  );
});

test("wikilinks inside fenced code are left untouched", () => {
  const input = `---
type: source
---

\`\`\`
[[DoNotTouch]]
\`\`\`
`;
  const out = preprocess(input);
  assert.ok(out.includes("[[DoNotTouch]]"), "fence content preserved literally");
});

test("footnotes → superscript + section, numbered by first ref", () => {
  const input = `---
type: source
---

Claim one[^a]. Claim two[^b]. Claim one again[^a].

[^a]: First definition.
[^b]: Second definition.
`;
  const out = preprocess(input);
  assert.ok(out.includes("Claim one⁽¹⁾"));
  assert.ok(out.includes("Claim two⁽²⁾"));
  assert.ok(out.includes("Claim one again⁽¹⁾"));
  assert.match(out, /## Footnotes/);
  assert.match(out, /1\. First definition\./);
  assert.match(out, /2\. Second definition\./);
});

test("no footnotes → no Footnotes section added", () => {
  const input = `---
type: source
---

Plain body, no footnotes.
`;
  const out = preprocess(input);
  assert.ok(!out.includes("## Footnotes"));
});

test("footnote defined but not referenced → still appears in section", () => {
  const input = `---
type: source
---
Body.

[^orphan]: Defined but unused.
`;
  const out = preprocess(input);
  assert.match(out, /## Footnotes/);
  assert.match(out, /1\. Defined but unused\./);
});

test("all three passes compose", () => {
  const input = `---
created: 2026-04-19
type: source
raw_source: https://x.test
---

See [[A]][^1] and [[Unknown]][^2].

[^1]: Def A.
[^2]: Def B.

\`\`\`
[[NotRewritten]]
\`\`\`
`;
  const linkMap = {
    A: { doc_token: "tok1", url: "https://my.feishu.cn/wiki/A" },
  };
  const out = preprocess(input, { linkMap });
  assert.ok(out.startsWith("> **Meta**"));
  assert.ok(out.includes("[A](https://my.feishu.cn/wiki/A)⁽¹⁾"));
  assert.ok(out.includes("[Unknown](wiki-unresolved:Unknown)⁽²⁾"));
  assert.match(out, /## Footnotes/);
  assert.match(out, /1\. Def A\./);
  assert.match(out, /2\. Def B\./);
  assert.ok(out.includes("[[NotRewritten]]"), "fence content preserved literally");
});

test("two-digit footnote numbers get composed superscripts", () => {
  const refs = Array.from({ length: 11 }, (_, i) => `ref[^k${i}].`).join(" ");
  const defs = Array.from({ length: 11 }, (_, i) => `[^k${i}]: def${i}.`).join("\n");
  const input = `---
type: source
---
${refs}

${defs}
`;
  const out = preprocess(input);
  assert.ok(out.includes("⁽¹⁰⁾"), "10 renders as two unicode supers");
  assert.ok(out.includes("⁽¹¹⁾"), "11 renders as two unicode supers");
});

test("empty frontmatter → no Meta callout", () => {
  const input = `Body only, no frontmatter.`;
  const out = preprocess(input);
  assert.ok(!out.startsWith(">"));
  assert.ok(out.includes("Body only"));
});
