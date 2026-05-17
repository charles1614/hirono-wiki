/**
 * `hirono new-topic <Name>` — scaffold a new Topic stub at
 * `01_Topics/<Name>.md` with the standard four-section schema skeleton.
 *
 * Topics differ from Entities: they're cross-cutting concepts / design
 * spaces / problem areas, not named things. No tier system; the page
 * just exists. Once `source_count ≥ 3`, the `topic-content-gaps` lint
 * check fires on stub `## What` / `## Current understanding` — the
 * LLM-editorial backfill prompt.
 *
 * The structural scaffolding (frontmatter, four required section
 * headings, placeholder text) is mechanical, so the LLM doesn't have
 * to remember it on every ingest.
 *
 * Exits non-zero if the target file already exists or the name contains
 * invalid characters.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const THIS_FILE = fileURLToPath(import.meta.url);
// hirono module → tools/ → wiki root
const REPO_ROOT = resolve(dirname(THIS_FILE), "..", "..");

interface ParsedArgs {
  name: string;
  what: string;
}

function usage(): never {
  console.error(`usage: hirono new-topic <Name> [--what "<one-line definition>"]

Creates Topics/<Name>.md with schema-conformant scaffolding (## What /
## Current understanding / ## Open threads / ## Sources drawn on).

Once source_count crosses 3, lint's topic-content-gaps check will warn
if ## What and ## Current understanding are still placeholders — that's
the LLM-editorial-backfill queue.

Examples:
  hirono new-topic "Inference Disaggregation"
  hirono new-topic "Low-Precision Training" --what "Pretraining in FP8 / FP4 etc."

Notes:
  - Names with spaces must be quoted (filenames preserve the space).
  - Use \`new-entity\` for named things (companies, products, models).
  - Use \`new-topic\` for cross-cutting concepts (design space, problem area).
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  let what = "";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--what" || a === "-w") {
      const v = argv[++i];
      if (typeof v !== "string") {
        console.error("error: --what requires a value");
        usage();
      }
      what = v;
    } else if (a === "--help" || a === "-h") {
      usage();
    } else if (a.startsWith("--")) {
      console.error(`error: unknown flag: ${a}`);
      usage();
    } else {
      positional.push(a);
    }
  }
  if (positional.length !== 1) {
    console.error(`error: expected exactly 1 positional <Name>, got ${positional.length}`);
    usage();
  }
  return { name: positional[0], what };
}

function validateName(name: string): void {
  if (name.length === 0) {
    throw new Error("name cannot be empty");
  }
  if (name.startsWith(".") || name.startsWith("_")) {
    throw new Error(`name cannot start with '.' or '_': ${name}`);
  }
  if (/[\/\\<>:"|?*\n\t]/.test(name)) {
    throw new Error(`name contains invalid characters: ${name}`);
  }
}

const TODAY = (): string => new Date().toISOString().slice(0, 10);

function renderTopicStub(name: string, what: string): string {
  const whatBody = what.trim().length > 0
    ? what.trim()
    : "_(one-line definition: what the cross-cutting concept is, why it warrants a page — replace with prose. Until then, the `topic-content-gaps` lint check will fire once source_count crosses 3.)_";
  return `---
created: ${TODAY()}
updated: ${TODAY()}
type: topic
source_count: 0
---

# ${name}

## What

${whatBody}

## Current understanding

_(stub — populate as sources accumulate. \`topic-content-gaps\` will lint-warn once source_count ≥ 3.)_

## Open threads

## Sources drawn on

_(populated as Sources wikilink this Topic; cite each with one-line relevance.)_
`;
}

/**
 * Pure function: create the stub at `<repoRoot>/Topics/<name>.md`.
 * Throws on invalid name / existing file. Used by both the CLI and tests.
 */
export function createTopicStub(repoRoot: string, name: string, what: string): string {
  validateName(name);
  const dir = join(repoRoot, "01_Topics");
  const path = join(dir, `${name}.md`);
  if (existsSync(path)) {
    throw new Error(`${path} already exists`);
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, renderTopicStub(name, what));
  return path;
}

export function main(argv: string[]): void {
  const { name, what } = parseArgs(argv);
  try {
    const path = createTopicStub(REPO_ROOT, name, what);
    process.stdout.write(`created: ${path.slice(REPO_ROOT.length + 1)}\n`);
    process.stdout.write(`next: write ## Current understanding as sources accumulate\n`);
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}

const isEntryPoint =
  process.argv[1] !== undefined && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
