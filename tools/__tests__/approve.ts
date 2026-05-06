#!/usr/bin/env tsx
/**
 * Unified approve workflow — fetch a URL, run the converter, eye-read,
 * validate structural rules, prompt for approval, and write all
 * ground-truth artifacts (fixture + snapshot) atomically.
 *
 * Replaces the multi-step ritual of running `capture-fixtures.ts` and
 * `snapshot-create.ts` separately. The structural-rule check (via
 * `structural-rules.ts`) refuses to write if the captured output has
 * known defect shapes — preventing the "rubber-stamp" failure mode
 * where buggy ground truth gets locked in.
 *
 * Usage:
 *   npx tsx tools/__tests__/approve.ts --site <site> --name <fixture-name> --url <url> [options]
 *
 * Options:
 *   --slug <slug>      Also write a snapshot under __tests__/snapshots/<host>/<slug>.md.
 *                      Defaults to <site>-<name>. Pass empty to skip snapshot.
 *   --no-snapshot      Skip snapshot path (fixture only).
 *   --no-fixture       Skip fixture path (snapshot only).
 *   --yes              Skip the y/n prompt (CI / scripted).
 *   --diff-only        Print diff vs existing ground truth, exit without writing.
 *
 * Sites: weixin, xhs, github, zhihu, deepwiki-com, deepwiki-litenext,
 * linux-do, epoch-ai, nvidianews, sebastianraschka-gallery, substack.
 */

import { execSync } from "node:child_process";
import {
  readFileSync, writeFileSync, mkdirSync, existsSync, rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { findHooksByName } from "../sites/test-hooks-registry.ts";
import { validateStructure, formatViolations } from "./structural-rules.ts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURES_ROOT = join(REPO_ROOT, "tools", "__tests__", "fixtures", "converters");
const SNAPSHOTS_ROOT = join(REPO_ROOT, "tools", "__tests__", "snapshots");

interface Args {
  site: string;
  name: string;
  url: string;
  slug: string | null;
  noSnapshot: boolean;
  noFixture: boolean;
  yes: boolean;
  diffOnly: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag);
    if (i < 0 || i === argv.length - 1) return null;
    return argv[i + 1];
  };
  const has = (flag: string): boolean => argv.includes(flag);

  const site = get("--site");
  const name = get("--name");
  const url = get("--url");
  if (!site || !name || !url) {
    console.error(
      "usage: approve.ts --site <site> --name <fixture-name> --url <url> [options]\n" +
      "  see top of file for option descriptions",
    );
    process.exit(2);
  }
  return {
    site,
    name,
    url,
    slug: get("--slug") ?? `${site}-${name}`,
    noSnapshot: has("--no-snapshot"),
    noFixture: has("--no-fixture"),
    yes: has("--yes"),
    diffOnly: has("--diff-only"),
  };
}

function hostOf(url: string): string {
  let h = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  if (/\.feishu\.cn$/i.test(h)) h = "feishu.cn";
  return h;
}

function diffLines(a: string, b: string, label: string): string {
  if (a === b) return `[${label}] no diff (byte-identical)`;
  // Compute first divergence offset and line.
  let i = 0;
  while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
  const before = a.slice(0, i);
  const lineNo = (before.match(/\n/g) || []).length + 1;
  const ctxA = a.slice(Math.max(0, i - 80), i + 80);
  const ctxB = b.slice(Math.max(0, i - 80), i + 80);
  return `[${label}] divergence at offset ${i}/${b.length} (line ${lineNo})\n` +
    `  current: ${JSON.stringify(ctxA)}\n` +
    `  proposed:${JSON.stringify(ctxB)}\n` +
    `  Δ size: ${a.length - b.length} chars`;
}

function eyeReadSections(md: string): string {
  const lines = md.split("\n");
  const top = lines.slice(0, 30).join("\n");
  const tail = lines.slice(-30).join("\n");
  const mid = lines.length > 100
    ? lines.slice(Math.floor(lines.length / 2) - 15, Math.floor(lines.length / 2) + 15).join("\n")
    : "";
  return [
    `--- TOP 30 ---`,
    top,
    ...(mid ? [`--- MID 30 (line ${Math.floor(lines.length / 2) - 14} – ${Math.floor(lines.length / 2) + 15}) ---`, mid] : []),
    `--- TAIL 30 ---`,
    tail,
    `--- end (${lines.length} lines, ${md.length} bytes) ---`,
  ].join("\n");
}

