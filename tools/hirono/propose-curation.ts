/**
 * `hirono propose-curation` — Tier-2 LLM-judgment-driven curation loop.
 *
 * Compresses the manual decide→invoke loop into one operator approval.
 * Phase A's atomic mutators (rename / merge / delete-orphan / refine) provide
 * the verbs; this CLI wires them into a propose→review→apply pipeline.
 *
 * Three modes mirroring auto-detect-entities and refine-entity:
 *
 *   1. Prepare prompt (no flags):
 *      Runs `health-check --json` + `lint --json` internally. Bundles findings
 *      with sampled entity/topic bodies (so Sonnet has context to judge).
 *      Writes `.curation-prompts/curation-proposal-prompt.md`.
 *
 *   2. Finalize (--finalize <response.json>):
 *      Reads Sonnet's structured JSON proposals. Renders a human-reviewable
 *      `00_Meta/curation-queue.md` with one section per proposal (checkbox +
 *      rationale + command). Operator reviews + ticks approved items.
 *
 *   3. (No mode for direct apply — that's `hirono apply-queue`. Splitting
 *      review from apply keeps the operator in the loop per Karpathy.)
 *
 * Proposal kinds Sonnet may emit:
 *   - merge-entities (duplicate pair → target)
 *   - merge-topics
 *   - rename-entity
 *   - delete-orphan
 *   - refine-entity
 *   - refine-topic
 *   - skip (finding is a false positive)
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PROPOSE_CURATION_PREAMBLE } from "./_shared/prompt-preamble.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..");

interface ParsedArgs {
  finalizePath: string | null;
}

function usage(): never {
  console.error(`usage: hirono propose-curation [--finalize <response.json>]

Tier-2 LLM-judgment-driven curation: detect → propose → review → apply.

Modes:
  (no flags)
    Runs health-check + lint internally. Writes prompt package to
    .curation-prompts/curation-proposal-prompt.md.
    Operator spawns Opus subagent in Claude session (judgment quality matters
    here — see CLAUDE.md §11 / memory feedback_model_choice_opus_vs_sonnet.md),
    saves response to
    .curation-prompts/curation-proposal-response.json.

  --finalize <path>
    Reads Sonnet's response JSON. Renders 00_Meta/curation-queue.md (operator-
    reviewable with checkboxes). Operator ticks approved items, then:

      hirono apply-queue        # dispatches approved items to atomic CLIs
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  let finalizePath: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--finalize") { i++; finalizePath = (argv[i] ?? "").trim() || null; }
    else if (a === "--help" || a === "-h") usage();
    else { console.error(`unknown arg: ${a}`); usage(); }
  }
  return { finalizePath };
}

// ---------------------------------------------------------------------------
// Mode 1: prepare prompt package
// ---------------------------------------------------------------------------

interface HealthAudit {
  orphans?: { slug: string; path: string }[];
  stale?: { slug: string; synthesisDate: string | null; newestCitingSource: { slug: string; updated: string } }[];
  duplicates?: { a: string; b: string; aPath: string; bPath: string; similarity: number; combinedRefs: number }[];
  collisions?: { a: string; b: string }[];
  contradictions?: { slug: string; quote: string; sourceSlug: string }[];
}

function runHealthCheck(repoRoot: string): HealthAudit {
  const result = spawnSync("npx", ["tsx", "tools/bin/hirono.ts", "health-check", "--json"], {
    cwd: repoRoot, encoding: "utf8",
  });
  try { return JSON.parse(result.stdout); }
  catch { return {}; }
}

interface LintIssue { kind: string; severity: string; path: string; detail: string; hint?: string }

function runLint(repoRoot: string): LintIssue[] {
  const result = spawnSync("npx", ["tsx", "tools/bin/lint.ts", "--json"], {
    cwd: repoRoot, encoding: "utf8",
  });
  const out: LintIssue[] = [];
  for (const line of result.stdout.split("\n")) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip */ }
  }
  return out;
}

