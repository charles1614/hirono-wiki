/**
 * `hirono refine-all-stale` — batch mode for refine-entity.
 *
 * Runs `tools/bin/lint.ts --check stale-synthesis --json`, extracts each
 * flagged active-tier entity name, and (by default) prepares a refine
 * prompt for each (calls `refineEntity(...)` in prepare mode). Operator
 * then orchestrates the Sonnet subagent calls + apply phase per entity.
 *
 * In `--list` mode, just prints the entity names + suggested commands
 * without writing any prompt files.
 */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { refineEntity } from "./refine-entity.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..");

interface ParsedArgs {
  list: boolean;
}

function usage(): never {
  console.error(`usage: hirono refine-all-stale [--list]

Run stale-synthesis lint, prepare a refine prompt for each flagged entity.

  (no flags)   For each stale entity, invoke \`refine-entity <name>\` in
               prepare mode (writes prompt to Entities/_refine-prompts/).
  --list       Print the stale entity names + per-entity commands; do
               NOT write any prompt files.

Operator then handles each: Sonnet subagent → save response → apply.
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  let list = false;
  for (const a of argv) {
    if (a === "--list") list = true;
    else if (a === "--help" || a === "-h") usage();
    else { console.error(`unknown arg: ${a}`); usage(); }
  }
  return { list };
}

interface LintIssue {
  kind: string;
  severity: string;
  path: string;
  detail: string;
  hint?: string;
}

function runStaleSynthesisLint(repoRoot: string): LintIssue[] {
  const result = spawnSync("npx", ["tsx", "tools/bin/lint.ts", "--check", "stale-synthesis", "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status === null) {
    throw new Error(`lint failed to run: ${result.error?.message ?? "unknown"}`);
  }
  // exit code 1 just means lint found issues — output is still valid
  const out = result.stdout.trim();
  if (!out) return [];
  const issues: LintIssue[] = [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    try { issues.push(JSON.parse(line)); } catch { /* skip malformed */ }
  }
  return issues.filter(i => i.kind === "stale-synthesis");
}

/** Extract entity name from a path like `Entities/MLA.md` → `MLA`. */
function entityNameFromPath(p: string): string | null {
  const m = p.match(/^Entities\/(?:_seen\/)?([^\/]+?)\.md$/);
  return m ? m[1] : null;
}

export function refineAllStale(repoRoot: string, opts: { list?: boolean } = {}): { stale: { name: string; path: string; detail: string }[]; prepared: string[] } {
  const issues = runStaleSynthesisLint(repoRoot);
  const stale: { name: string; path: string; detail: string }[] = [];
  for (const i of issues) {
    const name = entityNameFromPath(i.path);
    if (!name) continue;
    stale.push({ name, path: i.path, detail: i.detail });
  }

  if (opts.list) return { stale, prepared: [] };

  // Prepare prompt for each
  const prepared: string[] = [];
  for (const s of stale) {
    try {
      refineEntity(repoRoot, s.name);
      prepared.push(s.name);
    } catch (e) {
      console.error(`  ⚠ failed to prepare prompt for ${s.name}: ${(e as Error).message}`);
    }
  }
  return { stale, prepared };
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  try {
    const r = refineAllStale(REPO_ROOT_DEFAULT, { list: args.list });
    if (r.stale.length === 0) {
      console.log(`✓ no stale-synthesis issues; nothing to refine.`);
      return;
    }
    console.log(`Found ${r.stale.length} entity Syntheses flagged as stale:\n`);
    for (const s of r.stale) {
      console.log(`  - [[${s.name}]] (${s.path})`);
      console.log(`      ${s.detail}`);
    }
    console.log();
    if (args.list) {
      console.log(`Per-entity commands (run manually):`);
      for (const s of r.stale) console.log(`  hirono refine-entity ${s.name}`);
    } else {
      console.log(`✓ prepared ${r.prepared.length} prompt(s) under Entities/_refine-prompts/`);
      console.log(`\nNext steps (per entity):`);
      console.log(`  1. Spawn Sonnet subagent with each prompt.`);
      console.log(`  2. Save response to Entities/_refine-prompts/<name>-synthesis-response.txt`);
      console.log(`  3. \`hirono refine-entity <name> --response <path> --apply\``);
    }
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
