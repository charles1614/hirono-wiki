/**
 * `hirono raindrop raw-prune` — explicit deletion of raw files locally + R2.
 *
 * This is the ONLY path that removes files from R2. Sync code never
 * infers deletion; only `raw-prune` (which appends to the disposition
 * log) tells future syncs that an R2 object should stay gone.
 *
 * Usage:
 *   raw-prune <slug> --file <name> --reason "..."
 *   raw-prune <slug> --pattern '*avatar*' --reason "..."
 *   raw-prune <slug> --pattern '*' --reason "stub-only"   # whole slug
 *   raw-prune --revert <slug>/<file>                      # undo disposition
 *   raw-prune --dry-run <slug> --pattern '...'            # preview
 *   raw-prune <slug> --pattern '*.png' --no-local         # remove from R2 only
 */
import {
  existsSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

import {
  getR2Bucket,
  getR2Client,
  assertR2Configured,
} from "../../shared/r2-client.ts";
import {
  appendDispositionRow,
  readDisposition,
  type DispositionRow,
} from "../../shared/r2-disposition.ts";
import { r2KeyFor } from "../../shared/r2-uploader.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..", "..", "..");
const RAINDROP_DIR = join(REPO_ROOT, "raw", "raindrop");

interface Flags {
  slug?: string;
  file?: string;
  pattern?: string;
  reason?: string;
  revert?: string;
  dryRun: boolean;
  noLocal: boolean;
}

function parseFlags(argv: string[]): Flags {
  const f: Flags = { dryRun: false, noLocal: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--file": f.file = argv[++i]; break;
      case "--pattern": f.pattern = argv[++i]; break;
      case "--reason": f.reason = argv[++i]; break;
      case "--revert": f.revert = argv[++i]; break;
      case "--dry-run": f.dryRun = true; break;
      case "--no-local": f.noLocal = true; break;
      case "--help": case "-h":
        printHelp(); process.exit(0);
      default:
        if (a.startsWith("-")) throw new Error(`unknown flag: ${a}`);
        if (!f.slug) f.slug = a;
        else throw new Error(`unexpected positional arg: ${a}`);
    }
  }
  return f;
}

function printHelp(): void {
  console.log(`hirono raindrop raw-prune — delete raw files locally + R2 (provenance via disposition log)

  raw-prune <slug> --file <name> --reason "..."
  raw-prune <slug> --pattern '*avatar*' --reason "..."
  raw-prune --revert <slug>/<file>
  raw-prune <slug> --pattern '...' --dry-run

  --no-local: R2-only delete (keep local copy)
`);
}

function findSlugDir(slug: string): { host: string; dir: string } | null {
  if (!existsSync(RAINDROP_DIR)) return null;
  for (const host of readdirSync(RAINDROP_DIR)) {
    const hostDir = join(RAINDROP_DIR, host);
    try { if (!statSync(hostDir).isDirectory()) continue; } catch { continue; }
    const candidate = join(hostDir, slug);
    try {
      if (statSync(candidate).isDirectory()) return { host, dir: candidate };
    } catch { /* not here, keep looking */ }
  }
  return null;
}

function findHostForExistingDisposition(slug: string, disp: Map<string, DispositionRow>): string | null {
  for (const row of disp.values()) {
    if (row.slug === slug) return row.host;
  }
  return null;
}

function globToRegex(pat: string): RegExp {
  let s = "^";
  for (const ch of pat) {
    if (ch === "*") s += ".*";
    else if (ch === "?") s += ".";
    else if ("\\^$.+()[]{}|".includes(ch)) s += "\\" + ch;
    else s += ch;
  }
  return new RegExp(s + "$");
}