function readFileSafe(p: string, maxLen = 4000): string {
  try {
    const raw = readFileSync(p, "utf8");
    return raw.length > maxLen ? raw.slice(0, maxLen) + "\n... [truncated]" : raw;
  } catch { return "_(file not readable)_"; }
}

function buildPromptPackage(repoRoot: string, health: HealthAudit, lintIssues: LintIssue[]): string {
  // Layout: STABLE preamble FIRST (caches across all propose-curation runs).
  // Per-run findings LAST. See _shared/prompt-preamble.ts.
  const lines: string[] = [
    PROPOSE_CURATION_PREAMBLE,
    "",
    `Save to: \`.curation-prompts/curation-proposal-response.json\``,
    "",
    `---`,
    "",
    `## Health-check findings`,
    "",
  ];

  // Orphans
  if (health.orphans?.length) {
    lines.push(`### Orphans (\`_seen/\` at refs=0): ${health.orphans.length}`, "");
    for (const o of health.orphans.slice(0, 30)) lines.push(`- \`${o.slug}\` (${o.path})`);
    if (health.orphans.length > 30) lines.push(`  ...and ${health.orphans.length - 30} more.`);
    lines.push("");
  }

  // Duplicate pairs — sample body of each
  if (health.duplicates?.length) {
    lines.push(`### Duplicate-pair candidates: ${health.duplicates.length}`, "");
    for (const d of health.duplicates.slice(0, 15)) {
      const aBody = readFileSafe(join(repoRoot, d.aPath), 800);
      const bBody = readFileSafe(join(repoRoot, d.bPath), 800);
      lines.push(`#### \`${d.a}\` ↔ \`${d.b}\` (similarity ${(d.similarity * 100).toFixed(0)}%, combined refs ${d.combinedRefs})`, "");
      lines.push(`**${d.a}** (\`${d.aPath}\`):`);
      lines.push("```", aBody, "```", "");
      lines.push(`**${d.b}** (\`${d.bPath}\`):`);
      lines.push("```", bBody, "```", "");
    }
    lines.push("");
  }

  // Stale Synthesis
  if (health.stale?.length) {
    lines.push(`### Stale Synthesis (active entity older than newest citing Source): ${health.stale.length}`, "");
    for (const s of health.stale) {
      lines.push(`- \`${s.slug}\` — Synthesis ${s.synthesisDate}; newest Source \`${s.newestCitingSource.slug}\` (${s.newestCitingSource.updated})`);
    }
    lines.push("");
  }

  // Topic collisions
  if (health.collisions?.length) {
    lines.push(`### Topic-name collisions: ${health.collisions.length}`, "");
    for (const c of health.collisions) lines.push(`- \`${c.a}\` ↔ \`${c.b}\``);
    lines.push("");
  }

  // Contradiction candidates
  if (health.contradictions?.length) {
    lines.push(`### Observation–Synthesis contradiction candidates: ${health.contradictions.length}`, "");
    for (const c of health.contradictions) {
      lines.push(`- \`${c.slug}\` — Observation cites: "${c.quote}..." (source \`${c.sourceSlug}\`)`);
    }
    lines.push("");
  }

  // Significant lint warnings/errors
  const sigKinds = new Set(["dead-wikilinks", "tier-mismatch", "tag-vocabulary", "topic-content-gaps"]);
  const sig = lintIssues.filter(i => sigKinds.has(i.kind));
  if (sig.length) {
    lines.push(`### Lint findings (selected): ${sig.length}`, "");
    for (const i of sig.slice(0, 30)) lines.push(`- [${i.severity}] ${i.kind} — ${i.path}: ${i.detail}`);
    lines.push("");
  }

  // Comparison-opportunity suggestions — surfaced separately because they
  // need Sonnet judgment (mechanical heuristic flags candidates; only some
  // are real). Propose `add-comparison-heading` for load-bearing contrasts,
  // `skip` for incidental mentions.
  const compOps = lintIssues.filter(i => i.kind === "comparison-opportunity");
  if (compOps.length) {
    lines.push(`### Comparison opportunities (heuristic — judge each): ${compOps.length}`, "");
    for (const i of compOps) lines.push(`- ${i.path}: ${i.detail}`);
    lines.push("");
  }

  lines.push(`---`, "");
  lines.push(`Now output the JSON proposals. Skip false positives. For genuine fixes, name the atomic-CLI verb + args + confidence + a one-line rationale.`);
  return lines.join("\n");
}

