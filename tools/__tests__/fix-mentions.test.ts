import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildUrlIndex,
  planDocFromBlocks,
  type DocxBlock,
  type Target,
} from "../fix-mentions.ts";
import type { LinkMap } from "../link-map.ts";

// Helper: construct a minimal valid link map.
function makeLinkMap(docs: Record<string, { doc_id: string; obj_token: string; url: string }>): LinkMap {
  return {
    space_id: "TEST",
    parents: {},
    docs: Object.fromEntries(
      Object.entries(docs).map(([slug, d]) => [slug, {
        repo_path: `Test/${slug}.md`,
        bucket: "Entities" as const,
        type: "entity" as const,
        doc_id: d.doc_id,
        obj_token: d.obj_token,
        url: d.url,
        content_sha: "",
        uploaded_at: "2026-04-20T00:00:00Z",
      }]),
    ),
  };
}

// Helper: construct a bullet block with given elements
function bulletBlock(id: string, elements: Record<string, unknown>[]): DocxBlock {
  return {
    block_id: id,
    block_type: 12,
    bullet: { elements },
  } as DocxBlock;
}

// Helper: a text_run with a link
function linkRun(content: string, url: string): Record<string, unknown> {
  return {
    text_run: {
      content,
      text_element_style: {
        link: { url },
      },
    },
  };
}

// Helper: plain text_run (no link)
function plainRun(content: string): Record<string, unknown> {
  return {
    text_run: {
      content,
      text_element_style: {},
    },
  };
}

test("buildUrlIndex registers all three URL shapes per doc", () => {
  const map = makeLinkMap({
    Megatron: {
      doc_id: "NODE123",
      obj_token: "OBJ456",
      url: "https://www.feishu.cn/wiki/NODE123",
    },
  });
  const idx = buildUrlIndex(map);
  // wiki URL from the map
  assert.equal(idx.get("https://www.feishu.cn/wiki/NODE123")?.obj_token, "OBJ456");
  // the two docx URL variants derived from obj_token
  assert.equal(idx.get("https://my.feishu.cn/docx/OBJ456")?.obj_token, "OBJ456");
  assert.equal(idx.get("https://www.feishu.cn/docx/OBJ456")?.obj_token, "OBJ456");
  // unknown URLs aren't registered
  assert.equal(idx.get("https://example.com"), undefined);
});

test("buildUrlIndex skips docs without obj_token", () => {
  const map: LinkMap = {
    space_id: "T",
    parents: {},
    docs: {
      A: {
        repo_path: "Test/A.md", bucket: "Entities", type: "entity",
        doc_id: "NA", url: "https://www.feishu.cn/wiki/NA",
        content_sha: "", uploaded_at: "2026-04-20T00:00:00Z",
        // no obj_token — backfill hasn't happened yet
      },
    },
  };
  const idx = buildUrlIndex(map);
  assert.equal(idx.size, 0);
});

test("planDocFromBlocks: block with no text_run → no plan entry", () => {
  const blocks: DocxBlock[] = [
    { block_id: "b1", block_type: 1, page: { elements: [] } } as DocxBlock,
  ];
  const urlIndex = buildUrlIndex(makeLinkMap({}));
  const plan = planDocFromBlocks(blocks, "docX", "docX", urlIndex);
  assert.equal(plan.updates.length, 0);
});

test("planDocFromBlocks: link pointing to known URL is converted to mention_doc", () => {
  const map = makeLinkMap({
    Megatron: {
      doc_id: "NODE1",
      obj_token: "OBJ_MEG",
      url: "https://www.feishu.cn/wiki/NODE1",
    },
  });
  const idx = buildUrlIndex(map);

  const blocks: DocxBlock[] = [
    bulletBlock("b1", [
      plainRun("See "),
      linkRun("Megatron", "https://www.feishu.cn/wiki/NODE1"),
      plainRun(" for context."),
    ]),
  ];

  const plan = planDocFromBlocks(blocks, "srcDoc", "srcDoc", idx);
  assert.equal(plan.updates.length, 1);
  const upd = plan.updates[0];
  assert.equal(upd.blockId, "b1");
  assert.equal(upd.changedCount, 1);
  assert.equal(upd.newElements.length, 3);
  // middle element is mention_doc
  const mid = upd.newElements[1];
  assert.ok(mid.mention_doc, "middle element converted to mention_doc");
  assert.equal(mid.mention_doc?.token, "OBJ_MEG");
  assert.equal(mid.mention_doc?.obj_type, 22);
  assert.equal(mid.mention_doc?.title, "Megatron");
  assert.equal(mid.mention_doc?.url, "https://www.feishu.cn/wiki/NODE1");
  // surrounding plain runs untouched
  assert.ok(upd.newElements[0].text_run);
  assert.ok(upd.newElements[2].text_run);
});

