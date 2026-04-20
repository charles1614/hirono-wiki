import { test } from "node:test";
import assert from "node:assert/strict";
import { assembleContent } from "../reconcile_heavy.ts";

// Minimal block fixture builder. block_type values mirror Feishu's:
//   2 = text, 4 = heading2, 12 = bullet, 19 = callout
function block(type: number, key: string, elements: unknown[]): {
  block_id: string; block_type: number; [k: string]: unknown;
} {
  return { block_id: `b-${type}-${Math.random()}`, block_type: type, [key]: { elements } };
}

test("assembleContent: text + heading + bullet", () => {
  const blocks = [
    block(4, "heading2", [{ text_run: { content: "Heading" } }]),
    block(2, "text", [{ text_run: { content: "A paragraph." } }]),
    block(12, "bullet", [{ text_run: { content: "Item 1" } }]),
  ];
  const out = assembleContent(blocks as any);
  assert.equal(
    out,
    "<heading2> Heading\n<text> A paragraph.\n<bullet> Item 1",
  );
});

test("assembleContent: mention_doc.token used (not display title)", () => {
  // The hash should change if the mention target changes, but NOT if only the
  // display text changes (display text is human-editable, target is structural).
  const blocks = [
    block(2, "text", [
      { text_run: { content: "See " } },
      { mention_doc: { title: "AWS", token: "TOKEN_AWS" } },
      { text_run: { content: " for context." } },
    ]),
  ];
  const out = assembleContent(blocks as any);
  assert.ok(out.includes("[[TOKEN_AWS]]"));
  assert.ok(!out.includes("AWS]") || out.includes("[[TOKEN_AWS]]"));
});

test("assembleContent: same target with different display titles → same hash content", () => {
  const a = assembleContent([
    block(2, "text", [{ mention_doc: { title: "AWS", token: "TOK" } }]),
  ] as any);
  const b = assembleContent([
    block(2, "text", [{ mention_doc: { title: "Amazon Web Services", token: "TOK" } }]),
  ] as any);
  assert.equal(a, b, "display text differs but target token is the same");
});

test("assembleContent: different target → different content", () => {
  const a = assembleContent([
    block(2, "text", [{ mention_doc: { title: "AWS", token: "TOK_A" } }]),
  ] as any);
  const b = assembleContent([
    block(2, "text", [{ mention_doc: { title: "AWS", token: "TOK_B" } }]),
  ] as any);
  assert.notEqual(a, b);
});

test("assembleContent: empty / unknown block_types are skipped", () => {
  const blocks = [
    { block_id: "1", block_type: 1, page: { elements: [] } },           // unknown key (page block)
    { block_id: "2", block_type: 999, weird: { elements: [] } },        // unknown type
    block(2, "text", [{ text_run: { content: "Visible." } }]),
  ];
  const out = assembleContent(blocks as any);
  assert.equal(out, "<text> Visible.");
});

test("assembleContent: equation content is captured", () => {
  const blocks = [
    block(16, "equation", [{ equation: { content: "a^2 + b^2 = c^2" } }]),
  ];
  const out = assembleContent(blocks as any);
  assert.ok(out.includes("$a^2 + b^2 = c^2$"));
});

test("assembleContent: whitespace within a block is collapsed", () => {
  const blocks = [
    block(2, "text", [
      { text_run: { content: "Hello   world\n\nwith\textra" } },
    ]),
  ];
  const out = assembleContent(blocks as any);
  // After collapse, internal multi-space sequences become single spaces
  assert.equal(out, "<text> Hello world with extra");
});
