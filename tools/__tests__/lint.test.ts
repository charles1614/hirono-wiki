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

function writeSource(root: string, slug: string, body: string, fm = "type: source\ncreated: 2026-04-20\nupdated: 2026-04-20\nraw_source: https://x"): void {
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
    // Missing raw_source (required for Sources)
    writeFileSync(
      join(root, "Sources/2026/s1.md"),
      `---\ntype: source\ncreated: 2026-04-20\nupdated: 2026-04-20\n---\n\nbody\n`,
    );
    const issues = runLint(root, { checks: ["frontmatter"] });
    assert.ok(issues.some((i) => i.detail.includes("raw_source")));
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
    // also create raw/2026/s1/content.md so raw-orphan passes
    mkdirSync(join(root, "raw/2026/s1"), { recursive: true });
    writeFileSync(join(root, "raw/2026/s1/content.md"), "raw body");
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

test("raw-orphan: raw dir without matching Source → warn", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    mkdirSync(join(root, "raw/2026/ghost-source"), { recursive: true });
    writeFileSync(join(root, "raw/2026/ghost-source/content.md"), "body");
    const issues = runLint(root, { checks: ["raw-orphan"] });
    const warns = issues.filter((i) => i.severity === "warn");
    assert.equal(warns.length, 1);
    assert.match(warns[0].path, /ghost-source/);
  } finally { rmSync(root, { recursive: true }); }
});

test("raw-orphan: Source paired with raw → clean", () => {
  const root = tmp();
  try {
    bucketStubs(root);
    writeSource(root, "2026-04-20-paired", "body");
    mkdirSync(join(root, "raw/2026/2026-04-20-paired"), { recursive: true });
    writeFileSync(join(root, "raw/2026/2026-04-20-paired/content.md"), "raw body");
    const issues = runLint(root, { checks: ["raw-orphan"] });
    assert.equal(issues.length, 0);
  } finally { rmSync(root, { recursive: true }); }
});
