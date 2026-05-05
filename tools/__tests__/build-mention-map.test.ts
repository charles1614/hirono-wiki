import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMentionMap } from "../bin/build-mention-map.ts";
import type { LinkMap } from "../link-map.ts";

function makeMap(docs: Record<string, { doc_id: string; obj_token?: string; url: string }>): LinkMap {
  return {
    space_id: "TEST",
    parents: {},
    docs: Object.fromEntries(
      Object.entries(docs).map(([slug, d]) => [slug, {
        repo_path: `Entities/${slug}.md`,
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

test("buildMentionMap: emits 3 URL variants per doc", () => {
  const map = makeMap({
    Megatron: {
      doc_id: "NODE1",
      obj_token: "OBJ1",
      url: "https://www.feishu.cn/wiki/NODE1",
    },
  });
  const mm = buildMentionMap(map);
  assert.equal(Object.keys(mm).length, 3);
  assert.deepEqual(mm["https://www.feishu.cn/wiki/NODE1"], { obj_token: "OBJ1" });
  assert.deepEqual(mm["https://my.feishu.cn/docx/OBJ1"], { obj_token: "OBJ1" });
  assert.deepEqual(mm["https://www.feishu.cn/docx/OBJ1"], { obj_token: "OBJ1" });
});

test("buildMentionMap: skips docs without obj_token", () => {
  const map = makeMap({
    Backfilled: { doc_id: "N1", obj_token: "O1", url: "https://www.feishu.cn/wiki/N1" },
    Pending:    { doc_id: "N2",                  url: "https://www.feishu.cn/wiki/N2" },  // no obj_token
  });
  const mm = buildMentionMap(map);
  // Only Backfilled registers (3 entries); Pending contributes 0
  assert.equal(Object.keys(mm).length, 3);
  assert.ok(mm["https://www.feishu.cn/wiki/N1"]);
  assert.ok(!mm["https://www.feishu.cn/wiki/N2"]);
});

test("buildMentionMap: each entry has only obj_token (no obj_type or title)", () => {
  // obj_type defaults to 22 (docx) upstream; title falls back to text_run.content.
  // Keeping entries minimal avoids overriding upstream's sensible defaults.
  const map = makeMap({
    A: { doc_id: "N", obj_token: "O", url: "https://www.feishu.cn/wiki/N" },
  });
  const mm = buildMentionMap(map);
  for (const entry of Object.values(mm)) {
    assert.deepEqual(Object.keys(entry).sort(), ["obj_token"]);
  }
});

test("buildMentionMap: multiple docs share no URL collisions", () => {
  const map = makeMap({
    A: { doc_id: "NA", obj_token: "OA", url: "https://www.feishu.cn/wiki/NA" },
    B: { doc_id: "NB", obj_token: "OB", url: "https://www.feishu.cn/wiki/NB" },
  });
  const mm = buildMentionMap(map);
  assert.equal(Object.keys(mm).length, 6);
  assert.equal(mm["https://www.feishu.cn/wiki/NA"].obj_token, "OA");
  assert.equal(mm["https://www.feishu.cn/wiki/NB"].obj_token, "OB");
  assert.equal(mm["https://my.feishu.cn/docx/OA"].obj_token, "OA");
  assert.equal(mm["https://my.feishu.cn/docx/OB"].obj_token, "OB");
});

test("buildMentionMap: empty map → empty result", () => {
  assert.deepEqual(buildMentionMap(makeMap({})), {});
});
