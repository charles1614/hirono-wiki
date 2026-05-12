import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLint } from "../bin/lint.ts";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "lint-"));
}

function bucketStubs(root: string): void {
  mkdirSync(join(root, "Meta"));
  mkdirSync(join(root, "Sources/2026"), { recursive: true });
  mkdirSync(join(root, "Entities/_seen"), { recursive: true });
  mkdirSync(join(root, "Topics"));
}

function writeSource(root: string, slug: string, body: string, fm = "type: source\ncreated: 2026-04-20\nupdated: 2026-04-20\nsource_url: https://x\ntags: [inference]"): void {
  writeFileSync(
    join(root, `Sources/2026/${slug}.md`),
    `---\n${fm}\n---\n\n${body}\n`,
  );
}
function writeEntity(root: string, slug: string, body: string, tier: "seen" | "active" = "seen", refs = 0): void {
  const dir = tier === "seen" ? "Entities/_seen" : "Entities";
  writeFileSync(
    join(root, `${dir}/${slug}.md`),
    `---\ntype: entity\ncreated: 2026-04-20\nupdated: 2026-04-20\nrefs: ${refs}\ntier: ${tier}\n---\n\n${body}\n`,
  );
}
function writeTopic(root: string, slug: string, body: string, sc = 0): void {
  writeFileSync(
    join(root, `Topics/${slug}.md`),
    `---\ntype: topic\ncreated: 2026-04-20\nupdated: 2026-04-20\nsource_count: ${sc}\n---\n\n${body}\n`,
  );
}

// ---------------------------------------------------------------------------

test("orphans: entity with no incoming refs is flagged", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    writeSource(root, "s1", "citing [[Foo]]");
    writeEntity(root, "Foo", "body");
    writeEntity(root, "Unloved", "body");
    const issues = runLint(root, { checks: ["orphans"] });
    const slugs = issues.map((i) => i.path);
    assert.ok(slugs.some((p) => p.endsWith("Unloved.md")), "Unloved should be flagged");
    assert.ok(!slugs.some((p) => p.endsWith("Foo.md")), "Foo has 1 incoming ref");
  } finally { rmSync(root, { recursive: true }); }
});

test("orphans: topic with only Meta-page refs is still orphan", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    writeTopic(root, "T1", "body");
    // Meta/index mentions T1 — shouldn't count toward orphan protection
    writeFileSync(
      join(root, "Meta/index.md"),
      `---\ntype: meta\ncreated: 2026-04-20\nupdated: 2026-04-20\n---\n\n[[T1]] is a topic.\n`,
    );
    const issues = runLint(root, { checks: ["orphans"] });
    assert.ok(issues.some((i) => i.path.endsWith("T1.md")), "Meta refs don't save T1 from orphan status");
  } finally { rmSync(root, { recursive: true }); }
});

test("orphans: sources are never flagged (sources are leaves)", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    writeSource(root, "s1", "self-contained source, nothing links here");
    const issues = runLint(root, { checks: ["orphans"] });
    assert.equal(issues.length, 0);
  } finally { rmSync(root, { recursive: true }); }
});

test("dead-wikilinks: unresolved slug flagged, fenced content ignored", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    writeEntity(root, "Real", "body");
    writeSource(root, "s1", "link to [[Real]] and to [[Missing]]\n\n```\n[[AlsoMissing]]\n```");
    const issues = runLint(root, { checks: ["dead-wikilinks"] });
    assert.equal(issues.length, 1);
    assert.match(issues[0].detail, /\[\[Missing\]\]/);
  } finally { rmSync(root, { recursive: true }); }
});

test("dead-wikilinks: path-style refs ([[Meta/X]]) flagged with hint", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    writeSource(root, "s1", "ref [[Meta/schema]] — should warn about path-style");
    const issues = runLint(root, { checks: ["dead-wikilinks"] });
    assert.equal(issues.length, 1);
    assert.match(issues[0].hint ?? "", /path-style/);
  } finally { rmSync(root, { recursive: true }); }
});

