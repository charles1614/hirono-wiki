/**
 * `hirono new-entity <Name>` — scaffold a new Entity stub at
 * `Entities/_seen/<Name>.md` with schema-conformant frontmatter and
 * the standard `## Synthesis` / `## Observations` skeleton.
 *
 * The LLM still makes two judgment calls per new entity:
 *   1. Entity vs Topic (this CLI assumes Entity — use `new-topic` for the
 *      other branch).
 *   2. The one-line "kind" descriptor (passed via `--kind` / `-k`, or
 *      filled in via Edit later).
 *
 * The structural scaffolding (frontmatter shape, dates, `tier: seen`,
 * `refs: 0`, the two required section headings) is mechanical, so the
 * LLM doesn't have to remember it on every ingest.
 *
 * On-disk layout: new entities go to seen tier by default. `reindex.ts`
 * auto-promotes to `Entities/<Name>.md` once incoming refs cross 3.
 *
 * Exits non-zero if the target file already exists, the name contains
 * invalid characters, or the wiki root can't be found.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const THIS_FILE = fileURLToPath(import.meta.url);
// hirono module → tools/ → wiki root
const REPO_ROOT = resolve(dirname(THIS_FILE), "..", "..");

interface ParsedArgs {
  name: string;
  kind: string;
}

function usage(): never {
  console.error(`usage: hirono new-entity <Name> [--kind "<one-line description>"]

Creates Entities/_seen/<Name>.md with schema-conformant scaffolding.
The new entity starts at seen tier (refs=0); reindex.ts auto-promotes
to active when incoming references cross 3.

Examples:
  hirono new-entity FlashAttention-3
  hirono new-entity "Transformer Engine" --kind "NVIDIA's FP8-on-Hopper library"

Notes:
  - Names with spaces must be quoted.
  - Use \`new-topic\` for cross-cutting concepts (design space, problem area).
  - Use \`new-entity\` for named things (companies, products, models, hardware).
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  let kind = "";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--kind" || a === "-k") {
      const v = argv[++i];
      if (typeof v !== "string") {
        console.error("error: --kind requires a value");
        usage();
      }
      kind = v;
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
  return { name: positional[0], kind };
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

function renderEntityStub(name: string, kind: string): string {
  const kindLine = kind.trim().length > 0
    ? kind.trim()
    : "_(one-line kind: what is this thing — replace with prose)_";
  return `---
created: ${TODAY()}
updated: ${TODAY()}
type: entity
refs: 0
tier: seen
---

# ${name}

${kindLine}

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- _(append cited bullets here as Sources reference this entity — one atomic claim per bullet, cited with [[Sources/<slug>]])_
`;
}

/**
 * Pure function: create the stub at `<repoRoot>/Entities/_seen/<name>.md`.
 * Throws on invalid name / existing file. Used by both the CLI (which
 * passes the auto-detected REPO_ROOT) and the tests (which pass a tmp dir).
 */
export function createEntityStub(repoRoot: string, name: string, kind: string): string {
  validateName(name);
  const dir = join(repoRoot, "Entities", "_seen");
  const path = join(dir, `${name}.md`);
  const activePath = join(repoRoot, "Entities", `${name}.md`);
  if (existsSync(path)) {
    throw new Error(`${path} already exists`);
  }
  if (existsSync(activePath)) {
    throw new Error(`${activePath} already exists (active tier — use Edit if you want to update it)`);
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, renderEntityStub(name, kind));
  return path;
}

export function main(argv: string[]): void {
  const { name, kind } = parseArgs(argv);
  try {
    const path = createEntityStub(REPO_ROOT, name, kind);
    process.stdout.write(`created: ${path.slice(REPO_ROOT.length + 1)}\n`);
    process.stdout.write(`next: write Observations as Sources reference this entity\n`);
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}

const isEntryPoint =
  process.argv[1] !== undefined && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
