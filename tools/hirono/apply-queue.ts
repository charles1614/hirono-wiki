/**
 * `hirono apply-queue` — execute approved curation proposals from
 * `Meta/curation-queue.md`.
 *
 * Reads the queue markdown produced by `propose-curation --finalize`. For
 * each proposal section, the operator either:
 *   - ticked the `[x] approved` checkbox → execute
 *   - left `[ ]` empty → skip
 *
 * Each approved item dispatches to the existing atomic CLI (merge-entities,
 * rename-entity, etc.). All mutations go through the Phase A two-phase-commit
 * + log-entry machinery — apply-queue itself is just a thin dispatcher.
 *
 * Modes:
 *   - (no flags): dispatch only items the operator checked.
 *   - --auto-apply <high|medium|low>: dispatch every proposal at or above
 *     the named confidence, regardless of checkbox. Useful when the operator
 *     trusts Sonnet's high-confidence calls.
 *   - --dry-run: print what would happen, don't dispatch.
 *
 * Each dispatch is independent — a failure on item 3 doesn't block item 4.
 * Final summary reports per-item outcomes.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..");

interface ParsedArgs {
  autoApply: "high" | "medium" | "low" | null;
  dryRun: boolean;
  queuePath: string;
}

function usage(): never {
  console.error(`usage: hirono apply-queue [--auto-apply <high|medium|low>] [--dry-run] [--queue <path>]

Execute approved proposals from Meta/curation-queue.md.

Flags:
  --auto-apply <level>   Dispatch all proposals at confidence >= <level>,
                         ignoring checkbox state. high|medium|low.
  --dry-run              Print what would happen; don't dispatch.
  --queue <path>         Override queue file location (default: Meta/curation-queue.md).
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  let autoApply: ParsedArgs["autoApply"] = null;
  let dryRun = false;
  let queuePath = "Meta/curation-queue.md";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--auto-apply") {
      i++;
      const v = (argv[i] ?? "").trim();
      if (!["high", "medium", "low"].includes(v)) { console.error(`invalid --auto-apply: ${v}`); usage(); }
      autoApply = v as ParsedArgs["autoApply"];
    } else if (a === "--dry-run") dryRun = true;
    else if (a === "--queue") { i++; queuePath = (argv[i] ?? "").trim(); }
    else if (a === "--help" || a === "-h") usage();
    else { console.error(`unknown arg: ${a}`); usage(); }
  }
  return { autoApply, dryRun, queuePath };
}

// ---------------------------------------------------------------------------
// Parse curation-queue.md
// ---------------------------------------------------------------------------

interface QueueItem {
  idx: number;
  heading: string;
  confidence: "high" | "medium" | "low";
  approved: boolean;
  rationale: string;
  command: string;
}

const CONF_ORDER = { low: 0, medium: 1, high: 2 } as const;

export function parseQueue(markdown: string): QueueItem[] {
  const items: QueueItem[] = [];
  const lines = markdown.split("\n");

  // Find each "### N. ... [confidence: X]" section
  let i = 0;
  while (i < lines.length) {
    const headingMatch = lines[i].match(/^### (\d+)\.\s+(.+?)\s+\[confidence:\s*(high|medium|low)\]\s*$/);
    if (!headingMatch) { i++; continue; }
    const idx = parseInt(headingMatch[1], 10);
    const heading = headingMatch[2].trim();
    const confidence = headingMatch[3] as QueueItem["confidence"];

    // Find the next "### " heading or "## " heading (= end of this section)
    let endIdx = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^#{2,3}\s/.test(lines[j])) { endIdx = j; break; }
    }
    const section = lines.slice(i, endIdx).join("\n");

    // Parse `- [x] approved` or `- [ ] approved`
    const approved = /^- \[x\]\s+approved/im.test(section);

    // Rationale
    const ratMatch = section.match(/^\*\*Rationale\*\*:\s*(.+)$/m);
    const rationale = ratMatch ? ratMatch[1].trim() : "";

    // Command — first fenced code block (skip lines starting with `#` comment-only)
    const cmdMatch = section.match(/```\s*\n([\s\S]+?)```/);
    let command = "";
    if (cmdMatch) {
      command = cmdMatch[1]
        .split("\n")
        .filter(l => l.trim() && !l.trim().startsWith("#"))
        .join("\n")
        .trim();
    }

    items.push({ idx, heading, confidence, approved, rationale, command });
    i = endIdx;
  }
  return items;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

interface ApplyResult {
  idx: number;
  heading: string;
  outcome: "applied" | "skipped" | "failed" | "dry-run";
  reason: string;
  stdout?: string;
}

function shouldDispatch(item: QueueItem, autoApply: ParsedArgs["autoApply"]): boolean {
  if (autoApply) {
    return CONF_ORDER[item.confidence] >= CONF_ORDER[autoApply];
  }
  return item.approved;
}

function dispatchOne(item: QueueItem, repoRoot: string, dryRun: boolean): ApplyResult {
  if (!item.command) {
    return { idx: item.idx, heading: item.heading, outcome: "failed", reason: "no command parsed" };
  }
  // Strip leading `hirono ` and trailing inline shell comment
  // (`hirono X  # explain` → `X`). The queue renderer emits comments for
  // human-readable hints; they'd be parsed as args otherwise.
  const cmd = item.command.replace(/^hirono\s+/, "").replace(/\s+#.*$/, "");
  if (dryRun) {
    return { idx: item.idx, heading: item.heading, outcome: "dry-run", reason: `hirono ${cmd}` };
  }
  const argv = ["tsx", "tools/bin/hirono.ts", ...splitArgv(cmd)];
  const result = spawnSync("npx", argv, { cwd: repoRoot, encoding: "utf8" });
  if (result.status === 0) {
    return { idx: item.idx, heading: item.heading, outcome: "applied", reason: "ok", stdout: result.stdout.trim().slice(-200) };
  }
  return { idx: item.idx, heading: item.heading, outcome: "failed", reason: (result.stderr || "non-zero exit").trim().slice(-300) };
}

/** Naive shell-style argv splitter — handles "double-quoted" and 'single-quoted' tokens. */
function splitArgv(cmd: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cmd)) !== null) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function applyQueue(repoRoot: string, opts: { autoApply?: ParsedArgs["autoApply"]; dryRun?: boolean; queuePath?: string } = {}): ApplyResult[] {
  const queueAbs = join(repoRoot, opts.queuePath ?? "Meta/curation-queue.md");
  if (!existsSync(queueAbs)) throw new Error(`queue file not found: ${queueAbs}`);
  const markdown = readFileSync(queueAbs, "utf8");
  const items = parseQueue(markdown);

  const results: ApplyResult[] = [];
  for (const item of items) {
    if (!shouldDispatch(item, opts.autoApply ?? null)) {
      results.push({ idx: item.idx, heading: item.heading, outcome: "skipped", reason: opts.autoApply ? `confidence < ${opts.autoApply}` : "not approved" });
      continue;
    }
    results.push(dispatchOne(item, repoRoot, opts.dryRun ?? false));
  }
  return results;
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  try {
    const results = applyQueue(REPO_ROOT_DEFAULT, {
      autoApply: args.autoApply, dryRun: args.dryRun, queuePath: args.queuePath,
    });
    const counts = { applied: 0, skipped: 0, failed: 0, "dry-run": 0 };
    console.log(`# apply-queue results\n`);
    for (const r of results) {
      const sym = r.outcome === "applied" ? "✓" : r.outcome === "skipped" ? "◦" : r.outcome === "dry-run" ? "·" : "✖";
      console.log(`${sym} [${r.outcome}] ${r.idx}. ${r.heading}`);
      if (r.outcome === "failed") console.log(`    ↳ ${r.reason}`);
      else if (r.outcome === "dry-run") console.log(`    ↳ would run: ${r.reason}`);
      counts[r.outcome]++;
    }
    console.log(`\nSummary: ${counts.applied} applied, ${counts.skipped} skipped, ${counts.failed} failed${counts["dry-run"] ? `, ${counts["dry-run"]} dry-run` : ""}`);
    if (counts.failed > 0) process.exit(1);
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