function preparePrompt(repoRoot: string): { promptPath: string; findingCount: number } {
  const health = runHealthCheck(repoRoot);
  const lintIssues = runLint(repoRoot);
  const findingCount =
    (health.orphans?.length ?? 0) + (health.stale?.length ?? 0) +
    (health.duplicates?.length ?? 0) + (health.collisions?.length ?? 0) +
    (health.contradictions?.length ?? 0) +
    lintIssues.filter(i => ["dead-wikilinks", "tier-mismatch", "tag-vocabulary"].includes(i.kind)).length;
  const prompt = buildPromptPackage(repoRoot, health, lintIssues);
  const promptDir = join(repoRoot, ".curation-prompts");
  mkdirSync(promptDir, { recursive: true });
  const promptPath = ".curation-prompts/curation-proposal-prompt.md";
  writeFileSync(join(repoRoot, promptPath), prompt, "utf8");
  return { promptPath, findingCount };
}

// ---------------------------------------------------------------------------
// Mode 2: finalize — render 00_Meta/curation-queue.md from Sonnet's JSON
// ---------------------------------------------------------------------------

interface Proposal {
  kind: "merge-entities" | "merge-topics" | "rename-entity" | "delete-orphan" | "refine-entity" | "refine-topic" | "refine-synthesis" | "add-comparison-heading" | "skip";
  args: Record<string, string>;
  confidence: "high" | "medium" | "low";
  rationale: string;
}

function renderQueueMarkdown(proposals: Proposal[]): string {
  const dateISO = new Date().toISOString().slice(0, 10);
  const actionable = proposals.filter(p => p.kind !== "skip");
  const skipped = proposals.filter(p => p.kind === "skip");

  const lines: string[] = [
    `---`,
    `created: ${dateISO}`,
    `updated: ${dateISO}`,
    `type: meta`,
    `generated_by: hirono propose-curation`,
    `status: pending-review`,
    `---`,
    "",
    `# Curation Queue — ${dateISO}`,
    "",
    `Generated by \`hirono propose-curation\`. Review each proposal: tick \`[x]\` to approve, leave \`[ ]\` to skip. Items NOT ticked are ignored by \`hirono apply-queue\`.`,
    "",
    `**To execute approved items**:`,
    "",
    `\`\`\``,
    `npx tsx tools/bin/hirono.ts apply-queue`,
    `\`\`\``,
    "",
    `Or auto-apply only high-confidence items:`,
    "",
    `\`\`\``,
    `npx tsx tools/bin/hirono.ts apply-queue --auto-apply high`,
    `\`\`\``,
    "",
    `## Proposals (${actionable.length} actionable, ${skipped.length} skipped)`,
    "",
  ];

  let idx = 1;
  for (const p of actionable) {
    const cmd = renderCommand(p);
    lines.push(`### ${idx}. ${proposalHeading(p)}  [confidence: ${p.confidence}]`, "");
    lines.push(`- [ ] approved`);
    lines.push("");
    lines.push(`**Rationale**: ${p.rationale}`);
    lines.push("");
    lines.push("```");
    lines.push(cmd);
    lines.push("```");
    lines.push("");
    idx++;
  }

  if (skipped.length) {
    lines.push(`## Skipped (Sonnet judged these to be false positives)`, "");
    for (const s of skipped) lines.push(`- ${s.args.finding ?? "(unspecified)"} — ${s.rationale}`);
    lines.push("");
  }

  return lines.join("\n");
}