test("dead-wikilinks: Meta/ scope-excluded by default; --include-meta reverses", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    writeFileSync(
      join(root, "Meta/schema.md"),
      `---\ntype: meta\ncreated: 2026-04-20\nupdated: 2026-04-20\n---\n\nExample: [[Slug]] is a placeholder.\n`,
    );
    const defaultRun = runLint(root, { checks: ["dead-wikilinks"] });
    assert.equal(defaultRun.length, 0, "Meta excluded by default");
    const withMeta = runLint(root, { checks: ["dead-wikilinks"], includeMeta: true });
    assert.equal(withMeta.length, 1, "Meta dead links flagged when opted in");
  } finally { rmSync(root, { recursive: true }); }
});

test("tier-mismatch: _seen entity with refs>=3 flagged as error", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    writeEntity(root, "Popular", "body");
    writeSource(root, "s1", "link [[Popular]]");
    writeSource(root, "s2", "link [[Popular]]");
    writeSource(root, "s3", "link [[Popular]]");
    const issues = runLint(root, { checks: ["tier-mismatch"] });
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, "error");
    assert.match(issues[0].detail, /3 refs/);
  } finally { rmSync(root, { recursive: true }); }
});

test("tier-mismatch: active entity with refs<3 flagged as warn", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    writeEntity(root, "Manually", "body", "active", 1);
    writeSource(root, "s1", "link [[Manually]]");
    const issues = runLint(root, { checks: ["tier-mismatch"] });
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, "warn");
  } finally { rmSync(root, { recursive: true }); }
});

test("frontmatter: missing required field flagged", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    // Missing source_url (required for Sources)
    writeFileSync(
      join(root, "Sources/2026/s1.md"),
      `---\ntype: source\ncreated: 2026-04-20\nupdated: 2026-04-20\n---\n\nbody\n`,
    );
    const issues = runLint(root, { checks: ["frontmatter"] });
    assert.ok(issues.some((i) => i.detail.includes("source_url")));
  } finally { rmSync(root, { recursive: true }); }
});

test("frontmatter: Sources without tags is flagged (pre-scale lockdown)", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    // Sources require `tags` as a non-empty list as of the pre-scale
    // schema lockdown. Missing `tags` key:
    writeFileSync(
      join(root, "Sources/2026/s1.md"),
      `---\ntype: source\ncreated: 2026-04-20\nupdated: 2026-04-20\nsource_url: https://x\n---\n\nbody\n`,
    );
    const issues1 = runLint(root, { checks: ["frontmatter"] });
    assert.ok(issues1.some((i) => i.detail.includes("tags")), `missing tags should flag; got ${JSON.stringify(issues1)}`);
    // Empty list also rejected — the spirit of the check is "≥1 tag":
    writeFileSync(
      join(root, "Sources/2026/s1.md"),
      `---\ntype: source\ncreated: 2026-04-20\nupdated: 2026-04-20\nsource_url: https://x\ntags: []\n---\n\nbody\n`,
    );
    const issues2 = runLint(root, { checks: ["frontmatter"] });
    assert.ok(issues2.some((i) => i.detail.includes("tags") && i.detail.includes("non-empty")), `empty tags should flag; got ${JSON.stringify(issues2)}`);
  } finally { rmSync(root, { recursive: true }); }
});

test("frontmatter: type that doesn't match bucket is flagged", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    writeFileSync(
      join(root, "Entities/Foo.md"),
      `---\ntype: source\ncreated: 2026-04-20\nupdated: 2026-04-20\nrefs: 0\ntier: active\n---\n\nbody\n`,
    );
    const issues = runLint(root, { checks: ["frontmatter"] });
    assert.ok(issues.some((i) => i.detail.includes("type=")));
  } finally { rmSync(root, { recursive: true }); }
});