async function cmdRevert(spec: string): Promise<void> {
  const m = spec.match(/^([^/]+)\/(.+)$/);
  if (!m) throw new Error(`--revert expects "<slug>/<file>" — got ${spec}`);
  const [, slug, file] = m;
  const disp = readDisposition();
  const located = findSlugDir(slug);
  const host = located?.host ?? findHostForExistingDisposition(slug, disp);
  if (!host) throw new Error(`cannot determine host for slug ${slug}`);
  appendDispositionRow({
    slug, host, file, action: "keep", reason: "reverted",
    decided_at: new Date().toISOString(),
  });
  console.log(`[raw-prune --revert] ${slug}/${file} → action=keep (next raw-sync will re-upload if local present)`);
}

async function cmdPrune(f: Flags): Promise<void> {
  if (!f.slug) throw new Error("missing positional <slug>");
  if (!f.reason) throw new Error("--reason is required (provenance for future you)");
  if (!f.file && !f.pattern) throw new Error("provide --file or --pattern");

  const located = findSlugDir(f.slug);
  if (!located) throw new Error(`slug ${f.slug} not found under ${RAINDROP_DIR}`);
  const { host, dir } = located;

  const matchFn: (name: string) => boolean = f.file
    ? (n) => n === f.file
    : (n) => globToRegex(f.pattern!).test(n);

  const localNames = readdirSync(dir).filter(n => {
    try { return statSync(join(dir, n)).isFile(); } catch { return false; }
  });
  const matched = localNames.filter(matchFn);

  // Also pick up files that only exist in R2 (already locally rm'd, no
  // disposition row yet). We approach via prior ledger row, but the
  // current Map shape requires reading the ledger; minimal effort: trust
  // user to invoke from a state where files are still present locally.
  // For "only-in-R2" cases, operator uses --file explicitly with the name.

  if (matched.length === 0 && f.pattern) {
    console.log(`[raw-prune] no local files match pattern ${f.pattern} in ${f.slug}`);
  }
  if (f.file && !localNames.includes(f.file)) {
    console.warn(`[raw-prune] ${f.file} not present locally — will still record disposition + attempt R2 delete`);
    matched.push(f.file);
  }

  if (f.dryRun) {
    console.log(`[raw-prune --dry-run] ${f.slug} (${host}) would prune:`);
    for (const n of matched) console.log(`  ${n}`);
    console.log(`  reason: ${f.reason}`);
    return;
  }

  if (matched.length === 0) {
    console.log("[raw-prune] no-op");
    return;
  }

  assertR2Configured();
  const bucket = getR2Bucket();
  const client = getR2Client();
  let pruned = 0, errors = 0;
  for (const name of matched) {
    const localPath = join(dir, name);
    // R2 DELETE (idempotent)
    try {
      await client.send(new DeleteObjectCommand({
        Bucket: bucket, Key: r2KeyFor(host, f.slug, name),
      }));
    } catch (err: unknown) {
      const msg = (err as Error).message ?? String(err);
      if (!/NoSuchKey|NotFound|404/i.test(msg)) {
        errors++;
        console.error(`  [error] R2 delete ${name}: ${msg}`);
        continue;
      }
    }
    // Local rm (skip if --no-local or file already absent)
    if (!f.noLocal && existsSync(localPath)) {
      try { unlinkSync(localPath); } catch (err) {
        errors++;
        console.error(`  [error] local rm ${name}: ${(err as Error).message}`);
        continue;
      }
    }
    // Disposition row
    appendDispositionRow({
      slug: f.slug, host, file: name,
      action: "delete", reason: f.reason!,
      decided_at: new Date().toISOString(),
    });
    pruned++;
    console.log(`  pruned: ${f.slug}/${name}`);
  }
  console.log(`\n[raw-prune] pruned=${pruned} errors=${errors} reason=${f.reason}`);
  if (errors > 0) process.exit(1);
}

export async function main(argv: string[]): Promise<void> {
  const f = parseFlags(argv);
  if (f.revert) return cmdRevert(f.revert);
  return cmdPrune(f);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err.stack ?? err.message ?? err);
    process.exit(1);
  });
}
