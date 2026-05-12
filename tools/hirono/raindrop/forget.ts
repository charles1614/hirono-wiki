/**
 * `hirono raindrop forget <slug-or-url>` — combined accident cleanup.
 *
 * Composes delete-source + skip-list registration. Handles three local
 * states atomically (single audit-trail entry per call):
 *
 *   1. Source + raw archive both exist → deleteSource (Source.md + raw)
 *      + add URL to skip-list.
 *   2. Raw archive only, no Source (HSBC-style: errored at ingest) →
 *      delete raw dir + add URL to skip-list.
 *   3. Neither local artifact (URL is in `.wiki-raindrop-cache.json` only) →
 *      add URL to skip-list only.
 *
 * Raindrop bookmark stays upstream (we don't have write API); skip-list
 * permanently shields against re-fetch / re-ingest regardless. To un-skip
 * later: delete the line from `Meta/sources-ingest-skips.md`.
 *
 * NOT a default path. The Karpathy-aligned default for any URL in raw is
 * to ingest it (and run auto-detect-entities to grow the graph). Use
 * `forget` only for genuine bookmark accidents the operator wants
 * permanently excluded.
 */

import { existsSync, readdirSync, readFileSync, rmSync, mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { appendLogEntry } from "../../curation.ts";
import { deleteSource } from "../delete-source.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..", "..");

interface ParsedArgs {
  target: string;
  reason: string;
  skipReason: string;
  force: boolean;
}

