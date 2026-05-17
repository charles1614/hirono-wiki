/**
 * `excerptSource` — read a 03_Sources/YYYY/<slug>.md and return only the
 * curated sections (TL;DR, Key claims, What this changes, plus the
 * Entities/Topics-touched cross-link blocks).
 *
 * Why: refine-entity / refine-topic / auto-detect-entities currently
 * inline the FULL Source body (raw markdown, often 5–15 KB) into Sonnet
 * prompts. But Source pages already carry curated LLM-distilled summaries —
 * `## Key claims` is the load-bearing content for downstream refines.
 * Re-reading the raw archive is asking the LLM to re-distill what's
 * already distilled.
 *
 * Excerpted mode (default for refines): include
 *   - `## TL;DR`
 *   - `## Key claims`
 *   - `## What this changes` (when present)
 *   - `## Entities touched` (so the LLM sees existing wikilink targets)
 *   - `## Topics touched`
 * Drops:
 *   - Visual observations (image refs — not useful in prompts)
 *   - Raw source (provenance footer, not content)
 *   - Frontmatter (passed separately if needed)
 *
 * Full mode: returns the entire body for cases where Source curation is
 * suspect (escape hatch).
 *
 * Estimated savings: Source bodies typically 5–15 KB → excerpts 1.5–3 KB
 * (60–80% reduction per cited Source).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type ExcerptMode = "curated" | "full";

const CURATED_SECTIONS = [
  "## TL;DR",
  "## Key claims",
  "## What this changes",
  "## Entities touched",
  "## Topics touched",
];

function stripFrontmatter(raw: string): string {
  const m = raw.match(/^---\n[\s\S]*?\n---\n/);
  return m ? raw.slice(m[0].length) : raw;
}

function extractNamedSections(body: string, names: string[]): { name: string; content: string }[] {
  const lines = body.split("\n");
  const out: { name: string; content: string }[] = [];
  for (const name of names) {
    const start = lines.findIndex(l => l.trim() === name);
    if (start < 0) continue;
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      if (/^#{1,2}\s/.test(lines[i])) { end = i; break; }
    }
    const content = lines.slice(start + 1, end).join("\n").trim();
    if (content) out.push({ name, content });
  }
  return out;
}

/**
 * Read a Source's curated excerpt (default) or full body.
 *
 * Returns the markdown content (without frontmatter, without the page H1).
 * If the Source can't be found or has no curated sections, returns null
 * (caller decides whether to fall back to full or skip).
 */
export function excerptSource(repoRoot: string, sourcePath: string, mode: ExcerptMode = "curated"): string | null {
  const abs = join(repoRoot, sourcePath);
  if (!existsSync(abs)) return null;
  let raw: string;
  try { raw = readFileSync(abs, "utf8"); }
  catch { return null; }
  const body = stripFrontmatter(raw);

  if (mode === "full") return body;

  const sections = extractNamedSections(body, CURATED_SECTIONS);
  if (sections.length === 0) {
    // No curated sections — fall back to full so we don't return empty
    // (callers expect content; an empty excerpt would silently degrade
    // refine quality).
    return body;
  }

  return sections.map(s => `${s.name}\n\n${s.content}`).join("\n\n");
}

/**
 * Resolve a Source slug to its repo-relative path. Searches 03_Sources/YYYY/.
 * Returns null if not found.
 */
export function resolveSourceSlug(repoRoot: string, slug: string): string | null {
  const fs = require("node:fs") as typeof import("node:fs");
  const sourcesDir = join(repoRoot, "03_Sources");
  if (!fs.existsSync(sourcesDir)) return null;
  for (const year of fs.readdirSync(sourcesDir)) {
    if (!/^\d{4}$/.test(year)) continue;
    const candidate = `03_Sources/${year}/${slug}.md`;
    if (fs.existsSync(join(repoRoot, candidate))) return candidate;
  }
  return null;
}
