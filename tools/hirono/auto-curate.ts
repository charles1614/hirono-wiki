/**
 * `hirono auto-curate` — unified two-phase curation loop.
 *
 * Consolidates the 5-command full-auto cycle into 2 commands with one
 * Sonnet spawn in between. Thin orchestrator over existing CLIs:
 *
 *   Phase 1 (no flags):
 *     auto-fix → propose-curation
 *     → prints next-step instructions
 *
 *   Phase 2 (--continue):
 *     propose-curation --finalize → apply-queue --auto-apply <level>
 *     → reports summary
 *
 *   With --review: Phase 2 stops after finalize so the operator can tick
 *   approved boxes in 00_Meta/curation-queue.md, then runs apply-queue
 *   (without --auto-apply) so only checked items dispatch.
 *
 * All work is delegated to existing CLIs — this file adds no curation
 * logic; it's just a one-command UX wrapper.
 */

import { existsSync } from "node:fs";
import { spawnSync, SpawnSyncReturns } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..");
const RESPONSE_DEFAULT = ".curation-prompts/curation-proposal-response.json";

interface ParsedArgs {
  continueMode: boolean;
  review: boolean;
  autoApply: "high" | "medium" | "low";
  dryRun: boolean;
  skipAutoFix: boolean;
  skipPropose: boolean;
  skipApply: boolean;
  responsePath: string;
}

