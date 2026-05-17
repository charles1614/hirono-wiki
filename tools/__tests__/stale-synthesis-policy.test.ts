/**
 * Tests for the tuned stale-synthesis trigger policy (lag-based + accumulation-aware).
 *
 * The policy: flag stale if EITHER
 *   A. newest citing Source.updated > synthesis_updated_at + 7d (lag rule), OR
 *   B. synthesis_updated_at > 30d old AND ≥ 3 Observations (accumulation rule)
 *
 * Avoids both too-often (1d-old citation churns) and too-rarely (slow drift
 * with no fresh cite slipping forever).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkStaleSynthesis, checkCurationNeeded } from "../bin/lint.ts";

interface DocMeta {
  repo_path: string;
  slug: string;
  bucket: string;
  frontmatter: Record<string, unknown>;
  body: string;
  wikilinks: Set<string>;
}

function todayMinusDays(d: number): string {
  return new Date(Date.now() - d * 86400_000).toISOString().slice(0, 10);
}

function makeEntity(slug: string, synthesisDate: string, observations: number, includeStubBody = false): DocMeta {
  const obsBullets = Array.from({ length: observations }, (_, i) => `- Atomic claim ${i + 1} — [[some-source]]`).join("\n");
  return {
    repo_path: `02_Entities/${slug}.md`,
    slug,
    bucket: "02_Entities",
    frontmatter: { synthesis_updated_at: synthesisDate, type: "entity", refs: 3, tier: "active" },
    body: `# ${slug}\n\nKind line.\n\n## Synthesis\n\n${includeStubBody ? "*Regenerated from Observations below.*" : `Substantive synthesis paragraph for ${slug}.`}\n\n## Observations\n\n${obsBullets}\n`,
    wikilinks: new Set(),
  };
}

function makeSource(slug: string, updatedDate: string, wikilinks: string[]): DocMeta {
  return {
    repo_path: `03_Sources/2026/${slug}.md`,
    slug,
    bucket: "03_Sources",
    frontmatter: { updated: updatedDate, type: "source" },
    body: "Source body",
    wikilinks: new Set(wikilinks),
  };
}

// ---------------------------------------------------------------------------
// Rule A: lag-based
// ---------------------------------------------------------------------------

test("Rule A: fires when newest cite is > 7d newer than synthesis_updated_at", () => {
  const entity = makeEntity("Foo", todayMinusDays(20), 2);
  const source = makeSource("recent-source", todayMinusDays(5), ["Foo"]);
  const issues = checkStaleSynthesis([entity, source] as never);
  assert.equal(issues.length, 1);
  assert.match(issues[0].detail, /older than newest citing Source/);
});

test("Rule A: does NOT fire when newest cite is < 7d newer (grace period)", () => {
  const entity = makeEntity("Bar", todayMinusDays(3), 2);
  const source = makeSource("just-landed", todayMinusDays(1), ["Bar"]);
  // Cite is 2d newer, within the 7d grace window — should NOT flag
  const issues = checkStaleSynthesis([entity, source] as never);
  assert.equal(issues.length, 0);
});

test("Rule A: does NOT fire when synthesis is fresher than newest cite", () => {
  const entity = makeEntity("Baz", todayMinusDays(1), 2);
  const source = makeSource("older-source", todayMinusDays(10), ["Baz"]);
  const issues = checkStaleSynthesis([entity, source] as never);
  assert.equal(issues.length, 0);
});

// ---------------------------------------------------------------------------
// Rule B: accumulation-based
// ---------------------------------------------------------------------------

test("Rule B: fires when synthesis > 30d old AND ≥ 3 Observations", () => {
  const entity = makeEntity("Qux", todayMinusDays(45), 3);
  // No citing Sources — Rule A doesn't fire
  const issues = checkStaleSynthesis([entity] as never);
  assert.equal(issues.length, 1);
  assert.match(issues[0].detail, /accumulated/);
});

test("Rule B: does NOT fire when < 30d old, even with many Observations", () => {
  const entity = makeEntity("Quux", todayMinusDays(20), 5);
  const issues = checkStaleSynthesis([entity] as never);
  assert.equal(issues.length, 0);
});

test("Rule B: does NOT fire when ≥ 30d old but < 3 Observations", () => {
  const entity = makeEntity("Corge", todayMinusDays(50), 2);
  const issues = checkStaleSynthesis([entity] as never);
  assert.equal(issues.length, 0);
});

// ---------------------------------------------------------------------------
// Stub-Synthesis entities are not flagged
// ---------------------------------------------------------------------------

test("stub-Synthesis entities are not flagged (other rules catch them)", () => {
  const entity = makeEntity("Stubby", todayMinusDays(60), 5, /* stub */ true);
  const issues = checkStaleSynthesis([entity] as never);
  assert.equal(issues.length, 0);
});

// ---------------------------------------------------------------------------
// _seen/ entities are not flagged (active-tier only)
// ---------------------------------------------------------------------------

test("_seen/ tier entities are not flagged", () => {
  const entity = makeEntity("Seen", todayMinusDays(60), 5);
  entity.repo_path = "02_Entities/_seen/Seen.md";
  const issues = checkStaleSynthesis([entity] as never);
  assert.equal(issues.length, 0);
});

// ---------------------------------------------------------------------------
// curation-needed advisory
// ---------------------------------------------------------------------------

test("curation-needed: silent below threshold", () => {
  const issues = checkCurationNeeded([
    { kind: "stale-synthesis", severity: "warn", path: "02_Entities/A.md", detail: "" },
    { kind: "orphans", severity: "warn", path: "02_Entities/_seen/B.md", detail: "" },
  ] as never);
  assert.equal(issues.length, 0);
});

test("curation-needed: fires when stale + orphans + tier-mismatch ≥ 5", () => {
  const fakeIssues = [
    { kind: "stale-synthesis", severity: "warn", path: "02_Entities/A.md", detail: "" },
    { kind: "stale-synthesis", severity: "warn", path: "02_Entities/B.md", detail: "" },
    { kind: "orphans", severity: "warn", path: "02_Entities/_seen/C.md", detail: "" },
    { kind: "orphans", severity: "warn", path: "02_Entities/_seen/D.md", detail: "" },
    { kind: "tier-mismatch", severity: "error", path: "02_Entities/E.md", detail: "" },
  ];
  const issues = checkCurationNeeded(fakeIssues as never);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, "curation-needed");
  assert.equal(issues[0].severity, "info");
  assert.match(issues[0].hint!, /hirono auto-curate/);
});

test("curation-needed: ignores unrelated lint kinds", () => {
  const fakeIssues = [
    { kind: "dead-wikilinks", severity: "error", path: "x", detail: "" },
    { kind: "frontmatter", severity: "error", path: "y", detail: "" },
    { kind: "tag-vocabulary", severity: "warn", path: "z", detail: "" },
    { kind: "source-image-count", severity: "warn", path: "w", detail: "" },
    { kind: "observation-gaps", severity: "info", path: "v", detail: "" },
  ];
  const issues = checkCurationNeeded(fakeIssues as never);
  assert.equal(issues.length, 0);
});
