#!/usr/bin/env node
/**
 * backfill-synthesis-date.ts — one-time script.
 *
 * Walks active-tier entities (`02_Entities/*.md`, excluding `_seen/`). For each
 * one with a non-stub `## Synthesis`, sets `synthesis_updated_at: <today>`
 * in the frontmatter (preserving existing field values + ordering).
 *
 * Idempotent: re-running does nothing on entities that already have the
 * field set.
 *
 *   npx tsx tools/bin/backfill-synthesis-date.ts [--dry-run]
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..", "..");

const SYNTHESIS_STUB_RE = /^\s*(\*Regenerated from Observations|\*Stub|\*Synthesis pending|\(to be filled in\))/im;

function main(): void {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const today = new Date().toISOString().slice(0, 10);

  const entitiesDir = join(REPO_ROOT, "02_Entities");
  const files = readdirSync(entitiesDir).filter((f) => f.endsWith(".md"));
  let touched = 0;
  let skipped = 0;
  let alreadySet = 0;

  for (const file of files) {
    const path = join(entitiesDir, file);
    const raw = readFileSync(path, "utf8");
    const parsed = matter(raw);
    if (parsed.data.synthesis_updated_at) {
      alreadySet++;
      continue;
    }
    const synthMatch = parsed.content.match(/^## Synthesis\s*$([\s\S]*?)(?=^## |\Z)/m);
    if (!synthMatch || SYNTHESIS_STUB_RE.test(synthMatch[1])) {
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`[dry-run] would set synthesis_updated_at: ${today} on ${file}`);
      touched++;
      continue;
    }
    // Insert `synthesis_updated_at: <today>` into frontmatter.
    // Place after `updated:` to keep frontmatter readable.
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n/);
    if (!fmMatch) {
      skipped++;
      continue;
    }
    const fmInner = fmMatch[1];
    let newFmInner: string;
    if (/^updated:\s*\S+\s*$/m.test(fmInner)) {
      newFmInner = fmInner.replace(/^(updated:\s*\S+\s*)$/m, `$1\nsynthesis_updated_at: ${today}`);
    } else {
      newFmInner = fmInner + `\nsynthesis_updated_at: ${today}`;
    }
    const newRaw = `---\n${newFmInner}\n---\n` + raw.slice(fmMatch[0].length);
    writeFileSync(path, newRaw, "utf8");
    touched++;
  }

  console.log(`${dryRun ? "[dry-run] " : ""}backfill complete:`);
  console.log(`  touched:      ${touched}`);
  console.log(`  already set:  ${alreadySet}`);
  console.log(`  skipped:      ${skipped}  (stub Synthesis or no frontmatter)`);
}

const isEntry = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntry) main();