function usage(): never {
  console.error(`usage: hirono auto-curate [--continue] [--review] [--auto-apply <level>] [--dry-run] [--skip-step <name>]

Unified two-phase curation loop. Thin orchestrator over existing CLIs.

Phase 1 (no flags):
  Runs auto-fix → propose-curation. Prints next-step instructions
  for the Sonnet subagent spawn.

Phase 2 (--continue):
  Reads the Sonnet response, runs propose-curation --finalize, then
  apply-queue --auto-apply <level> (full-auto by default).

Flags:
  --continue              Run Phase 2.
  --review                Phase 2 stops after finalize. Operator opens
                          00_Meta/curation-queue.md, ticks approved boxes,
                          then re-runs without --review (or runs
                          \`hirono apply-queue\` directly).
  --auto-apply <level>    Confidence threshold for apply-queue dispatch.
                          One of: high (default), medium, low.
  --dry-run               Show what would run; don't dispatch.
  --skip-step <name>      Skip a step. One of: auto-fix, propose, apply.
                          Can be passed multiple times.
  --response <path>       Path to Sonnet response JSON (default:
                          .curation-prompts/curation-proposal-response.json).

Typical operator session:

  hirono auto-curate
  # → spawn Sonnet on the printed prompt, save response.
  hirono auto-curate --continue
  # → executes high-confidence Sonnet proposals atomically.
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    continueMode: false, review: false, autoApply: "high", dryRun: false,
    skipAutoFix: false, skipPropose: false, skipApply: false,
    responsePath: RESPONSE_DEFAULT,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--continue") args.continueMode = true;
    else if (a === "--review") args.review = true;
    else if (a === "--auto-apply") {
      i++;
      const v = (argv[i] ?? "").trim();
      if (!["high", "medium", "low"].includes(v)) { console.error(`invalid --auto-apply: ${v}`); usage(); }
      args.autoApply = v as ParsedArgs["autoApply"];
    } else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--skip-step") {
      i++;
      const v = (argv[i] ?? "").trim();
      if (v === "auto-fix") args.skipAutoFix = true;
      else if (v === "propose") args.skipPropose = true;
      else if (v === "apply") args.skipApply = true;
      else { console.error(`invalid --skip-step: ${v}`); usage(); }
    } else if (a === "--response") { i++; args.responsePath = (argv[i] ?? "").trim() || RESPONSE_DEFAULT; }
    else if (a === "--help" || a === "-h") usage();
    else { console.error(`unknown arg: ${a}`); usage(); }
  }
  return args;
}

function runHirono(repoRoot: string, cmd: string[], opts: { dryRun: boolean }): { ok: boolean; out: string } {
  if (opts.dryRun) {
    return { ok: true, out: `[dry-run] would run: hirono ${cmd.join(" ")}` };
  }
  const result: SpawnSyncReturns<string> = spawnSync(
    "npx", ["tsx", "tools/bin/hirono.ts", ...cmd],
    { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const merged = (result.stdout + (result.stderr ? "\n" + result.stderr : "")).trim();
  return { ok: result.status === 0, out: merged };
}

function logStep(idx: number, name: string, sym: string, ok: boolean): void {
  const status = ok ? sym : "✖";
  console.log(`\n=== Step ${idx}: ${name} ${status} ===`);
}

// ---------------------------------------------------------------------------
// Phase 1
// ---------------------------------------------------------------------------

export function phase1(repoRoot: string, args: ParsedArgs): { ok: boolean } {
  let stepNum = 0;

  // 1. auto-fix
  if (!args.skipAutoFix) {
    stepNum++;
    const r = runHirono(repoRoot, ["auto-fix", ...(args.dryRun ? ["--dry-run"] : [])], { dryRun: false });
    logStep(stepNum, "auto-fix (zero-touch repairs)", "✓", r.ok);
    console.log(r.out.split("\n").map(l => "  " + l).join("\n"));
    if (!r.ok) return { ok: false };
  }

  // 2. propose-curation
  if (!args.skipPropose) {
    stepNum++;
    const r = runHirono(repoRoot, ["propose-curation"], { dryRun: args.dryRun });
    logStep(stepNum, "propose-curation (generate prompt)", "✓", r.ok);
    console.log(r.out.split("\n").map(l => "  " + l).join("\n"));
    if (!r.ok) return { ok: false };
  }

  console.log(`\n=== Phase 1 complete ===\n`);
  console.log(`Next steps:`);
  console.log(`  1. Spawn a Sonnet subagent with the prompt at:`);
  console.log(`        .curation-prompts/curation-proposal-prompt.md`);
  console.log(`  2. Save the JSON response to:`);
  console.log(`        ${args.responsePath}`);
  console.log(`  3. Re-run with --continue${args.review ? " --review" : ""}${args.autoApply !== "high" ? ` --auto-apply ${args.autoApply}` : ""}.`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Phase 2
// ---------------------------------------------------------------------------

export function phase2(repoRoot: string, args: ParsedArgs): { ok: boolean } {
  const respAbs = join(repoRoot, args.responsePath);
  if (!existsSync(respAbs)) {
    console.error(`error: Sonnet response not found at ${args.responsePath}`);
    console.error(`Did you spawn Sonnet on the prompt + save the response?`);
    return { ok: false };
  }

  let stepNum = 0;

  // 3. propose-curation --finalize
  if (!args.skipPropose) {
    stepNum++;
    const r = runHirono(repoRoot, ["propose-curation", "--finalize", args.responsePath], { dryRun: args.dryRun });
    logStep(stepNum, "propose-curation --finalize (render queue)", "✓", r.ok);
    console.log(r.out.split("\n").map(l => "  " + l).join("\n"));
    if (!r.ok) return { ok: false };
  }

  // If --review: stop here for operator approval
  if (args.review) {
    console.log(`\n=== Phase 2 paused for review ===\n`);
    console.log(`Open 00_Meta/curation-queue.md and tick \`[x]\` next to approved items.`);
    console.log(`Then run:`);
    console.log(`  npx tsx tools/bin/hirono.ts apply-queue${args.dryRun ? " --dry-run" : ""}`);
    return { ok: true };
  }

  // 4. apply-queue --auto-apply <level>
  if (!args.skipApply) {
    stepNum++;
    const applyArgs = ["apply-queue", "--auto-apply", args.autoApply];
    if (args.dryRun) applyArgs.push("--dry-run");
    const r = runHirono(repoRoot, applyArgs, { dryRun: false });
    logStep(stepNum, `apply-queue --auto-apply ${args.autoApply}`, "✓", r.ok);
    console.log(r.out.split("\n").map(l => "  " + l).join("\n"));
    if (!r.ok) return { ok: false };
  }

  console.log(`\n=== Phase 2 complete ===\n`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  try {
    const r = args.continueMode ? phase2(REPO_ROOT_DEFAULT, args) : phase1(REPO_ROOT_DEFAULT, args);
    if (!r.ok) process.exit(1);
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
