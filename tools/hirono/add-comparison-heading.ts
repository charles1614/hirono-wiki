/**
 * `hirono add-comparison-heading <name>` — atomic insertion of a
 * `## Comparison` heading into a Topic body.
 *
 * Opt-in primitive for the comparison sub-shape (00_Meta/schema.md §"Topic
 * sub-shapes"). After the heading is in place:
 *   - `comparison-table-missing` lint fires (table needed)
 *   - `hirono refine-topic <name>` switches to comparison-aware prompt
 *     and Sonnet populates the table from cited Sources
 *   - `auto-fix` picks both up via existing stale-topic prep machinery
 *
 * Surfaced as a Sonnet-judgeable proposal kind in `propose-curation`
 * (when `comparison-opportunity` lint flags a Topic). Operator approval
 * dispatches this CLI via apply-queue.
 *
 * Idempotent: if the Topic already has a `## Comparison` heading, exits 0
 * with a no-op message.
 *
 * Atomic: uses the same applyAtomically + log-entry machinery as
 * merge-entities, refine-entity, etc.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyAtomically,
  appendLogEntry,
  cleanupStaging,
  type PendingOp,
} from "../curation.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..");

interface ParsedArgs { name: string; reason: string }

function usage(): never {
  console.error(`usage: hirono add-comparison-heading <name> [--reason "<one-liner>"]

Insert a \`## Comparison\` heading into Topics/<name>.md (between
\`## Current understanding\` and \`## Open threads\`). The heading itself
is the contract — once present, the lint flags it as needing a table,
and \`hirono refine-topic <name>\` will populate the table on the next run.

Idempotent: no-op if the heading already exists.
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  let reason = "";
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--reason") { i++; reason = (argv[i] ?? "").trim(); }
    else if (a === "--help" || a === "-h") usage();
    else if (a.startsWith("-")) { console.error(`unknown flag: ${a}`); usage(); }
    else positional.push(a);
  }
  if (positional.length !== 1) usage();
  return { name: positional[0], reason };
}

export interface AddComparisonHeadingResult {
  topicPath: string;
  noop: boolean;
  opId?: string;
}

const STUB_BLOCK = `## Comparison

_(stub — run \`hirono refine-topic <name>\` to populate the axis × option table from cited Sources.)_

`;

export function addComparisonHeading(
  repoRoot: string,
  name: string,
  reason: string,
): AddComparisonHeadingResult {
  const topicPath = `01_Topics/${name}.md`;
  const abs = join(repoRoot, topicPath);
  if (!existsSync(abs)) throw new Error(`Topic not found: ${topicPath}`);
  const raw = readFileSync(abs, "utf8");

  // Idempotent check
  if (raw.split("\n").some(l => l.trim() === "## Comparison")) {
    return { topicPath, noop: true };
  }

  // Insertion point precedence: before ## Open threads, else before
  // ## Sources drawn on, else at end-of-body. Place a contextualised
  // stub `_(stub — run ... to populate)_` so the lint
  // `comparison-table-missing` fires (which is the desired signal —
  // operator runs refine-topic to fill in the table).
  const lines = raw.split("\n");
  const insertCandidates = ["## Open threads", "## Sources drawn on"];
  let insertAt = -1;
  for (const heading of insertCandidates) {
    const i = lines.findIndex(l => l.trim() === heading);
    if (i >= 0) { insertAt = i; break; }
  }
  if (insertAt < 0) insertAt = lines.length;

  // Customize the stub message with the actual Topic name
  const stub = STUB_BLOCK.replace("<name>", name);

  const before = lines.slice(0, insertAt).join("\n").replace(/\s+$/, "");
  const after = lines.slice(insertAt).join("\n");
  const newRaw = `${before}\n\n${stub}${after.startsWith("\n") ? "" : "\n"}${after}`.replace(/\n{3,}/g, "\n\n");

  const ops: PendingOp[] = [{ kind: "write", path: topicPath, body: newRaw }];
  const opId = `add-comparison-heading-${name.replace(/[^a-zA-Z0-9-]/g, "_")}-${Date.now()}`;
  applyAtomically(repoRoot, opId, ops);
  appendLogEntry(repoRoot, "refactor", `Add \`## Comparison\` heading to Topic [[${name}]]`, [
    reason ? `Reason: ${reason}` : `Inserted opt-in comparison stub.`,
    `Next: \`hirono refine-topic ${name}\` populates the axis × option table from cited Sources.`,
  ]);
  cleanupStaging(repoRoot, opId);
  return { topicPath, noop: false, opId };
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  try {
    const r = addComparisonHeading(REPO_ROOT_DEFAULT, args.name, args.reason);
    if (r.noop) {
      console.log(`◦ ${r.topicPath} already has \`## Comparison\` heading — no-op.`);
    } else {
      console.log(`✓ wrote \`## Comparison\` stub to ${r.topicPath}`);
      console.log(`  Next: \`hirono refine-topic ${args.name}\` populates the table.`);
    }
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
