import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractWikilinks, countRefs, countSourceCites, computeReindex } from "../bin/reindex.ts";

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
    { slug: "p1", bucket: "03_Sources" as const, wikilinks: new Set(["A", "B"]), repo_path: "03_Sources/p1.md", frontmatter: {}, body: "" },
    { slug: "p2", bucket: "03_Sources" as const, wikilinks: new Set(["A"]),      repo_path: "03_Sources/p2.md", frontmatter: {}, body: "" },
    { slug: "p3", bucket: "02_Entities" as const, wikilinks: new Set(["A", "C"]), repo_path: "02_Entities/p3.md", frontmatter: {}, body: "" },
  ];
  const refs = countRefs(docs);
  assert.equal(refs.get("A"), 3);
  assert.equal(refs.get("B"), 1);
  assert.equal(refs.get("C"), 1);
});

test("countRefs excludes self-refs", () => {
  const docs = [
    { slug: "A", bucket: "02_Entities" as const, wikilinks: new Set(["A", "B"]), repo_path: "02_Entities/A.md", frontmatter: {}, body: "" },
    { slug: "B", bucket: "03_Sources" as const,  wikilinks: new Set(["A"]),      repo_path: "03_Sources/B.md",  frontmatter: {}, body: "" },
  ];
  const refs = countRefs(docs);
  assert.equal(refs.get("A"), 1, "only B → A counts; A → A excluded");
});

test("countSourceCites: counts Topic↔Source connections in either direction", () => {
  // Topic [[T1]] is mentioned inbound by Source s1, and outbound from T1 to Source s2.
  // Both directions should count → source_count(T1) = 2.
  const docs = [
    { slug: "T1", bucket: "01_Topics" as const,   wikilinks: new Set(["s2"]),   repo_path: "01_Topics/T1.md",   frontmatter: {}, body: "" },
    { slug: "T2", bucket: "01_Topics" as const,   wikilinks: new Set([]),       repo_path: "01_Topics/T2.md",   frontmatter: {}, body: "" },
    { slug: "s1", bucket: "03_Sources" as const,  wikilinks: new Set(["T1"]),   repo_path: "03_Sources/s1.md",  frontmatter: {}, body: "" },
    { slug: "s2", bucket: "03_Sources" as const,  wikilinks: new Set([]),       repo_path: "03_Sources/s2.md",  frontmatter: {}, body: "" },
    { slug: "s3", bucket: "03_Sources" as const,  wikilinks: new Set(["T1"]),   repo_path: "03_Sources/s3.md",  frontmatter: {}, body: "" },
    // Entity citations should NOT count toward Topic source_count
    { slug: "E1", bucket: "02_Entities" as const, wikilinks: new Set(["T1"]),   repo_path: "02_Entities/E1.md", frontmatter: {}, body: "" },
  ];
  const sc = countSourceCites(docs);
  assert.equal(sc.get("T1"), 3, "T1 connects to s1 + s3 (inbound) and s2 (outbound) → 3 sources; E1 excluded");
  assert.equal(sc.get("T2") ?? 0, 0, "T2 has no connections");
});

test("countSourceCites: deduplicates if both directions exist for same Source", () => {
  const docs = [
    { slug: "T", bucket: "01_Topics" as const,  wikilinks: new Set(["s1"]), repo_path: "01_Topics/T.md",  frontmatter: {}, body: "" },
    { slug: "s1", bucket: "03_Sources" as const, wikilinks: new Set(["T"]), repo_path: "03_Sources/s1.md", frontmatter: {}, body: "" },
  ];
  const sc = countSourceCites(docs);
  assert.equal(sc.get("T"), 1, "T↔s1 bidirectional counts as 1, not 2");
});

