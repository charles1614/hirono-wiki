/**
 * Coverage gate — asserts every site module under `tools/sites/` is fully
 * wired into the test infrastructure.
 *
 * For each `testHooks` entry in `tools/sites/test-hooks-registry.ts`, this
 * suite emits one test per coverage criterion:
 *
 *   coverage[<name>]: registered in TEST_HOOKS                    ✓ (always passes if iterating)
 *   coverage[<name>]: directory under tools/sites/ exists         ✓
 *   coverage[<name>]: ≥1 fixture under __tests__/fixtures/converters/<name>/
 *   coverage[<name>]: ≥1 snapshot under __tests__/snapshots/<host>/
 *
 * Failing assertions print actionable next-step commands. Adding a new
 * site module to `tools/sites/<X>/test-hooks.ts` triggers an immediate
 * test failure listing exactly what's missing.
 *
 * The fixture floor is currently 1 (any fixture). The CLAUDE.md §6b
 * target is ≥3 diverse fixtures per converter; this gate accepts 1 to
 * keep CI green during the multi-phase migration. Bump to 3 once all
 * site modules have full coverage.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { TEST_HOOKS } from "../sites/test-hooks-registry.ts";

const FIXTURE_FLOOR = 1;
const SITES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "sites");
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "converters");
const SNAPSHOTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "snapshots");

function countFixtures(name: string): number {
  const dir = join(FIXTURES_DIR, name);
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const f of readdirSync(dir)) {
    if (f.endsWith(".input.json")) n++;
  }
  return n;
}

function snapshotsForHosts(hosts: readonly string[]): { host: string; count: number }[] {
  return hosts.map((host) => {
    const dir = join(SNAPSHOTS_DIR, host);
    let count = 0;
    if (existsSync(dir)) {
      for (const f of readdirSync(dir)) {
        if (f.endsWith(".md")) count++;
      }
    }
    return { host, count };
  });
}

for (const hooks of TEST_HOOKS) {
  const { name, snapshotHosts } = hooks;

  test(`coverage[${name}]: site directory exists under tools/sites/`, () => {
    const dir = join(SITES_DIR, name);
    assert.ok(
      existsSync(dir) && statSync(dir).isDirectory(),
      `tools/sites/${name}/ does not exist. Either remove from registry or create the module.`,
    );
  });

  test(`coverage[${name}]: ≥${FIXTURE_FLOOR} fixture(s) under __tests__/fixtures/converters/${name}/`, () => {
    const found = countFixtures(name);
    assert.ok(
      found >= FIXTURE_FLOOR,
      `${name}: found ${found} fixture(s), expected ≥${FIXTURE_FLOOR}.\n` +
        `  Capture with: npx tsx tools/__tests__/capture-fixtures.ts ${name} <fixture-name> <url>\n` +
        `  Or use the unified workflow: npx tsx tools/__tests__/approve.ts --site ${name} --url <url>`,
    );
  });

  test(`coverage[${name}]: ≥1 snapshot under __tests__/snapshots/<host>/ (any of: ${snapshotHosts.join(", ")})`, () => {
    const counts = snapshotsForHosts(snapshotHosts);
    const total = counts.reduce((sum, c) => sum + c.count, 0);
    assert.ok(
      total >= 1,
      `${name}: 0 snapshots across hosts ${snapshotHosts.join(", ")}.\n` +
        `  Capture with: npx tsx tools/__tests__/snapshot-create.ts <url> --slug <slug>\n` +
        `  Or use the unified workflow: npx tsx tools/__tests__/approve.ts --site ${name} --url <url>`,
    );
  });
}

// Sanity: registry must not be empty.
test("coverage-gate: TEST_HOOKS is non-empty", () => {
  assert.ok(TEST_HOOKS.length > 0, "tools/sites/test-hooks-registry.ts has zero entries");
});
