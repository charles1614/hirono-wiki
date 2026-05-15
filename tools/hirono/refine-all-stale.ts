/**
 * `hirono refine-all-stale` — batch mode for refine-entity.
 *
 * Runs `tools/bin/lint.ts --check stale-synthesis --json`, extracts each
 * flagged active-tier entity name, and (by default) prepares a refine
 * prompt for each (calls `refineEntity(...)` in prepare mode). Operator
 * then orchestrates the Sonnet subagent calls + apply phase per entity.
 *
 * Modes:
 *   (no flags)   For each stale entity, prepare a prompt under
 *                `.refine-prompts/`.
 *   --list       Print names + suggested commands; no writes.
 *   --preview    Run each refine through preview mode (no disk writes);
 *                aggregate prompt sizes; print "would spawn N refines,
 *                ~T tokens, ~$P estimated" cost summary. Exit 0.
 *   --limit N    Prepare prompts only for the top-N most-stale items
 *                (sorted by lag-days desc). Remaining items are printed
 *                with their lag so the operator knows what's deferred.
 *                Safe to chain: per-item `synthesis_updated_at` counters
 *                are independent, next run picks up the deferred items.
 */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { refineEntity } from "./refine-entity.ts";
import {
  estimateCostUSD,
  type MeasureSummary,
} from "./_shared/prompt-measure.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..");

interface ParsedArgs {
  list: boolean;
  preview: boolean;
  limit: number | null;
}

