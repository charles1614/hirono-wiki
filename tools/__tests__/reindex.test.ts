import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractWikilinks, countRefs, countSourceCites, computeReindex } from "../reindex.ts";

test("extractWikilinks respects code fences", () => {
  const body = `
See [[A]] and [[B|Bee]].

\`\`\`
[[Skip]]
\`\`\`

And [[C]].
`;
  const links = extractWikilinks(body);
  assert.deepEqual([...links].sort(), ["A", "B", "C"]);
});

test("extractWikilinks dedupes", () => {
  const body = `[[X]] [[X]] and again [[X]].`;
  const links = extractWikilinks(body);
  assert.deepEqual([...links], ["X"]);
});

test("countRefs: multiple pages linking to the same slug", () => {
  const docs = [
    { slug: "p1", bucket: "Sources" as const, wikilinks: new Set(["A", "B"]), repo_path: "Sources/p1.md", frontmatter: {}, body: "" },
    { slug: "p2", bucket: "Sources" as const, wikilinks: new Set(["A"]),      repo_path: "Sources/p2.md", frontmatter: {}, body: "" },
    { slug: "p3", bucket: "Entities" as const, wikilinks: new Set(["A", "C"]), repo_path: "Entities/p3.md", frontmatter: {}, body: "" },
  ];
  const refs = countRefs(docs);
  assert.equal(refs.get("A"), 3);
  assert.equal(refs.get("B"), 1);
  assert.equal(refs.get("C"), 1);
});

test("countRefs excludes self-refs", () => {
  const docs = [
    { slug: "A", bucket: "Entities" as const, wikilinks: new Set(["A", "B"]), repo_path: "Entities/A.md", frontmatter: {}, body: "" },
    { slug: "B", bucket: "Sources" as const,  wikilinks: new Set(["A"]),      repo_path: "Sources/B.md",  frontmatter: {}, body: "" },
  ];
  const refs = countRefs(docs);
  assert.equal(refs.get("A"), 1, "only B → A counts; A → A excluded");
});

test("countSourceCites only counts Sources as citing pages", () => {
  const docs = [
    { slug: "p1", bucket: "Sources" as const,  wikilinks: new Set(["A"]), repo_path: "Sources/p1.md",  frontmatter: {}, body: "" },
    { slug: "p2", bucket: "Entities" as const, wikilinks: new Set(["A"]), repo_path: "Entities/p2.md", frontmatter: {}, body: "" },
    { slug: "p3", bucket: "Topics" as const,   wikilinks: new Set(["A"]), repo_path: "Topics/p3.md",   frontmatter: {}, body: "" },
  ];
  const sc = countSourceCites(docs);
  assert.equal(sc.get("A"), 1, "only p1 (Sources) counts; p2 / p3 excluded");
});