function usage(): never {
  console.error(`usage: hirono raindrop forget <slug-or-url> [--reason "<text>"] [--skip-reason <kind>] [--force]

Composed accident cleanup: removes local artifacts (Source + raw archive)
AND adds the URL to Meta/sources-ingest-skips.md so future ingests skip it.

Args:
  <slug-or-url>           Either a slug (2026-04-23-foo) or a full URL.
                          The CLI infers which from format.

Flags:
  --reason "<text>"       Free-text rationale (logged + appended to skip-list).
  --skip-reason <kind>    One of: spam | duplicate | deprecated |
                          bookmarked-by-mistake | other (default: bookmarked-by-mistake).
  --force                 Override delete-source's dangling-wikilink guard.

Examples:
  hirono raindrop forget 2026-04-23-hsbc-banking \\
    --reason "Off-topic; bookmarked by mistake"
  hirono raindrop forget https://spam.example.com/x \\
    --skip-reason spam --reason "Recurring spam URL"

NOT the default cleanup path. Use only for accidents.
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  let reason = "";
  let skipReason = "bookmarked-by-mistake";
  let force = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--reason" || a === "-r") { i++; reason = (argv[i] ?? "").trim(); }
    else if (a === "--skip-reason") { i++; skipReason = (argv[i] ?? "").trim(); }
    else if (a === "--force") force = true;
    else if (a === "--help" || a === "-h") usage();
    else if (a.startsWith("-")) { console.error(`unknown flag: ${a}`); usage(); }
    else positional.push(a);
  }
  if (positional.length !== 1) usage();
  const VALID_SKIP_REASONS = ["spam", "duplicate", "deprecated", "bookmarked-by-mistake", "other"];
  if (!VALID_SKIP_REASONS.includes(skipReason)) {
    console.error(`invalid --skip-reason: ${skipReason}. Use one of: ${VALID_SKIP_REASONS.join(", ")}`);
    usage();
  }
  return { target: positional[0], reason, skipReason, force };
}

function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

/** Walk raw archives; return slug + URL pairs. */
function listRawSlugUrls(repoRoot: string): Array<{ slug: string; host: string; url: string | null; rawDir: string }> {
  const rawRoot = join(repoRoot, "raw", "raindrop");
  const out: Array<{ slug: string; host: string; url: string | null; rawDir: string }> = [];
  if (!existsSync(rawRoot)) return out;
  for (const host of readdirSync(rawRoot)) {
    if (host.startsWith(".") || host.startsWith("_")) continue;
    const hostDir = join(rawRoot, host);
    let entries: string[];
    try { entries = readdirSync(hostDir); } catch { continue; }
    for (const slug of entries) {
      const rawDir = join("raw", "raindrop", host, slug);
      const sourceJsonPath = join(repoRoot, rawDir, "source.json");
      let url: string | null = null;
      try {
        const sj = JSON.parse(readFileSync(sourceJsonPath, "utf8"));
        if (typeof sj.origin_url === "string") url = sj.origin_url;
        else if (typeof sj.url === "string") url = sj.url;
      } catch { /* ignore */ }
      out.push({ slug, host, url, rawDir });
    }
  }
  return out;
}

function findSourcePath(repoRoot: string, slug: string): string | null {
  const sourcesDir = join(repoRoot, "Sources");
  if (!existsSync(sourcesDir)) return null;
  for (const year of readdirSync(sourcesDir)) {
    if (!/^\d{4}$/.test(year)) continue;
    const p = `Sources/${year}/${slug}.md`;
    if (existsSync(join(repoRoot, p))) return p;
  }
  return null;
}

/** Append an entry to Meta/sources-ingest-skips.md (under the "## Entries" section). */
function appendSkipEntry(repoRoot: string, key: string, skipReason: string, rationale: string): void {
  const path = join(repoRoot, "Meta", "sources-ingest-skips.md");
  mkdirSync(dirname(path), { recursive: true });
  let content: string;
  if (existsSync(path)) {
    content = readFileSync(path, "utf8");
  } else {
    content = `---\ncreated: ${new Date().toISOString().slice(0, 10)}\nupdated: ${new Date().toISOString().slice(0, 10)}\ntype: meta\n---\n\n# Sources ingest skip-list\n\n## Entries\n\n`;
  }
  const line = `- ${key} — skip-reason=${skipReason}${rationale ? ` · ${rationale}` : ""}\n`;
  // Insert under `## Entries`; create the section if missing
  if (/^## Entries\s*$/m.test(content)) {
    content = content.replace(/^## Entries\s*$/m, `## Entries\n\n${line}`);
    // De-duplicate consecutive blank lines we may have introduced
    content = content.replace(/(## Entries\n)\n\n+/, "$1\n");
  } else {
    content += `\n## Entries\n\n${line}`;
  }
  writeFileSync(path, content, "utf8");
}

export interface ForgetResult {
  branch: "source-and-raw" | "raw-only" | "neither";
  slug: string | null;
  url: string | null;
  sourcePath: string | null;
  rawDir: string | null;
  rawDeleted: boolean;
  skipKey: string;
}

export function forget(
  repoRoot: string,
  target: string,
  opts: { reason?: string; skipReason?: string; force?: boolean } = {},
): ForgetResult {
  const skipReason = opts.skipReason ?? "bookmarked-by-mistake";
  // Resolve slug + URL
  let slug: string | null = null;
  let url: string | null = null;
  const rawSlugs = listRawSlugUrls(repoRoot);

  if (isUrl(target)) {
    url = target;
    const match = rawSlugs.find(r => r.url?.toLowerCase() === target.toLowerCase());
    if (match) slug = match.slug;
  } else {
    slug = target;
    const match = rawSlugs.find(r => r.slug === target);
    if (match) url = match.url;
  }

  const sourcePath = slug ? findSourcePath(repoRoot, slug) : null;
  const rawEntry = slug ? rawSlugs.find(r => r.slug === slug) : null;

  let branch: ForgetResult["branch"];
  let rawDir: string | null = rawEntry?.rawDir ?? null;
  let rawDeleted = false;

  // Branch 1: Source + raw both exist
  if (sourcePath && rawDir) {
    const r = deleteSource(repoRoot, slug!, { force: opts.force, reason: opts.reason });
    rawDeleted = r.rawDeleted;
    branch = "source-and-raw";
  }
  // Branch 2: Raw only, no Source
  else if (rawDir && !sourcePath) {
    try {
      rmSync(join(repoRoot, rawDir), { recursive: true, force: true });
      rawDeleted = true;
    } catch (e) {
      console.error(`[forget] warning: raw archive deletion failed: ${(e as Error).message}`);
    }
    branch = "raw-only";
  }
  // Branch 3: Neither — URL is only in raindrop cache
  else {
    branch = "neither";
  }

  // Always add to skip-list (with URL preferred over slug for portability)
  const skipKey = url ?? slug ?? target;
  appendSkipEntry(repoRoot, skipKey, skipReason, opts.reason ?? "");

  // Single log entry summarizing the cleanup
  if (branch !== "source-and-raw") {
    // delete-source already wrote a log entry for "source-and-raw"; for the other
    // two branches we need our own.
    const bodyLines = [
      `Branch: **${branch}** (${branch === "raw-only" ? "raw archive only, no Source" : "no local artifacts"}).`,
      rawDir ? (rawDeleted ? `Raw archive removed: ${rawDir}` : `Raw archive present but not deleted.`) : `No raw archive found.`,
      `Added to skip-list: \`${skipKey}\` (skip-reason=${skipReason}).`,
      opts.reason ? `Reason: ${opts.reason}` : `Reason: not specified.`,
    ];
    appendLogEntry(repoRoot, "refactor", `raindrop forget ${slug ?? target}`, bodyLines);
  } else {
    // delete-source wrote the log; append a "skip-list added" note via another log entry?
    // Better: just emit a second log entry noting skip-list registration.
    appendLogEntry(repoRoot, "refactor", `Added \`${skipKey}\` to ingest skip-list`, [
      `Skip-reason: ${skipReason}.`,
      opts.reason ? `Rationale: ${opts.reason}` : `(no rationale provided)`,
      `To un-skip: delete the line from Meta/sources-ingest-skips.md.`,
    ]);
  }

  return { branch, slug, url, sourcePath, rawDir, rawDeleted, skipKey };
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  try {
    const r = forget(REPO_ROOT_DEFAULT, args.target, {
      reason: args.reason, skipReason: args.skipReason, force: args.force,
    });
    console.log(`✓ branch: ${r.branch}`);
    if (r.sourcePath) console.log(`  deleted Source: ${r.sourcePath}`);
    if (r.rawDir) console.log(`  ${r.rawDeleted ? "deleted" : "kept"} raw archive: ${r.rawDir}`);
    console.log(`✓ added to skip-list: ${r.skipKey} (skip-reason=${args.skipReason})`);
    console.log(`\nNext: skip-list permanently shields against re-fetch/re-ingest.`);
    console.log(`To un-skip later: delete the line from Meta/sources-ingest-skips.md.`);
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