test("all checks: a clean fixture produces 0 issues", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    writeSource(root, "s1", "citing [[Real]]");
    writeEntity(root, "Real", "body");
    // also create raw/raindrop/<host>/s1/content.md so raw-orphan passes
    mkdirSync(join(root, "raw/raindrop/example.com/s1"), { recursive: true });
    writeFileSync(join(root, "raw/raindrop/example.com/s1/content.md"), "raw body");
    const issues = runLint(root);
    assert.equal(issues.length, 0, `expected clean; got ${JSON.stringify(issues)}`);
  } finally { rmSync(root, { recursive: true }); }
});

// ---------------------------------------------------------------------------
// raw-orphan
// ---------------------------------------------------------------------------

test("raw-orphan: Source without raw/.../content.md → error", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    writeSource(root, "2026-04-20-alpha", "body");
    // no raw/ created
    const issues = runLint(root, { checks: ["raw-orphan"] });
    const missing = issues.filter((i) => i.severity === "error");
    assert.equal(missing.length, 1);
    assert.match(missing[0].detail, /no raw archive/);
  } finally { rmSync(root, { recursive: true }); }
});

test("raw-orphan: clean raw dir without matching Source → info (not warn)", () => {
  // Demoted from `warn` → `info`: a clean-but-not-yet-ingested slug is
  // the intended state of the WIP queue, not an error.
  const root = tmp();
  try {
    bucketStubs(root);
    mkdirSync(join(root, "raw/raindrop/example.com/ghost-source"), { recursive: true });
    writeFileSync(join(root, "raw/raindrop/example.com/ghost-source/content.md"), "body");
    const issues = runLint(root, { checks: ["raw-orphan"] });
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, "info");
    assert.match(issues[0].path, /ghost-source/);
  } finally { rmSync(root, { recursive: true }); }
});

test("raw-orphan: flagged raw dir filtered out of reverse-orphan list", () => {
  // Flagged slugs (auth-walled / SPA / paywalled / etc.) are
  // deliberately NOT yet ingested. Lint must not surface them as
  // reverse-orphans — that's noise. _index.json provides quality_status.
  const root = tmp();
  try {
    bucketStubs(root);
    mkdirSync(join(root, "raw/raindrop/example.com/flagged-slug"), { recursive: true });
    writeFileSync(join(root, "raw/raindrop/example.com/flagged-slug/content.md"), "stub");
    mkdirSync(join(root, "raw/raindrop/example.com/good-slug"), { recursive: true });
    writeFileSync(join(root, "raw/raindrop/example.com/good-slug/content.md"), "body");
    writeFileSync(join(root, "raw/raindrop/_index.json"), JSON.stringify({
      version: 1, updated_at: "2026-05-09T00:00:00Z",
      slugs: {
        "flagged-slug": { slug: "flagged-slug", quality_status: "flagged" },
        "good-slug":    { slug: "good-slug", quality_status: "good" },
      },
    }));
    const issues = runLint(root, { checks: ["raw-orphan"] });
    assert.equal(issues.length, 1, "only the good-slug surfaces");
    assert.match(issues[0].path, /good-slug/);
    assert.equal(issues[0].severity, "info");
  } finally { rmSync(root, { recursive: true }); }
});

test("raw-orphan: Source paired with raw → clean", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    writeSource(root, "2026-04-20-paired", "body");
    mkdirSync(join(root, "raw/raindrop/example.com/2026-04-20-paired"), { recursive: true });
    writeFileSync(join(root, "raw/raindrop/example.com/2026-04-20-paired/content.md"), "raw body");
    const issues = runLint(root, { checks: ["raw-orphan"] });
    assert.equal(issues.length, 0);
  } finally { rmSync(root, { recursive: true }); }
});

// ---------------------------------------------------------------------------
// source-image-refs (pre-scale image-correctness gate)
// ---------------------------------------------------------------------------

// Minimal PNG bytes: 8-byte signature + IHDR chunk (13 bytes). Header is
// what `looksLikeImage` checks; padding to 512+ B satisfies MIN_IMAGE_BYTES.
const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,  // PNG sig
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,  // IHDR chunk length + name
]);
function validPngBytes(): Buffer {
  return Buffer.concat([PNG_HEADER, Buffer.alloc(600, 0)]);  // ≥ 512 B
}