test("end-to-end reindex: promotion + index regen", () => {
  const root = mkdtempSync(join(tmpdir(), "reindex-"));
  try {
    mkdirSync(join(root, "Meta"));
    mkdirSync(join(root, "Sources/2026"), { recursive: true });
    mkdirSync(join(root, "Entities/_seen"), { recursive: true });
    mkdirSync(join(root, "Topics"));

    writeFileSync(join(root, "Meta/index.md"), "old overview");
    writeFileSync(join(root, "Meta/index-sources.md"), "old");
    writeFileSync(join(root, "Meta/index-entities.md"), "old");
    writeFileSync(join(root, "Meta/index-topics.md"), "old");

    // 4 sources all reference [[Hub]] → Hub should promote (threshold = 3)
    const src = (slug: string, cites: string[]) => `---
type: source
created: 2026-04-19
updated: 2026-04-19
---

# ${slug}

TL;DR.

Body mentions ${cites.map((c) => `[[${c}]]`).join(" ")}.
`;
    writeFileSync(join(root, "Sources/2026/s1.md"), src("s1", ["Hub", "Spoke"]));
    writeFileSync(join(root, "Sources/2026/s2.md"), src("s2", ["Hub"]));
    writeFileSync(join(root, "Sources/2026/s3.md"), src("s3", ["Hub"]));
    writeFileSync(join(root, "Sources/2026/s4.md"), src("s4", ["Spoke"]));

    // Hub initially in _seen/
    writeFileSync(
      join(root, "Entities/_seen/Hub.md"),
      `---
type: entity
created: 2026-04-19
updated: 2026-04-19
refs: 0
tier: seen
---

# Hub

One-liner.

## Observations

- seed observation — [[s1]]
`,
    );
    writeFileSync(
      join(root, "Entities/_seen/Spoke.md"),
      `---
type: entity
created: 2026-04-19
updated: 2026-04-19
refs: 0
tier: seen
---

# Spoke

Another.

## Observations

- seed — [[s1]]
`,
    );
    writeFileSync(
      join(root, "Topics/Theme.md"),
      `---
type: topic
created: 2026-04-19
updated: 2026-04-19
source_count: 0
---

# Theme

Description paragraph.
`,
    );

    const result = computeReindex(root);
    // Apply via the same function sync.ts uses (direct fs).
    for (const p of result.pending) {
      if (p.oldPath === p.newPath) {
        writeFileSync(join(root, p.oldPath), p.newContent, "utf8");
      } else {
        writeFileSync(join(root, p.oldPath), p.newContent, "utf8");
        renameSync(join(root, p.oldPath), join(root, p.newPath));
      }
    }
    for (const ix of result.indexFiles) {
      writeFileSync(join(root, ix.path), ix.content, "utf8");
    }

    // Hub moved to active tier
    assert.ok(existsSync(join(root, "Entities/Hub.md")), "Hub promoted to Entities/");
    assert.ok(!existsSync(join(root, "Entities/_seen/Hub.md")), "Hub removed from _seen/");
    const hubContent = readFileSync(join(root, "Entities/Hub.md"), "utf8");
    assert.match(hubContent, /tier: active/);
    assert.match(hubContent, /refs: 3/);

    // Spoke stayed in _seen (2 refs)
    assert.ok(existsSync(join(root, "Entities/_seen/Spoke.md")), "Spoke still in _seen/");
    const spokeContent = readFileSync(join(root, "Entities/_seen/Spoke.md"), "utf8");
    assert.match(spokeContent, /refs: 2/);
    assert.match(spokeContent, /tier: seen/);

    // Topic source_count updated
    const themeContent = readFileSync(join(root, "Topics/Theme.md"), "utf8");
    // Theme isn't wikilinked from any source in our fixture → source_count stays 0
    assert.match(themeContent, /source_count: 0/);

    // Indexes regenerated
    const ixOverview = readFileSync(join(root, "Meta/index.md"), "utf8");
    assert.match(ixOverview, /Sources: 4/);
    assert.match(ixOverview, /Entities \(active\): 1/);
    assert.match(ixOverview, /Entities \(seen\):\s+1/);
    assert.match(ixOverview, /Topics: 1/);

    const ixEntities = readFileSync(join(root, "Meta/index-entities.md"), "utf8");
    assert.match(ixEntities, /\[\[Hub\]\].*3 refs/);
    assert.match(ixEntities, /\[\[Spoke\]\].*2 refs/);
  } finally {
    rmSync(root, { recursive: true });
  }
});

test("reindex is idempotent: re-running yields no pending changes", () => {
  const root = mkdtempSync(join(tmpdir(), "reindex-idem-"));
  try {
    mkdirSync(join(root, "Meta"));
    mkdirSync(join(root, "Sources/2026"), { recursive: true });
    mkdirSync(join(root, "Entities"));

    writeFileSync(join(root, "Meta/index.md"), "");
    writeFileSync(join(root, "Meta/index-sources.md"), "");
    writeFileSync(join(root, "Meta/index-entities.md"), "");
    writeFileSync(join(root, "Meta/index-topics.md"), "");

    writeFileSync(
      join(root, "Sources/2026/s1.md"),
      `---
type: source
created: 2026-04-19
updated: 2026-04-19
---

# s1

See [[E]].
`,
    );
    writeFileSync(
      join(root, "Entities/E.md"),
      `---
type: entity
created: 2026-04-19
updated: 2026-04-19
refs: 1
tier: active
---

# E

Body.
`,
    );

    // First pass: should set refs correctly
    let r = computeReindex(root);
    for (const p of r.pending) writeFileSync(join(root, p.newPath), p.newContent);
    for (const ix of r.indexFiles) writeFileSync(join(root, ix.path), ix.content);

    // Second pass: no pending frontmatter changes
    r = computeReindex(root);
    assert.equal(
      r.pending.length,
      0,
      `expected no pending; got: ${r.pending.map((p) => p.reason).join("; ")}`,
    );
  } finally {
    rmSync(root, { recursive: true });
  }
});
