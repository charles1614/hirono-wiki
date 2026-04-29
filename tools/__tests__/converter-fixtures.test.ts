/**
 * Converter-fixture regression suite.
 *
 * GOAL: detect ANY change to a converter's output, byte-equal, without
 * relying on a live network fetch. Each fixture pins the exact input
 * (HTML / text + metadata + URL) and the exact expected markdown output.
 * If the converter changes its behavior, the test fails — dev must
 * either fix the bug or intentionally regenerate the fixture.
 *
 * Layout:
 *   tools/__tests__/fixtures/converters/<host>/<name>.input.json
 *     {
 *       "fn": "convertWeixinHtml" | "convertXhsHtml",
 *       "args": [...]   // serialized arguments to the converter
 *     }
 *   tools/__tests__/fixtures/converters/<host>/<name>.expected.md
 *     The exact markdown the converter MUST return for the input.
 *   tools/__tests__/fixtures/converters/<host>/<name>.expected.json
 *     The non-markdown fields of ConvertResult (imagesToDownload,
 *     stats, svgFiles, metadata) — anything that's NOT the markdown
 *     string itself.
 *
 * To regenerate a fixture (after intentional converter changes):
 *
 *   npx tsx tools/__tests__/capture-fixtures.ts <host> <name> <url>
 *
 * which fetches the URL, runs the converter, and overwrites the three
 * fixture files. Review the diff before committing.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { convertGenericHtml } from "../sites/_shared/generic-converter.ts";
import { findHooksByConverterFn } from "../sites/test-hooks-registry.ts";
import { validateStructure, formatViolations } from "./structural-rules.ts";

// Resolve relative to the TEST FILE so this works regardless of cwd
// (npm test runs from tools/; manual `npx tsx ...` runs from repo root).
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "converters");

interface Fixture {
  host: string;
  name: string;
  inputPath: string;
  expectedMdPath: string;
  expectedJsonPath: string;
}

function listFixtures(): Fixture[] {
  if (!existsSync(FIXTURES_DIR)) return [];
  const out: Fixture[] = [];
  for (const host of readdirSync(FIXTURES_DIR)) {
    const hostDir = join(FIXTURES_DIR, host);
    for (const f of readdirSync(hostDir)) {
      if (!f.endsWith(".input.json")) continue;
      const name = f.replace(/\.input\.json$/, "");
      out.push({
        host,
        name,
        inputPath: join(hostDir, f),
        expectedMdPath: join(hostDir, `${name}.expected.md`),
        expectedJsonPath: join(hostDir, `${name}.expected.json`),
      });
    }
  }
  return out;
}

interface InputDoc {
  fn: string;
  args: unknown[];
}

/**
 * Dispatch a captured fixture's `(fn, args)` to the matching converter
 * via the site-module test-hooks registry. The generic web-fetch
 * converter (`convertGenericHtml`) is NOT in the site registry — it's
 * the legacy fallback for `web-<host>/` fixture directories — and is
 * special-cased below.
 */
function runConverter(input: InputDoc): { markdown: string; rest: Record<string, unknown> } {
  // Site-module path: registry lookup by `input.fn`.
  const hooks = findHooksByConverterFn(input.fn);
  if (hooks) return hooks.runFromFixture(input);

  // Generic web-fetch path: returns `{ body, imagesToDownload, stats }`
  // (no `markdown` key). Map `body` → `markdown` for the byte-equal infra.
  if (input.fn === "convertGenericHtml") {
    const [opts] = input.args as [{ html: string; url: string; imagePrefix?: string }];
    const r = convertGenericHtml(opts);
    const { body, ...rest } = r;
    return { markdown: body, rest: rest as Record<string, unknown> };
  }

  throw new Error(`unknown converter fn: ${input.fn}`);
}

const fixtures = listFixtures();

if (fixtures.length === 0) {
  test("converter-fixtures: scaffolding ready, no fixtures captured yet", () => {
    assert.ok(true);
  });
}

for (const fx of fixtures) {
  test(`converter-fixture[${fx.host}/${fx.name}]: input + expected files present`, () => {
    assert.ok(existsSync(fx.inputPath), `missing input: ${fx.inputPath}`);
    assert.ok(existsSync(fx.expectedMdPath), `missing expected md: ${fx.expectedMdPath}`);
    assert.ok(existsSync(fx.expectedJsonPath), `missing expected json: ${fx.expectedJsonPath}`);
  });

  if (!existsSync(fx.inputPath) || !existsSync(fx.expectedMdPath) || !existsSync(fx.expectedJsonPath)) continue;

  test(`converter-fixture[${fx.host}/${fx.name}]: markdown is byte-equal to expected`, () => {
    const input = JSON.parse(readFileSync(fx.inputPath, "utf8")) as InputDoc;
    const expected = readFileSync(fx.expectedMdPath, "utf8");
    const actual = runConverter(input).markdown;
    if (actual !== expected) {
      // Compute first divergent character offset to make the failure useful.
      let i = 0;
      while (i < Math.min(actual.length, expected.length) && actual[i] === expected[i]) i++;
      const ctx = (s: string, idx: number) => JSON.stringify(s.slice(Math.max(0, idx - 30), idx + 30));
      assert.fail(
        `${fx.host}/${fx.name}: markdown diverged at offset ${i}/${expected.length}\n` +
        `  expected: ${ctx(expected, i)}\n` +
        `  actual:   ${ctx(actual, i)}\n` +
        `Regenerate via: npx tsx tools/__tests__/capture-fixtures.ts ${fx.host} ${fx.name} <url>`
      );
    }
  });

  test(`converter-fixture[${fx.host}/${fx.name}]: non-markdown fields are equal to expected`, () => {
    const input = JSON.parse(readFileSync(fx.inputPath, "utf8")) as InputDoc;
    const expected = JSON.parse(readFileSync(fx.expectedJsonPath, "utf8"));
    const actual = runConverter(input).rest;
    assert.deepStrictEqual(actual, expected, `${fx.host}/${fx.name}: non-markdown fields diverged`);
  });

  test(`converter-fixture[${fx.host}/${fx.name}]: expected.md passes structural rules`, () => {
    const expected = readFileSync(fx.expectedMdPath, "utf8");
    const violations = validateStructure(expected);
    if (violations.length > 0) {
      assert.fail(
        formatViolations(violations, `${fx.host}/${fx.name} ground truth`) +
        `\n\nThe captured ground truth has structural defects. Either:` +
        `\n  1. Fix the converter to produce defect-free output, then refresh:` +
        `\n     npx tsx tools/__tests__/capture-fixtures.ts ${fx.host} ${fx.name} <url>` +
        `\n  2. If the rule fires a false positive, refine the rule in tools/__tests__/structural-rules.ts`,
      );
    }
  });
}