function usage(): never {
  console.error(`usage: hirono refine-all-stale [--list | --preview | --limit N]

Run stale-synthesis lint, prepare a refine prompt for each flagged entity.

  (no flags)   For each stale entity, invoke \`refine-entity <name>\` in
               prepare mode (writes prompt to .refine-prompts/).
  --list       Print the stale entity names + per-entity commands; do
               NOT write any prompt files.
  --preview    Build each prompt in memory (no disk writes), aggregate
               sizes, print cost preview ("would spawn N, ~T tokens,
               ~\$P"). Useful before authorizing a refine batch.
  --limit N    Prepare prompts only for the top-N most-stale items.
               Remaining items are listed as deferred with their lag.
               Per-item counters are independent; safe to chain runs.

Operator then handles each: Sonnet subagent → save response → apply.
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  let list = false;
  let preview = false;
  let limit: number | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") list = true;
    else if (a === "--preview") preview = true;
    else if (a === "--limit") {
      const v = argv[++i];
      if (!v || !/^\d+$/.test(v)) { console.error(`--limit requires a positive integer`); usage(); }
      limit = parseInt(v, 10);
      if (limit < 1) { console.error(`--limit must be ≥ 1`); usage(); }
    }
    else if (a === "--help" || a === "-h") usage();
    else { console.error(`unknown arg: ${a}`); usage(); }
  }
  return { list, preview, limit };
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

/**
 * Parse the lag-days out of the lint detail string. Two known shapes:
 *   - "synthesis_updated_at=YYYY-MM-DD is Nd older than newest citing..."
 *   - "synthesis_updated_at=YYYY-MM-DD is Nd old with K Observations..."
 * Returns 0 if neither matches (defensive).
 */
export function lagDaysFromDetail(detail: string): number {
  const m = detail.match(/is (\d+)d/);
  return m ? parseInt(m[1], 10) : 0;
}

export interface StaleItem {
  name: string;
  path: string;
  detail: string;
  lagDays: number;
}

export function refineAllStale(
  repoRoot: string,
  opts: { list?: boolean; preview?: boolean; limit?: number | null } = {},
): {
  stale: StaleItem[];
  prepared: string[];
  deferred: StaleItem[];
  preview?: MeasureSummary;
} {
  const issues = runStaleSynthesisLint(repoRoot);
  const stale: StaleItem[] = [];
  for (const i of issues) {
    const name = entityNameFromPath(i.path);
    if (!name) continue;
    stale.push({ name, path: i.path, detail: i.detail, lagDays: lagDaysFromDetail(i.detail) });
  }
  // Sort by lag desc — oldest staleness first
  stale.sort((a, b) => b.lagDays - a.lagDays);

  if (opts.list) return { stale, prepared: [], deferred: [] };

  // Preview mode: build each prompt in memory, aggregate, no writes.
  if (opts.preview) {
    const by_kind: Record<string, { count: number; total_chars: number }> = {
      "refine-entity": { count: 0, total_chars: 0 },
    };
    const all: Array<{ path: string; chars: number; source_count: number; kind: string }> = [];
    let total_chars = 0;
    let total_lines = 0;
    for (const s of stale) {
      try {
        const r = refineEntity(repoRoot, s.name, { preview: true });
        const chars = r.promptChars ?? 0;
        const lines = r.promptLines ?? 0;
        const srcCount = r.sourceCount ?? 0;
        total_chars += chars;
        total_lines += lines;
        by_kind["refine-entity"].count += 1;
        by_kind["refine-entity"].total_chars += chars;
        all.push({ path: `.refine-prompts/${s.name}-synthesis-prompt.md`, chars, source_count: srcCount, kind: "refine-entity" });
      } catch (e) {
        console.error(`  ⚠ failed to preview ${s.name}: ${(e as Error).message}`);
      }
    }
    const summary: MeasureSummary = {
      count: all.length,
      total_chars,
      total_lines,
      est_input_tokens: Math.round(total_chars / 4),
      by_kind,
      largest: [...all].sort((a, b) => b.chars - a.chars).slice(0, 5),
    };
    return { stale, prepared: [], deferred: [], preview: summary };
  }

  // Cap to top-N most stale; defer the rest
  const limit = opts.limit ?? null;
  const targets = limit !== null ? stale.slice(0, limit) : stale;
  const deferred = limit !== null ? stale.slice(limit) : [];

  // Prepare prompt for each target
  const prepared: string[] = [];
  for (const s of targets) {
    try {
      refineEntity(repoRoot, s.name);
      prepared.push(s.name);
    } catch (e) {
      console.error(`  ⚠ failed to prepare prompt for ${s.name}: ${(e as Error).message}`);
    }
  }
  return { stale, prepared, deferred };
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  try {
    const r = refineAllStale(REPO_ROOT_DEFAULT, { list: args.list, preview: args.preview, limit: args.limit });
    if (r.stale.length === 0) {
      console.log(`✓ no stale-synthesis issues; nothing to refine.`);
      return;
    }
    console.log(`Found ${r.stale.length} entity Syntheses flagged as stale (sorted by lag desc):\n`);
    for (const s of r.stale) {
      console.log(`  - [[${s.name}]] (lag ${s.lagDays}d) (${s.path})`);
      console.log(`      ${s.detail}`);
    }
    console.log();
    if (args.preview && r.preview) {
      const cost = estimateCostUSD(r.preview);
      console.log(`Would spawn ${r.preview.count} refine(s):`);
      console.log(`  Total chars:       ~${(r.preview.total_chars / 1000).toFixed(1)}K`);
      console.log(`  Est input tokens:  ~${(r.preview.est_input_tokens / 1000).toFixed(1)}K`);
      console.log(`  Est dispatch cost: ~$${cost.toFixed(2)} (Sonnet 4.6, input + 30% output)`);
      console.log(`\nNo prompts written. To actually prepare:`);
      console.log(`  hirono refine-all-stale            # prepare all`);
      console.log(`  hirono refine-all-stale --limit 20 # cap to top 20`);
      return;
    }
    if (args.list) {
      console.log(`Per-entity commands (run manually):`);
      for (const s of r.stale) console.log(`  hirono refine-entity ${s.name}`);
      return;
    }
    console.log(`✓ prepared ${r.prepared.length} prompt(s) under .refine-prompts/`);
    if (r.deferred.length > 0) {
      console.log(`\nDeferred ${r.deferred.length} item(s) (cap by --limit):`);
      for (const s of r.deferred) console.log(`  - [[${s.name}]] (lag ${s.lagDays}d)`);
      console.log(`\nDeferred items keep their per-item lag counters; next run picks them up in lag-desc order.`);
    }
    console.log(`\nNext steps (per entity):`);
    console.log(`  1. Spawn Sonnet subagent with each prompt.`);
    console.log(`  2. Save response to .refine-prompts/<name>-synthesis-response.txt`);
    console.log(`  3. \`hirono refine-entity <name> --response <path> --apply\``);
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
