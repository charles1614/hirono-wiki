/**
 * Unit tests for the pure-function parsers used by ingest-preview and
 * refine-all-stale:
 *   - extractWikilinks(section): pull [[A]] / [[B|alias]] from a section body
 *   - readSection(body, heading): locate `## <heading>` and return its body
 *   - lagDaysFromDetail(detail): parse "is Nd older" / "is Nd old" from lint
 *
 * The orchestration layers (computePreview, refineAllStale main) spawn
 * subprocesses; they're covered by the smoke test in the operator workflow
 * rather than unit tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractWikilinks, readSection } from "../hirono/ingest-preview.ts";
import { lagDaysFromDetail } from "../hirono/refine-all-stale.ts";

test("extractWikilinks: simple comma-separated bare links", () => {
  const links = extractWikilinks("[[TensorRT-LLM]], [[CUTLASS]], [[Blackwell]]");
  assert.deepEqual(links, ["TensorRT-LLM", "CUTLASS", "Blackwell"]);
});

test("extractWikilinks: aliased links keep target, not alias", () => {
  const links = extractWikilinks("[[Foo Entity|the foo]], [[Bar]]");
  assert.deepEqual(links, ["Foo Entity", "Bar"]);
});

test("extractWikilinks: empty / no-link section returns empty array", () => {
  assert.deepEqual(extractWikilinks(""), []);
  assert.deepEqual(extractWikilinks("no wikilinks here"), []);
});

test("extractWikilinks: ignores anchor refs like [[Foo#heading]]", () => {
  // # is excluded in the inner capture group → should still get "Foo"
  const links = extractWikilinks("[[Foo#section]], [[Bar]]");
  assert.deepEqual(links, ["Foo", "Bar"]);
});

test("readSection: returns body between heading and next heading", () => {
  const body = [
    "## A",
    "",
    "alpha",
    "beta",
    "",
    "## B",
    "",
    "gamma",
  ].join("\n");
  const sectA = readSection(body, "A");
  assert.ok(sectA !== null);
  assert.ok(sectA.includes("alpha"));
  assert.ok(sectA.includes("beta"));
  assert.ok(!sectA.includes("gamma"));
});

test("readSection: returns null when heading absent", () => {
  assert.equal(readSection("## A\n\nalpha", "C"), null);
});

test("readSection: last section runs to EOF", () => {
  const body = "## A\n\nalpha\n\n## B\n\nfinal content";
  const sectB = readSection(body, "B");
  assert.ok(sectB !== null);
  assert.ok(sectB.includes("final content"));
});

test("lagDaysFromDetail: Rule A shape — 'is Nd older than newest citing...'", () => {
  const d = "synthesis_updated_at=2026-04-01 is 14d older than newest citing Source updated=2026-04-15 ([[foo]])";
  assert.equal(lagDaysFromDetail(d), 14);
});

test("lagDaysFromDetail: Rule B shape — 'is Nd old with K Observations...'", () => {
  const d = "synthesis_updated_at=2026-03-01 is 75d old with 8 Observations accumulated";
  assert.equal(lagDaysFromDetail(d), 75);
});

test("lagDaysFromDetail: returns 0 for unrecognized shape (defensive)", () => {
  assert.equal(lagDaysFromDetail("no number here"), 0);
});

test("lagDaysFromDetail: captures multi-digit lags", () => {
  const d = "synthesis_updated_at=2026-01-01 is 123d older than newest citing Source updated=2026-05-04";
  assert.equal(lagDaysFromDetail(d), 123);
});