test("end-to-end reindex: promotion + index regen", () => {
  const root = mkdtempSync(join(tmpdir(), "reindex-"));
  try {
    mkdirSync(join(root, "00_Meta"));
    mkdirSync(join(root, "03_Sources/2026"), { recursive: true });
    mkdirSync(join(root, "02_Entities/_seen"), { recursive: true });
    mkdirSync(join(root, "01_Topics"));

    writeFileSync(join(root, "00_Meta/index.md"), "old overview");
    writeFileSync(join(root, "00_Meta/index-sources.md"), "old");
    writeFileSync(join(root, "00_Meta/index-entities.md"), "old");
    writeFileSync(join(root, "00_Meta/index-topics.md"), "old");

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
    writeFileSync(join(root, "03_Sources/2026/s1.md"), src("s1", ["Hub", "Spoke"]));
    writeFileSync(join(root, "03_Sources/2026/s2.md"), src("s2", ["Hub"]));
    writeFileSync(join(root, "03_Sources/2026/s3.md"), src("s3", ["Hub"]));
    writeFileSync(join(root, "03_Sources/2026/s4.md"), src("s4", ["Spoke"]));

    // Hub initially in _seen/
    writeFileSync(
      join(root, "02_Entities/_seen/Hub.md"),
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
      join(root, "02_Entities/_seen/Spoke.md"),
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
      join(root, "01_Topics/Theme.md"),
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
    assert.ok(existsSync(join(root, "02_Entities/Hub.md")), "Hub promoted to Entities/");
    assert.ok(!existsSync(join(root, "02_Entities/_seen/Hub.md")), "Hub removed from _seen/");
    const hubContent = readFileSync(join(root, "02_Entities/Hub.md"), "utf8");
    assert.match(hubContent, /tier: active/);
    assert.match(hubContent, /refs: 3/);

    // Spoke stayed in _seen (2 refs)
    assert.ok(existsSync(join(root, "02_Entities/_seen/Spoke.md")), "Spoke still in _seen/");
    const spokeContent = readFileSync(join(root, "02_Entities/_seen/Spoke.md"), "utf8");
    assert.match(spokeContent, /refs: 2/);
    assert.match(spokeContent, /tier: seen/);

    // Topic source_count updated
    const themeContent = readFileSync(join(root, "01_Topics/Theme.md"), "utf8");
    // Theme isn't wikilinked from any source in our fixture → source_count stays 0
    assert.match(themeContent, /source_count: 0/);

    // Indexes regenerated
    const ixOverview = readFileSync(join(root, "00_Meta/index.md"), "utf8");
    assert.match(ixOverview, /Sources: 4/);
    assert.match(ixOverview, /Entities \(active\): 1/);
    assert.match(ixOverview, /Entities \(seen\):\s+1/);
    assert.match(ixOverview, /Topics: 1/);

    const ixEntities = readFileSync(join(root, "00_Meta/index-entities.md"), "utf8");
    assert.match(ixEntities, /\[\[Hub\]\].*3 refs/);
    assert.match(ixEntities, /\[\[Spoke\]\].*2 refs/);
  } finally {
    rmSync(root, { recursive: true });
  }
});

test("reindex is idempotent: re-running yields no pending changes", () => {
  const root = mkdtempSync(join(tmpdir(), "reindex-idem-"));
  try {
    mkdirSync(join(root, "00_Meta"));
    mkdirSync(join(root, "03_Sources/2026"), { recursive: true });
    mkdirSync(join(root, "02_Entities"));

    writeFileSync(join(root, "00_Meta/index.md"), "");
    writeFileSync(join(root, "00_Meta/index-sources.md"), "");
    writeFileSync(join(root, "00_Meta/index-entities.md"), "");
    writeFileSync(join(root, "00_Meta/index-topics.md"), "");

    writeFileSync(
      join(root, "03_Sources/2026/s1.md"),
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
      join(root, "02_Entities/E.md"),
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

test("reindex does not mutate YYYY-MM-DD dates into ISO timestamps (regression)", () => {
  // Schema decision D7: dates in frontmatter must stay YYYY-MM-DD across
  // reindex passes. matter.stringify previously rendered YAML-parsed Date
  // objects as full ISO timestamps (2026-05-12T00:00:00.000Z), silently
  // mutating the on-disk format. normalizeDateFields() fixes this.
  const root = mkdtempSync(join(tmpdir(), "reindex-dates-"));
  try {
    mkdirSync(join(root, "00_Meta"));
    mkdirSync(join(root, "03_Sources/2026"), { recursive: true });
    mkdirSync(join(root, "02_Entities/_seen"), { recursive: true });
    mkdirSync(join(root, "01_Topics"));

    writeFileSync(join(root, "00_Meta/index.md"), "");
    writeFileSync(join(root, "00_Meta/index-sources.md"), "");
    writeFileSync(join(root, "00_Meta/index-entities.md"), "");
    writeFileSync(join(root, "00_Meta/index-topics.md"), "");

    // Three Sources to cross the promotion threshold (refs ≥ 3 → active).
    for (let i = 1; i <= 3; i++) {
      writeFileSync(
        join(root, `03_Sources/2026/s${i}.md`),
        `---
type: source
created: 2026-04-19
updated: 2026-04-19
source_url: https://x/${i}
tags: [t]
---

# s${i}

See [[E]] and [[T]].
`,
      );
    }
    writeFileSync(
      join(root, "02_Entities/_seen/E.md"),
      `---
type: entity
created: 2026-04-19
updated: 2026-04-19
refs: 0
tier: seen
---

# E

Body.
`,
    );
    writeFileSync(
      join(root, "01_Topics/T.md"),
      `---
type: topic
created: 2026-04-19
updated: 2026-04-19
source_count: 0
---

# T

Body.
`,
    );

    // First pass — promotes E to active, updates source_count on T,
    // and bumps `updated:` on both. The fix being tested: those `updated:`
    // dates should serialize as YYYY-MM-DD, not ISO timestamps.
    const r = computeReindex(root);
    for (const p of r.pending) writeFileSync(join(root, p.newPath), p.newContent);

    // Every written frontmatter block must use YYYY-MM-DD for created/updated.
    for (const p of r.pending) {
      const text = p.newContent;
      const fm = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
      assert.ok(
        !/^(created|updated):\s*'?\d{4}-\d{2}-\d{2}T/m.test(fm),
        `${p.newPath}: frontmatter has ISO-datetime instead of YYYY-MM-DD:\n${fm}`,
      );
      // And both dates must be present + valid YYYY-MM-DD shape.
      assert.match(fm, /^updated:\s*\d{4}-\d{2}-\d{2}\s*$/m,
        `${p.newPath}: missing or malformed updated date:\n${fm}`);
    }
  } finally {
    rmSync(root, { recursive: true });
  }
});
