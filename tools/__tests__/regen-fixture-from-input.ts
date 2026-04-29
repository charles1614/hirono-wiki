#!/usr/bin/env tsx
/**
 * Re-run a captured fixture's input.json through the registry, write the
 * fresh output back to expected.md/expected.json. The structural-rule
 * layer (in converter-fixtures.test.ts) validates the new output mechanically.
 *
 * Use ONLY after a deliberate converter patch where:
 *   1. You understand WHY the output bytes are shifting.
 *   2. The structural rules will pass on the new output.
 *
 * For new ground-truth captures or first-time fixtures, use approve.ts —
 * that's the fetch-from-URL workflow with eye-read prompts.
 *
 * Usage:
 *   npx tsx tools/__tests__/regen-fixture-from-input.ts <host> <name>
 *   npx tsx tools/__tests__/regen-fixture-from-input.ts --all
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { findHooksByConverterFn } from "../sites/test-hooks-registry.ts";
import { convertGenericHtml } from "../sites/_shared/generic-converter.ts";
import { validateStructure, formatViolations } from "./structural-rules.ts";

const FIXTURES_ROOT = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "converters");

interface InputDoc {
  fn: string;
  args: unknown[];
}

function runConverter(input: InputDoc): { markdown: string; rest: Record<string, unknown> } {
  const hooks = findHooksByConverterFn(input.fn);
  if (hooks) return hooks.runFromFixture(input);
  if (input.fn === "convertGenericHtml") {
    const [opts] = input.args as [{ html: string; url: string; imagePrefix?: string }];
    const r = convertGenericHtml(opts);
    const { body, ...rest } = r;
    return { markdown: body, rest: rest as Record<string, unknown> };
  }
  throw new Error(`unknown converter fn: ${input.fn}`);
}

function regenOne(host: string, name: string): { changed: boolean; violations: number } {
  const dir = join(FIXTURES_ROOT, host);
  const inputPath = join(dir, `${name}.input.json`);
  const expectedMdPath = join(dir, `${name}.expected.md`);
  const expectedJsonPath = join(dir, `${name}.expected.json`);
  if (!existsSync(inputPath)) {
    console.error(`  ✗ ${host}/${name}: input.json missing`);
    return { changed: false, violations: 0 };
  }
  const input = JSON.parse(readFileSync(inputPath, "utf8")) as InputDoc;
  const { markdown, rest } = runConverter(input);

  const oldMd = existsSync(expectedMdPath) ? readFileSync(expectedMdPath, "utf8") : "";
  const changed = oldMd !== markdown;
  const oldJson = existsSync(expectedJsonPath) ? readFileSync(expectedJsonPath, "utf8") : "";
  const newJson = JSON.stringify(rest, null, 2) + "\n";
  const jsonChanged = oldJson !== newJson;

  // Validate structural rules on the candidate output BEFORE writing.
  const violations = validateStructure(markdown);
  if (violations.length > 0) {
    console.error(`  ✗ ${host}/${name}: structural rules fail on regen output`);
    console.error(formatViolations(violations, `${host}/${name}`));
    return { changed: false, violations: violations.length };
  }

  if (changed || jsonChanged) {
    writeFileSync(expectedMdPath, markdown);
    writeFileSync(expectedJsonPath, newJson);
    const delta = markdown.length - oldMd.length;
    console.log(`  ✓ ${host}/${name}: wrote new expected.md (Δ ${delta >= 0 ? "+" : ""}${delta} bytes${jsonChanged ? ", json updated" : ""})`);
    return { changed: true, violations: 0 };
  }
  console.log(`  - ${host}/${name}: unchanged`);
  return { changed: false, violations: 0 };
}

function main(): void {
  const args = process.argv.slice(2);
  if (args[0] === "--all") {
    const hosts = readdirSync(FIXTURES_ROOT).filter((d) => statSync(join(FIXTURES_ROOT, d)).isDirectory());
    let totalChanged = 0;
    let totalViolations = 0;
    for (const host of hosts) {
      const dir = join(FIXTURES_ROOT, host);
      const names = readdirSync(dir)
        .filter((f) => f.endsWith(".input.json"))
        .map((f) => f.replace(/\.input\.json$/, ""));
      for (const n of names) {
        const r = regenOne(host, n);
        if (r.changed) totalChanged++;
        totalViolations += r.violations;
      }
    }
    console.log(`\n${totalChanged} fixture(s) regenerated, ${totalViolations} structural violation(s)`);
    if (totalViolations > 0) process.exit(1);
    return;
  }

  const [host, name] = args;
  if (!host || !name) {
    console.error("usage: regen-fixture-from-input.ts <host> <name> | --all");
    process.exit(2);
  }
  const r = regenOne(host, name);
  if (r.violations > 0) process.exit(1);
}

main();