test("source-image-refs: valid image ref → clean", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    const slug = "2026-04-20-image-ok";
    writeSource(root, slug,
      `body with image ref:\n\n![Bar chart of foo](../../raw/raindrop/example.com/${slug}/figure-001.png)`);
    mkdirSync(join(root, `raw/raindrop/example.com/${slug}`), { recursive: true });
    writeFileSync(join(root, `raw/raindrop/example.com/${slug}/content.md`), "raw body");
    writeFileSync(join(root, `raw/raindrop/example.com/${slug}/figure-001.png`), validPngBytes());
    const issues = runLint(root, { checks: ["source-image-refs"] });
    assert.equal(issues.length, 0, `expected clean; got ${JSON.stringify(issues)}`);
  } finally { rmSync(root, { recursive: true }); }
});

test("source-image-refs: dangling ref → error", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    const slug = "2026-04-20-image-dangling";
    writeSource(root, slug,
      `![dangling](../../raw/raindrop/example.com/${slug}/nope.png)`);
    mkdirSync(join(root, `raw/raindrop/example.com/${slug}`), { recursive: true });
    writeFileSync(join(root, `raw/raindrop/example.com/${slug}/content.md`), "raw body");
    const issues = runLint(root, { checks: ["source-image-refs"] });
    assert.ok(issues.some((i) => i.detail.includes("missing file")),
      `expected dangling error; got ${JSON.stringify(issues)}`);
  } finally { rmSync(root, { recursive: true }); }
});

test("source-image-refs: truncated stub (< MIN_IMAGE_BYTES) → error", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    const slug = "2026-04-20-image-truncated";
    writeSource(root, slug,
      `![truncated](../../raw/raindrop/example.com/${slug}/figure-001.png)`);
    mkdirSync(join(root, `raw/raindrop/example.com/${slug}`), { recursive: true });
    writeFileSync(join(root, `raw/raindrop/example.com/${slug}/content.md`), "raw body");
    // 100 bytes — valid PNG header but well below MIN_IMAGE_BYTES (512).
    writeFileSync(join(root, `raw/raindrop/example.com/${slug}/figure-001.png`),
      Buffer.concat([PNG_HEADER, Buffer.alloc(84, 0)]));
    const issues = runLint(root, { checks: ["source-image-refs"] });
    assert.ok(issues.some((i) => i.detail.includes("truncated") || i.detail.includes("MIN_IMAGE_BYTES")),
      `expected truncated error; got ${JSON.stringify(issues)}`);
  } finally { rmSync(root, { recursive: true }); }
});

test("source-image-refs: wrong-format bytes (text-as-png) → error", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    const slug = "2026-04-20-image-wrong-format";
    writeSource(root, slug,
      `![text masquerading as png](../../raw/raindrop/example.com/${slug}/figure-001.png)`);
    mkdirSync(join(root, `raw/raindrop/example.com/${slug}`), { recursive: true });
    writeFileSync(join(root, `raw/raindrop/example.com/${slug}/content.md`), "raw body");
    // 600 bytes of "<html>error</html>..." — passes the size check but
    // fails the magic-byte check. Caught by looksLikeImage.
    const html = "<html><body>Not Found</body></html>".repeat(20);
    writeFileSync(join(root, `raw/raindrop/example.com/${slug}/figure-001.png`), html);
    const issues = runLint(root, { checks: ["source-image-refs"] });
    assert.ok(issues.some((i) => i.detail.includes("doesn't match any known image format")),
      `expected wrong-format error; got ${JSON.stringify(issues)}`);
  } finally { rmSync(root, { recursive: true }); }
});

test("source-image-refs: refs inside fenced code blocks are ignored", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    const slug = "2026-04-20-image-fenced";
    writeSource(root, slug,
      "code example:\n\n```\n![not a real ref](../../raw/raindrop/example.com/x/nope.png)\n```");
    mkdirSync(join(root, `raw/raindrop/example.com/${slug}`), { recursive: true });
    writeFileSync(join(root, `raw/raindrop/example.com/${slug}/content.md`), "raw body");
    const issues = runLint(root, { checks: ["source-image-refs"] });
    assert.equal(issues.length, 0, `fenced refs should be ignored; got ${JSON.stringify(issues)}`);
  } finally { rmSync(root, { recursive: true }); }
});