test("planDocFromBlocks: link to unknown URL → no change", () => {
  const map = makeLinkMap({
    Megatron: { doc_id: "N1", obj_token: "O1", url: "https://www.feishu.cn/wiki/N1" },
  });
  const idx = buildUrlIndex(map);
  const blocks: DocxBlock[] = [
    bulletBlock("b1", [linkRun("Stranger", "https://example.com/foo")]),
  ];
  const plan = planDocFromBlocks(blocks, "d", "d", idx);
  assert.equal(plan.updates.length, 0);
});

test("planDocFromBlocks: multiple blocks, partial matches", () => {
  const map = makeLinkMap({
    A: { doc_id: "NA", obj_token: "OA", url: "https://www.feishu.cn/wiki/NA" },
    B: { doc_id: "NB", obj_token: "OB", url: "https://www.feishu.cn/wiki/NB" },
  });
  const idx = buildUrlIndex(map);
  const blocks: DocxBlock[] = [
    bulletBlock("b1", [linkRun("A", "https://www.feishu.cn/wiki/NA")]),
    bulletBlock("b2", [plainRun("no links here")]),
    bulletBlock("b3", [
      linkRun("A again", "https://www.feishu.cn/wiki/NA"),
      linkRun("B", "https://www.feishu.cn/wiki/NB"),
    ]),
  ];
  const plan = planDocFromBlocks(blocks, "d", "d", idx);
  assert.equal(plan.updates.length, 2);  // b1 and b3; b2 has no link
  const byId = new Map(plan.updates.map((u) => [u.blockId, u]));
  assert.equal(byId.get("b1")?.changedCount, 1);
  assert.equal(byId.get("b3")?.changedCount, 2);
});

test("planDocFromBlocks: preserves display text from text_run", () => {
  const map = makeLinkMap({
    NVIDIA: { doc_id: "NNV", obj_token: "ONV", url: "https://www.feishu.cn/wiki/NNV" },
  });
  const idx = buildUrlIndex(map);
  const blocks: DocxBlock[] = [
    bulletBlock("b1", [linkRun("Nvidia Corporation", "https://www.feishu.cn/wiki/NNV")]),
  ];
  const plan = planDocFromBlocks(blocks, "d", "d", idx);
  const el = plan.updates[0].newElements[0];
  assert.equal(el.mention_doc?.title, "Nvidia Corporation", "display text preserved");
});

test("planDocFromBlocks: headings and callouts also processed", () => {
  const map = makeLinkMap({
    A: { doc_id: "NA", obj_token: "OA", url: "https://www.feishu.cn/wiki/NA" },
  });
  const idx = buildUrlIndex(map);
  const blocks: DocxBlock[] = [
    { block_id: "h1", block_type: 4, heading2: { elements: [linkRun("A", "https://www.feishu.cn/wiki/NA")] } } as DocxBlock,
    { block_id: "cl", block_type: 19, callout: { elements: [linkRun("A", "https://www.feishu.cn/wiki/NA")] } } as DocxBlock,
  ];
  const plan = planDocFromBlocks(blocks, "d", "d", idx);
  assert.equal(plan.updates.length, 2);
});

test("planDocFromBlocks: docx URL form (not wiki URL) also resolves", () => {
  const map = makeLinkMap({
    A: { doc_id: "NA", obj_token: "OA", url: "https://www.feishu.cn/wiki/NA" },
  });
  const idx = buildUrlIndex(map);
  // A block with a link that uses the /docx/OBJ form (e.g. if Feishu normalized)
  const blocks: DocxBlock[] = [
    bulletBlock("b1", [linkRun("A", "https://my.feishu.cn/docx/OA")]),
  ];
  const plan = planDocFromBlocks(blocks, "d", "d", idx);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].newElements[0].mention_doc?.token, "OA");
});
