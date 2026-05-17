/**
 * `hirono auto-fix` — Tier-1 autonomous safe-by-construction repairs.
 *
 * Auto-applies ONLY operations where the operator can't lose information:
 *   - **Alias merges**: `00_Meta/entity-aliases.md` declares `variant → canonical`
 *     mappings. If both entities exist, merge them (operator's own
 *     statement says they're the same thing).
 *   - **Prepare refine prompts** for entities flagged stale-synthesis.
 *     Just writes prompt files; no mutations.
 *   - **Refresh indexes** if stale (reindex, build-sources-index) — already
 *     mechanical, no content rewrites.
 *
 * Auto-fix explicitly does NOT delete anything. Deletion stays in Tier-2
 * (`propose-curation` → operator review → `apply-queue`) because the
 * "is this _seen/ orphan worth keeping?" judgment requires LLM context.
 *
 * Cadence: safe to run on a cron / pre-commit hook. Atomic ops + log
 * entries + git revert keep failure modes recoverable.
 */

import { existsSync, readFileSync, mkdirSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEntityAliases } from "../curation.ts";
import { summarizeMeasures, estimateCostUSD } from "./_shared/prompt-measure.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..");

interface ParsedArgs {
  dryRun: boolean;
  skipRefine: boolean;
  skipReindex: boolean;
}