function proposalHeading(p: Proposal): string {
  switch (p.kind) {
    case "merge-entities": return `Merge \`${p.args.source}\` → \`${p.args.target}\``;
    case "merge-topics":   return `Merge Topic \`${p.args.source}\` → \`${p.args.target}\``;
    case "rename-entity":  return `Rename \`${p.args.old}\` → \`${p.args.new}\``;
    case "delete-orphan":  return `Delete orphan \`${p.args.slug}\``;
    case "refine-entity":  return `Refine Entity \`${p.args.name}\` Synthesis`;
    case "refine-topic":   return `Refine Topic \`${p.args.name}\` Current understanding`;
    case "refine-synthesis": return `Refine top-level Synthesis.md (corpus-wide thesis)`;
    case "add-comparison-heading": return `Add \`## Comparison\` heading to Topic \`${p.args.name}\``;
    case "skip":           return `Skip: ${p.args.finding}`;
  }
}

function renderCommand(p: Proposal): string {
  const q = (s: string) => s.includes(" ") ? `"${s}"` : s;
  switch (p.kind) {
    case "merge-entities":
      return `hirono merge-entities ${q(p.args.source)} --into ${q(p.args.target)} --reason ${q(p.args.reason ?? p.rationale)}`;
    case "merge-topics":
      return `hirono merge-topics ${q(p.args.source)} --into ${q(p.args.target)} --reason ${q(p.args.reason ?? p.rationale)}`;
    case "rename-entity":
      return `hirono rename-entity ${q(p.args.old)} ${q(p.args.new)} --reason ${q(p.args.reason ?? p.rationale)}`;
    case "delete-orphan":
      return `hirono bulk-delete-orphans --confirm ${q(p.args.slug)}`;
    case "refine-entity":
      return `hirono refine-entity ${q(p.args.name)}    # → prompt; operator spawns Sonnet → apply`;
    case "refine-topic":
      return `hirono refine-topic ${q(p.args.name)}     # → prompt; operator spawns Sonnet → apply`;
    case "refine-synthesis":
      return `hirono refine-synthesis                   # → prompt; operator spawns Sonnet → apply`;
    case "add-comparison-heading":
      return `hirono add-comparison-heading ${q(p.args.name)} --reason ${q(p.args.reason ?? p.rationale)}`;
    case "skip":
      return `# (no action — skipped)`;
  }
}

function finalizeQueue(repoRoot: string, responsePath: string): { queuePath: string; proposalCount: number } {
  const respAbs = resolve(responsePath);
  let parsed: { proposals?: Proposal[] };
  try { parsed = JSON.parse(readFileSync(respAbs, "utf8")); }
  catch (e) { throw new Error(`failed to read/parse response JSON at ${respAbs}: ${(e as Error).message}`); }
  const proposals = Array.isArray(parsed.proposals) ? parsed.proposals : [];
  const queueMd = renderQueueMarkdown(proposals);
  const queuePath = "00_Meta/curation-queue.md";
  writeFileSync(join(repoRoot, queuePath), queueMd, "utf8");
  return { queuePath, proposalCount: proposals.length };
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  try {
    if (args.finalizePath) {
      const r = finalizeQueue(REPO_ROOT_DEFAULT, args.finalizePath);
      console.log(`✓ wrote queue: ${r.queuePath} (${r.proposalCount} proposals)`);
      console.log(`\nNext steps:`);
      console.log(`  1. Open ${r.queuePath}; tick \`[x]\` to approve items, leave \`[ ]\` to skip.`);
      console.log(`  2. Run \`hirono apply-queue\` to execute approved items.`);
    } else {
      const r = preparePrompt(REPO_ROOT_DEFAULT);
      console.log(`✓ wrote prompt: ${r.promptPath}`);
      console.log(`  found ${r.findingCount} candidate items for Sonnet to judge.`);
      console.log(`\nNext steps:`);
      console.log(`  1. Spawn Opus subagent with this prompt (judgment quality matters; see CLAUDE.md §11).`);
      console.log(`  2. Save response to: .curation-prompts/curation-proposal-response.json`);
      console.log(`  3. Re-run: hirono propose-curation --finalize <path>`);
    }
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