test("source-image-refs: remote http(s) refs are skipped (other rule covers them)", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    const slug = "2026-04-20-image-remote";
    writeSource(root, slug,
      `![remote](https://example.com/img.png)`);
    mkdirSync(join(root, `raw/raindrop/example.com/${slug}`), { recursive: true });
    writeFileSync(join(root, `raw/raindrop/example.com/${slug}/content.md`), "raw body");
    const issues = runLint(root, { checks: ["source-image-refs"] });
    assert.equal(issues.length, 0, `remote refs out of scope; got ${JSON.stringify(issues)}`);
  } finally { rmSync(root, { recursive: true }); }
});

// ---------------------------------------------------------------------------
// observation-gaps (LLM-editorial-debt surfacer)
// ---------------------------------------------------------------------------

test("observation-gaps: active-tier entity missing Observations from citing Source → WARN", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    // A Source that wikilinks to [[Foo]].
    writeSource(root, "2026-04-20-a", "Citing [[Foo]] inline.");
    mkdirSync(join(root, "raw/raindrop/example.com/2026-04-20-a"), { recursive: true });
    writeFileSync(join(root, "raw/raindrop/example.com/2026-04-20-a/content.md"), "raw");
    // Active-tier entity with EMPTY Observations.
    writeEntity(root, "Foo", "Body.\n\n## Observations\n\n- (auto-populated as Sources cite this entity)\n", "active", 1);
    const issues = runLint(root, { checks: ["observation-gaps"] });
    assert.ok(
      issues.some((i) => i.kind === "observation-gaps" && i.severity === "warn" && i.path === "Entities/Foo.md"),
      `expected observation-gaps WARN on Foo; got ${JSON.stringify(issues)}`,
    );
  } finally { rmSync(root, { recursive: true }); }
});

test("observation-gaps: seen-tier entity is NOT warned (scaffolding tier)", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    writeSource(root, "2026-04-20-a", "Citing [[Foo]].");
    mkdirSync(join(root, "raw/raindrop/example.com/2026-04-20-a"), { recursive: true });
    writeFileSync(join(root, "raw/raindrop/example.com/2026-04-20-a/content.md"), "raw");
    // Seen-tier entity with no Observations — accepted as scaffolding.
    writeEntity(root, "Foo", "Body.\n", "seen", 1);
    const issues = runLint(root, { checks: ["observation-gaps"] });
    assert.equal(
      issues.length, 0,
      `seen-tier entities are scaffolding; should not warn. Got ${JSON.stringify(issues)}`,
    );
  } finally { rmSync(root, { recursive: true }); }
});

test("observation-gaps: active-tier entity with all citing Sources cited → clean", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    writeSource(root, "2026-04-20-a", "Citing [[Foo]].");
    mkdirSync(join(root, "raw/raindrop/example.com/2026-04-20-a"), { recursive: true });
    writeFileSync(join(root, "raw/raindrop/example.com/2026-04-20-a/content.md"), "raw");
    // Active-tier entity with Observation citing the Source — should pass.
    writeEntity(
      root, "Foo",
      "Body.\n\n## Observations\n\n- Foo is referenced by — [[2026-04-20-a]]\n",
      "active", 1,
    );
    const issues = runLint(root, { checks: ["observation-gaps"] });
    assert.equal(issues.length, 0, `expected clean; got ${JSON.stringify(issues)}`);
  } finally { rmSync(root, { recursive: true }); }
});

// ---------------------------------------------------------------------------
// tag-vocabulary (controlled vocabulary for Sources tags)
// ---------------------------------------------------------------------------