function usage(): never {
  console.error(`usage: hirono auto-fix [--dry-run] [--skip-refine-prep] [--skip-reindex]

Tier-1 safe-by-construction autonomous repairs. Does NOT delete anything.

Actions (in order):
  1. Alias merges — for each \`variant → canonical\` in 00_Meta/entity-aliases.md
     where BOTH Entities/_seen/{variant,canonical}.md exist, run
     \`hirono merge-entities <variant> --into <canonical>\`. Mechanically
     safe: the alias is operator-declared, the merge concatenates
     Observations + rewrites wikilinks + appends a refactor log entry.

  2. Refine-prompt preparation — for each active entity flagged stale by
     \`lint --check stale-synthesis\`, write a refine prompt package
     to \`.refine-prompts/<name>-synthesis-prompt.md\`. No mutations.
     Operator then spawns Sonnet → apply per the normal refine workflow.

  3. Index refresh — run reindex + build-sources-index to keep catalogs
     current. Mechanical; no content rewrites.

Flags:
  --dry-run            Print what would happen; don't dispatch.
  --skip-refine-prep   Skip step 2.
  --skip-reindex       Skip step 3.

What it does NOT do:
  - Auto-delete \`_seen/\` orphans (use \`hirono propose-curation\` for the
    Sonnet-judged orphan-pruning workflow).
  - Auto-apply refines (operator must spawn Sonnet + approve each).
  - Auto-merge anything not in 00_Meta/entity-aliases.md.
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  let dryRun = false;
  let skipRefine = false;
  let skipReindex = false;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
    else if (a === "--skip-refine-prep") skipRefine = true;
    else if (a === "--skip-reindex") skipReindex = true;
    else if (a === "--help" || a === "-h") usage();
    else { console.error(`unknown arg: ${a}`); usage(); }
  }
  return { dryRun, skipRefine, skipReindex };
}

// ---------------------------------------------------------------------------
// Step 1: alias merges
// ---------------------------------------------------------------------------

function listEntitySlugs(repoRoot: string): Set<string> {
  const out = new Set<string>();
  const dirs = [join(repoRoot, "02_Entities"), join(repoRoot, "02_Entities", "_seen")];
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) {
      if (f.endsWith(".md")) out.add(f.slice(0, -3));
    }
  }
  return out;
}

interface AliasMergeAction {
  variant: string;
  canonical: string;
}

function findAliasMerges(repoRoot: string): AliasMergeAction[] {
  const aliases = loadEntityAliases(repoRoot);
  const entities = listEntitySlugs(repoRoot);
  const out: AliasMergeAction[] = [];
  for (const [variant, canonical] of aliases.entries()) {
    if (entities.has(variant) && entities.has(canonical) && variant !== canonical) {
      out.push({ variant, canonical });
    }
  }
  return out;
}

function applyAliasMerge(repoRoot: string, action: AliasMergeAction, dryRun: boolean): { ok: boolean; msg: string } {
  if (dryRun) {
    return { ok: true, msg: `would run: hirono merge-entities ${quote(action.variant)} --into ${quote(action.canonical)} --reason "auto-fix: alias resolution per 00_Meta/entity-aliases.md"` };
  }
  const result = spawnSync("npx", [
    "tsx", "tools/bin/hirono.ts", "merge-entities",
    action.variant, "--into", action.canonical,
    "--reason", `auto-fix: alias resolution per 00_Meta/entity-aliases.md`,
  ], { cwd: repoRoot, encoding: "utf8" });
  if (result.status === 0) return { ok: true, msg: "merged" };
  return { ok: false, msg: (result.stderr || "non-zero exit").trim().slice(-200) };
}

function quote(s: string): string { return s.includes(" ") ? `"${s}"` : s; }

// ---------------------------------------------------------------------------
// Step 2: refine-prompt preparation
// ---------------------------------------------------------------------------

interface LintIssue { kind: string; severity: string; path: string; detail: string; hint?: string }

function findStaleSynthesis(repoRoot: string): string[] {
  const result = spawnSync("npx", ["tsx", "tools/bin/lint.ts", "--check", "stale-synthesis", "--json"], {
    cwd: repoRoot, encoding: "utf8",
  });
  const names: string[] = [];
  for (const line of result.stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const issue = JSON.parse(line) as LintIssue;
      if (issue.kind !== "stale-synthesis") continue;
      const m = issue.path.match(/^Entities\/(?:_seen\/)?([^\/]+?)\.md$/);
      if (m) names.push(m[1]);
    } catch { /* skip */ }
  }
  return names;
}

function prepareRefinePrompt(repoRoot: string, name: string, dryRun: boolean): { ok: boolean; msg: string } {
  if (dryRun) {
    return { ok: true, msg: `would prepare: hirono refine-entity ${quote(name)}` };
  }
  const result = spawnSync("npx", ["tsx", "tools/bin/hirono.ts", "refine-entity", name], {
    cwd: repoRoot, encoding: "utf8",
  });
  if (result.status === 0) return { ok: true, msg: "prompt prepared" };
  return { ok: false, msg: (result.stderr || result.stdout || "non-zero exit").trim().slice(-200) };
}

function findStaleTopicSynthesis(repoRoot: string): string[] {
  const result = spawnSync("npx", ["tsx", "tools/bin/lint.ts", "--check", "stale-topic-synthesis", "--json"], {
    cwd: repoRoot, encoding: "utf8",
  });
  const names: string[] = [];
  for (const line of result.stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const issue = JSON.parse(line) as LintIssue;
      if (issue.kind !== "stale-topic-synthesis") continue;
      const m = issue.path.match(/^Topics\/([^\/]+?)\.md$/);
      if (m) names.push(m[1]);
    } catch { /* skip */ }
  }
  return names;
}

/**
 * Topics with `## Comparison` heading but no table — the heading was added
 * (via `hirono add-comparison-heading`, manual edit, or Tier-2 dispatch)
 * but the axis × option table hasn't been generated yet. Same remediation
 * as stale-topic-synthesis: prep a refine-topic prompt (the prompt-builder
 * auto-detects the comparison heading and switches to 2-section mode).
 */
function findMissingComparisonTable(repoRoot: string): string[] {
  const result = spawnSync("npx", ["tsx", "tools/bin/lint.ts", "--check", "comparison-table-missing", "--json"], {
    cwd: repoRoot, encoding: "utf8",
  });
  const names: string[] = [];
  for (const line of result.stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const issue = JSON.parse(line) as LintIssue;
      if (issue.kind !== "comparison-table-missing") continue;
      const m = issue.path.match(/^Topics\/([^\/]+?)\.md$/);
      if (m) names.push(m[1]);
    } catch { /* skip */ }
  }
  return names;
}

function prepareRefineTopicPrompt(repoRoot: string, name: string, dryRun: boolean): { ok: boolean; msg: string } {
  if (dryRun) {
    return { ok: true, msg: `would prepare: hirono refine-topic ${quote(name)}` };
  }
  const result = spawnSync("npx", ["tsx", "tools/bin/hirono.ts", "refine-topic", name], {
    cwd: repoRoot, encoding: "utf8",
  });
  if (result.status === 0) return { ok: true, msg: "prompt prepared" };
  return { ok: false, msg: (result.stderr || result.stdout || "non-zero exit").trim().slice(-200) };
}

function findStaleTopSynthesis(repoRoot: string): boolean {
  const result = spawnSync("npx", ["tsx", "tools/bin/lint.ts", "--check", "stale-top-synthesis", "--json"], {
    cwd: repoRoot, encoding: "utf8",
  });
  for (const line of result.stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const issue = JSON.parse(line) as LintIssue;
      if (issue.kind === "stale-top-synthesis" && issue.severity === "warn") return true;
    } catch { /* skip */ }
  }
  return false;
}