async function promptYn(question: string): Promise<boolean> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const ans = (await rl.question(`${question} (y/n): `)).trim().toLowerCase();
    return ans === "y" || ans === "yes";
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const args = parseArgs();
  const hooks = findHooksByName(args.site);
  if (!hooks) {
    console.error(`unknown site: ${args.site}`);
    process.exit(2);
  }

  // ── 1. Capture from live URL ──
  console.log(`[1/6] capture ${args.url} via site=${args.site}`);
  const captured = hooks.capture(args.url);
  console.log(`     input.fn: ${captured.input.fn}`);
  console.log(`     markdown: ${captured.markdown.length} bytes`);

  // ── 2. Validate structural rules ──
  console.log(`[2/6] structural rules`);
  const violations = validateStructure(captured.markdown);
  if (violations.length > 0) {
    console.error(formatViolations(violations, `${args.site}/${args.name} candidate`));
    console.error(``);
    console.error(`REFUSING to write ground truth with structural defects.`);
    console.error(`Either fix the converter or refine the rule.`);
    process.exit(1);
  }
  console.log(`     ✓ all rules pass`);

  // ── 3. Eye-read sections ──
  console.log(`[3/6] eye-read sections`);
  console.log(eyeReadSections(captured.markdown));

  // ── 4. Diff vs current ground truth (if exists) ──
  console.log(`[4/6] diff vs current ground truth`);
  const fixtureDir = join(FIXTURES_ROOT, args.site);
  const expectedMdPath = join(fixtureDir, `${args.name}.expected.md`);
  if (existsSync(expectedMdPath)) {
    const current = readFileSync(expectedMdPath, "utf8");
    console.log(diffLines(current, captured.markdown, `fixture/${args.site}/${args.name}.expected.md`));
  } else {
    console.log(`     no current fixture (${expectedMdPath} does not exist) — first capture`);
  }

  if (args.diffOnly) {
    console.log(`\n--diff-only: exiting without writing`);
    return;
  }

  // ── 5. Prompt ──
  console.log("");
  if (!args.yes) {
    const ok = await promptYn(`Approve and write ground-truth artifacts for ${args.site}/${args.name}?`);
    if (!ok) {
      console.log(`aborted (no artifacts written)`);
      process.exit(0);
    }
  } else {
    console.log(`[--yes] skipping prompt`);
  }

  // ── 6. Atomic write ──
  console.log(`[5/6] write fixture + snapshot`);
  const written: string[] = [];
  let rolledBack = false;
  try {
    if (!args.noFixture) {
      mkdirSync(fixtureDir, { recursive: true });
      const inputPath = join(fixtureDir, `${args.name}.input.json`);
      const expectedJsonPath = join(fixtureDir, `${args.name}.expected.json`);
      writeFileSync(inputPath, JSON.stringify(captured.input, null, 2) + "\n");
      written.push(inputPath);
      writeFileSync(expectedMdPath, captured.markdown);
      written.push(expectedMdPath);
      writeFileSync(expectedJsonPath, JSON.stringify(captured.rest, null, 2) + "\n");
      written.push(expectedJsonPath);
      console.log(`     ✓ fixture written: ${args.name}.{input.json,expected.md,expected.json}`);
    }

    if (!args.noSnapshot && args.slug) {
      // Delegate to snapshot-create.ts (it handles the image-bundling
      // logic + invariants schema). Keeps approve.ts focused on the
      // fixture path + the eye-read/structural-rule layer.
      console.log(`     invoking snapshot-create.ts for slug=${args.slug}`);
      execSync(
        `npx tsx tools/__tests__/snapshot-create.ts "${args.url.replace(/"/g, '\\"')}" --slug ${args.slug}`,
        { cwd: REPO_ROOT, stdio: "inherit" },
      );
      // snapshot-create writes to tools/__tests__/snapshots/<host>/<slug>.{md,invariants.json}
      // and a <slug>-images/ directory; track for diagnostic purposes only.
      const host = hostOf(args.url);
      written.push(join(SNAPSHOTS_ROOT, host, `${args.slug}.md`));
    }
  } catch (e) {
    console.error(`[FAIL] write step failed: ${e instanceof Error ? e.message : e}`);
    console.error(`rolling back ${written.length} written files...`);
    for (const p of written) {
      try { rmSync(p, { force: true }); } catch { /* best-effort */ }
    }
    rolledBack = true;
    process.exit(1);
  }

  if (!rolledBack) {
    console.log(`[6/6] done — ${written.length} artifact(s) written`);
    if (!args.noFixture) {
      console.log(`     fixture: tools/__tests__/fixtures/converters/${args.site}/${args.name}.*`);
    }
    if (!args.noSnapshot && args.slug) {
      console.log(`     snapshot: tools/__tests__/snapshots/${hostOf(args.url)}/${args.slug}.{md,invariants.json,…-images/}`);
    }
    console.log("");
    console.log(`next: cd tools && npm test  # verify all tests pass`);
  }
}

main().catch((e) => {
  console.error(`approve.ts failed: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