test("tag-vocabulary: novel tag in Source → WARN with all novel tags listed", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    // "inference" + "moe" are canonical; "nvidia" + "blackwell" + "made-up" are not.
    writeSource(
      root, "2026-04-20-tagged",
      "body",
      "type: source\ncreated: 2026-04-20\nupdated: 2026-04-20\nsource_url: https://x\ntags: [inference, moe, nvidia, blackwell, made-up]",
    );
    mkdirSync(join(root, "raw/raindrop/example.com/2026-04-20-tagged"), { recursive: true });
    writeFileSync(join(root, "raw/raindrop/example.com/2026-04-20-tagged/content.md"), "raw");
    const issues = runLint(root, { checks: ["tag-vocabulary"] });
    const tagWarn = issues.find((i) => i.kind === "tag-vocabulary" && i.severity === "warn");
    assert.ok(tagWarn, `expected tag-vocabulary WARN; got ${JSON.stringify(issues)}`);
    assert.ok(tagWarn!.detail.includes("nvidia"), `expected 'nvidia' in detail; got ${tagWarn!.detail}`);
    assert.ok(tagWarn!.detail.includes("blackwell"), `expected 'blackwell' in detail; got ${tagWarn!.detail}`);
    assert.ok(tagWarn!.detail.includes("made-up"), `expected 'made-up' in detail; got ${tagWarn!.detail}`);
    // Canonical tags should NOT be listed.
    assert.ok(!tagWarn!.detail.includes('"inference"'), `'inference' is canonical — should not warn`);
  } finally { rmSync(root, { recursive: true }); }
});

// ---------------------------------------------------------------------------
// topic-content-gaps (Topic-side editorial-debt surfacer)
// ---------------------------------------------------------------------------

test("topic-content-gaps: load-bearing Topic with stub What+Current understanding → WARN", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    writeTopic(
      root, "Foo",
      "## What\n\n*Stub topic — to be expanded from sources.*\n\n## Current understanding\n\n*Synthesis pending. See Sources drawn on below.*\n",
      3,
    );
    const issues = runLint(root, { checks: ["topic-content-gaps"] });
    assert.ok(
      issues.some((i) => i.kind === "topic-content-gaps" && i.path === "Topics/Foo.md"),
      `expected topic-content-gaps WARN; got ${JSON.stringify(issues)}`,
    );
  } finally { rmSync(root, { recursive: true }); }
});

test("topic-content-gaps: source_count < 3 → silent (low-traffic Topic acceptable as scaffolding)", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    writeTopic(
      root, "Foo",
      "## What\n\n*Stub topic — to be expanded from sources.*\n\n## Current understanding\n\n*Synthesis pending.*\n",
      1,  // below threshold
    );
    const issues = runLint(root, { checks: ["topic-content-gaps"] });
    assert.equal(issues.length, 0, `expected silent for low-traffic; got ${JSON.stringify(issues)}`);
  } finally { rmSync(root, { recursive: true }); }
});

test("topic-content-gaps: load-bearing Topic with substantive What+Current understanding → clean", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    writeTopic(
      root, "Foo",
      "## What\n\nGenuine definition spanning a real paragraph of substance about the topic Foo and its scope.\n\n## Current understanding\n\nSynthesis paragraph that draws on multiple sources and articulates the current state of knowledge.\n",
      5,
    );
    const issues = runLint(root, { checks: ["topic-content-gaps"] });
    assert.equal(issues.length, 0, `expected clean; got ${JSON.stringify(issues)}`);
  } finally { rmSync(root, { recursive: true }); }
});

test("tag-vocabulary: all-canonical Source → clean", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    writeSource(
      root, "2026-04-20-clean",
      "body",
      "type: source\ncreated: 2026-04-20\nupdated: 2026-04-20\nsource_url: https://x\ntags: [inference, moe, parallelism, paper]",
    );
    mkdirSync(join(root, "raw/raindrop/example.com/2026-04-20-clean"), { recursive: true });
    writeFileSync(join(root, "raw/raindrop/example.com/2026-04-20-clean/content.md"), "raw");
    const issues = runLint(root, { checks: ["tag-vocabulary"] });
    assert.equal(issues.length, 0, `expected clean; got ${JSON.stringify(issues)}`);
  } finally { rmSync(root, { recursive: true }); }
});