function prepareTopSynthesisPrompt(repoRoot: string, dryRun: boolean): { ok: boolean; msg: string } {
  if (dryRun) return { ok: true, msg: "would prepare: hirono refine-synthesis" };
  const result = spawnSync("npx", ["tsx", "tools/bin/hirono.ts", "refine-synthesis"], {
    cwd: repoRoot, encoding: "utf8",
  });
  if (result.status === 0) return { ok: true, msg: "prompt prepared" };
  return { ok: false, msg: (result.stderr || result.stdout || "non-zero exit").trim().slice(-200) };
}

// ---------------------------------------------------------------------------
// Step 3: index refresh
// ---------------------------------------------------------------------------

function refreshIndexes(repoRoot: string, dryRun: boolean): { reindexOk: boolean; indexOk: boolean } {
  if (dryRun) return { reindexOk: true, indexOk: true };
  const r1 = spawnSync("npx", ["tsx", "tools/bin/reindex.ts"], { cwd: repoRoot, encoding: "utf8" });
  const r2 = spawnSync("npx", ["tsx", "tools/bin/build-sources-index.ts"], { cwd: repoRoot, encoding: "utf8" });
  return { reindexOk: r1.status === 0, indexOk: r2.status === 0 };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export interface AutoFixResult {
  aliasMergesAttempted: number;
  aliasMergesApplied: number;
  refinePromptsAttempted: number;
  refinePromptsPrepared: number;
  indexRefreshed: boolean;
  dryRun: boolean;
}

export function autoFix(repoRoot: string, opts: ParsedArgs): AutoFixResult {
  const r: AutoFixResult = {
    aliasMergesAttempted: 0, aliasMergesApplied: 0,
    refinePromptsAttempted: 0, refinePromptsPrepared: 0,
    indexRefreshed: false, dryRun: opts.dryRun,
  };

  // Step 1
  const merges = findAliasMerges(repoRoot);
  r.aliasMergesAttempted = merges.length;
  if (merges.length > 0) {
    console.log(`# Step 1: alias merges (${merges.length} candidate${merges.length === 1 ? "" : "s"})`);
    for (const m of merges) {
      const result = applyAliasMerge(repoRoot, m, opts.dryRun);
      const sym = result.ok ? (opts.dryRun ? "·" : "✓") : "✖";
      console.log(`  ${sym} ${m.variant} → ${m.canonical}${result.ok ? (opts.dryRun ? `\n    ↳ ${result.msg}` : "") : `\n    ↳ ${result.msg}`}`);
      if (result.ok && !opts.dryRun) r.aliasMergesApplied++;
    }
  } else {
    console.log(`# Step 1: alias merges — none pending (no overlapping entries in 00_Meta/entity-aliases.md)`);
  }
  console.log();

  // Step 2
  if (!opts.skipRefine) {
    const stale = findStaleSynthesis(repoRoot);
    const staleTopics = findStaleTopicSynthesis(repoRoot);
    const missingTables = findMissingComparisonTable(repoRoot).filter(n => !staleTopics.includes(n));  // dedupe
    const staleTop = findStaleTopSynthesis(repoRoot);
    r.refinePromptsAttempted = stale.length + staleTopics.length + missingTables.length + (staleTop ? 1 : 0);
    if (stale.length + staleTopics.length + missingTables.length > 0 || staleTop) {
      const labelParts: string[] = [];
      if (stale.length > 0) labelParts.push(`${stale.length} stale entit${stale.length === 1 ? "y" : "ies"}`);
      if (staleTopics.length > 0) labelParts.push(`${staleTopics.length} stale topic${staleTopics.length === 1 ? "" : "s"}`);
      if (missingTables.length > 0) labelParts.push(`${missingTables.length} comparison table${missingTables.length === 1 ? "" : "s"} pending`);
      if (staleTop) labelParts.push("top-level Synthesis");
      console.log(`# Step 2: refine-prompt prep (${labelParts.join(" + ")})`);
      for (const name of stale) {
        const result = prepareRefinePrompt(repoRoot, name, opts.dryRun);
        const sym = result.ok ? (opts.dryRun ? "·" : "✓") : "✖";
        console.log(`  ${sym} entity:${name}${result.ok ? "" : `\n    ↳ ${result.msg}`}`);
        if (result.ok && !opts.dryRun) r.refinePromptsPrepared++;
      }
      for (const name of staleTopics) {
        const result = prepareRefineTopicPrompt(repoRoot, name, opts.dryRun);
        const sym = result.ok ? (opts.dryRun ? "·" : "✓") : "✖";
        console.log(`  ${sym} topic:${name}${result.ok ? "" : `\n    ↳ ${result.msg}`}`);
        if (result.ok && !opts.dryRun) r.refinePromptsPrepared++;
      }
      for (const name of missingTables) {
        const result = prepareRefineTopicPrompt(repoRoot, name, opts.dryRun);
        const sym = result.ok ? (opts.dryRun ? "·" : "✓") : "✖";
        console.log(`  ${sym} topic-comparison:${name}${result.ok ? "" : `\n    ↳ ${result.msg}`}`);
        if (result.ok && !opts.dryRun) r.refinePromptsPrepared++;
      }
      if (staleTop) {
        const result = prepareTopSynthesisPrompt(repoRoot, opts.dryRun);
        const sym = result.ok ? (opts.dryRun ? "·" : "✓") : "✖";
        console.log(`  ${sym} Synthesis.md (top-level)${result.ok ? "" : `\n    ↳ ${result.msg}`}`);
        if (result.ok && !opts.dryRun) r.refinePromptsPrepared++;
      }
      console.log(`\n  Next: spawn Sonnet subagents on the .refine-prompts/ files, save responses, then \`hirono refine-entity <name> --response <path> --apply\` (or \`refine-topic\` / \`refine-synthesis\` per file).`);
      // Cost summary across ALL currently-pending prompts in .refine-prompts/
      // (not just this run — measure sidecars accumulate until apply).
      if (!opts.dryRun) {
        const summary = summarizeMeasures(join(repoRoot, ".refine-prompts"));
        if (summary.count > 0) {
          const cost = estimateCostUSD(summary);
          console.log(`\n  Pending dispatch cost: ~$${cost.toFixed(2)} across ${summary.count} prompt(s), ~${(summary.est_input_tokens / 1000).toFixed(1)}K input tokens.`);
          console.log(`  Cap a smaller batch: \`hirono refine-all-stale --limit 10\`.  Headline view: \`hirono ingest-preview\`.`);
        }
      }
    } else {
      console.log(`# Step 2: refine-prompt prep — no stale Syntheses`);
    }
    console.log();
  }

  // Step 3
  if (!opts.skipReindex) {
    if (opts.dryRun) {
      console.log(`# Step 3: would refresh reindex + build-sources-index`);
    } else {
      const ref = refreshIndexes(repoRoot, false);
      r.indexRefreshed = ref.reindexOk && ref.indexOk;
      console.log(`# Step 3: index refresh ${r.indexRefreshed ? "✓" : "✖"} (reindex: ${ref.reindexOk ? "ok" : "FAIL"}, sources-index: ${ref.indexOk ? "ok" : "FAIL"})`);
    }
    console.log();
  }

  // Summary
  console.log(`Summary: ${opts.dryRun ? "DRY-RUN; nothing changed.\n" : ""}` +
    `alias merges: ${r.aliasMergesApplied}/${r.aliasMergesAttempted}` +
    (opts.skipRefine ? "" : `  ·  refine prompts: ${r.refinePromptsPrepared}/${r.refinePromptsAttempted}`) +
    (opts.skipReindex ? "" : `  ·  index: ${r.indexRefreshed ? "refreshed" : "skipped/failed"}`));

  return r;
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  try {
    autoFix(REPO_ROOT_DEFAULT, args);
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
