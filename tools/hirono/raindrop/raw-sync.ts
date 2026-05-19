/**
 * `hirono raindrop raw-sync` — incremental backup of `raw/` to Cloudflare R2.
 *
 * Backup semantics:
 *  - Upload local drift (per-file SHA compared against the ledger's last row)
 *  - Delete from R2 only where the disposition log says so
 *  - Never propagate "local missing" to R2 — that's a SKIP (preserve)
 *
 * Subcommands:
 *   raw-sync                          # incremental upload + disposition-driven delete
 *   raw-sync --slug <slug>            # one slug
 *   raw-sync --host <host>            # all slugs under one host
 *   raw-sync --dry-run                # plan only
 *   raw-sync --status                 # counts: in-sync / drift / unsynced / pending-delete
 *   raw-sync --restore                # R2 → local (respects disposition)
 *   raw-sync --restore --slug <slug>
 *   raw-sync --rewrite-sources [--apply]   # rewrite 03_Sources relative refs → R2 URLs
 *   raw-sync --verify                 # download + checksum a random sample
 *   raw-sync --verify-source-refs     # HEAD every R2 URL appearing in 03_Sources
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  HeadObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";

import { writeFileAtomic } from "../../shared/atomic-write.ts";
import {
  getR2Bucket,
  getR2Client,
  getR2PublicBase,
  assertR2Configured,
} from "../../shared/r2-client.ts";
import { readLedger, appendLedgerRow, type LedgerRow } from "../../shared/r2-ledger.ts";
import { readDisposition, type DispositionRow } from "../../shared/r2-disposition.ts";
import {
  uploadSlug,
  sha256Hex,
  r2KeyFor,
  shouldSkipName,
} from "../../shared/r2-uploader.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..", "..", "..");
const RAINDROP_DIR = join(REPO_ROOT, "raw", "raindrop");
const SOURCES_DIR = join(REPO_ROOT, "03_Sources");

interface Flags {
  slug?: string;
  host?: string;
  dryRun: boolean;
  status: boolean;
  restore: boolean;
  rewriteSources: boolean;
  apply: boolean;
  verify: boolean;
  verifySourceRefs: boolean;
  concurrency: number;
}

function parseFlags(argv: string[]): Flags {
  const f: Flags = {
    dryRun: false, status: false, restore: false, rewriteSources: false,
    apply: false, verify: false, verifySourceRefs: false, concurrency: 3,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--slug": f.slug = argv[++i]; break;
      case "--host": f.host = argv[++i]; break;
      case "--dry-run": f.dryRun = true; break;
      case "--status": f.status = true; break;
      case "--restore": f.restore = true; break;
      case "--rewrite-sources": f.rewriteSources = true; break;
      case "--apply": f.apply = true; break;
      case "--verify": f.verify = true; break;
      case "--verify-source-refs": f.verifySourceRefs = true; break;
      case "--concurrency": f.concurrency = Number(argv[++i]) || 3; break;
      case "--help": case "-h":
        printHelp(); process.exit(0);
      default:
        if (a.startsWith("-")) throw new Error(`unknown flag: ${a}`);
    }
  }
  return f;
}

function printHelp(): void {
  console.log(`hirono raindrop raw-sync — incremental R2 backup of raw/

  raw-sync                          # upload drift + disposition-driven deletes
  raw-sync --slug <slug>            # one slug
  raw-sync --host <host>            # all slugs under host
  raw-sync --dry-run                # plan only
  raw-sync --status                 # counts only
  raw-sync --restore [--slug <s>]   # R2 → local (bootstrap)
  raw-sync --rewrite-sources [--apply]   # 03_Sources relative refs → R2 URLs
  raw-sync --verify                 # download + checksum a sample
  raw-sync --verify-source-refs     # HEAD every R2 URL in 03_Sources
`);
}

interface SlugLoc { host: string; slug: string; dir: string; }

function listAllSlugs(filter?: { host?: string; slug?: string }): SlugLoc[] {
  if (!existsSync(RAINDROP_DIR)) return [];
  const out: SlugLoc[] = [];
  const hosts = readdirSync(RAINDROP_DIR).filter(h => {
    const p = join(RAINDROP_DIR, h);
    try { return statSync(p).isDirectory(); } catch { return false; }
  });
  for (const host of hosts) {
    if (filter?.host && filter.host !== host) continue;
    const hostDir = join(RAINDROP_DIR, host);
    for (const slug of readdirSync(hostDir)) {
      if (filter?.slug && filter.slug !== slug) continue;
      const dir = join(hostDir, slug);
      try {
        if (!statSync(dir).isDirectory()) continue;
      } catch { continue; }
      out.push({ host, slug, dir });
    }
  }
  return out;
}

async function runMany<T, R>(items: T[], concurrency: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function cmdSync(f: Flags): Promise<void> {
  assertR2Configured();
  const slugs = listAllSlugs({ host: f.host, slug: f.slug });
  if (slugs.length === 0) {
    console.log("[raw-sync] no slugs match filter");
    return;
  }
  const ledger = readLedger();
  const disposition = readDisposition();
  let uploaded = 0, skipped = 0, deletes = 0, bytes = 0, errors = 0;
  await runMany(slugs, f.concurrency, async (loc) => {
    try {
      const result = await uploadSlug(loc.dir, loc.host, loc.slug, {
        ledger, disposition, dryRun: f.dryRun,
      });
      uploaded += result.uploaded.length;
      skipped += result.skipped.length;
      deletes += result.r2Deletes.length;
      bytes += result.bytesUploaded;
      if (result.errors.length > 0) {
        errors += result.errors.length;
        for (const e of result.errors) console.error(`  [error] ${loc.slug}/${e.file}: ${e.message}`);
      }
      if (result.uploaded.length + result.r2Deletes.length > 0) {
        console.log(`  ${loc.slug}: ${result.uploaded.length} up, ${result.r2Deletes.length} del, ${(result.bytesUploaded/1024).toFixed(1)} KB`);
      }
      return result;
    } catch (err) {
      errors++;
      console.error(`  [error] ${loc.slug}: ${(err as Error).message}`);
      return null;
    }
  });
  console.log(`\n[raw-sync] ${f.dryRun ? "[dry-run] " : ""}slugs=${slugs.length} uploaded=${uploaded} skipped=${skipped} deletes=${deletes} bytes=${(bytes/1024/1024).toFixed(2)} MB errors=${errors}`);
  if (errors > 0) process.exit(1);
}

async function cmdStatus(f: Flags): Promise<void> {
  assertR2Configured();
  const slugs = listAllSlugs({ host: f.host, slug: f.slug });
  const ledger = readLedger();
  const disposition = readDisposition();
  let inSync = 0, drift = 0, unsynced = 0;
  let pendingDelete = 0;
  for (const loc of slugs) {
    const prior = ledger.get(loc.slug);
    if (!prior) { unsynced++; continue; }
    const priorFiles = new Map(prior.files.map(p => [p.name, p]));
    const localFiles = readdirSync(loc.dir).filter(n => !shouldSkipName(n)).filter(n => {
      try { return statSync(join(loc.dir, n)).isFile(); } catch { return false; }
    });
    let isDrift = false;
    for (const n of localFiles) {
      const buf = readFileSync(join(loc.dir, n));
      const sha = sha256Hex(buf);
      const p = priorFiles.get(n);
      if (!p || p.sha !== sha) { isDrift = true; break; }
    }
    if (isDrift) drift++; else inSync++;
  }
  for (const d of disposition.values()) {
    if (d.action !== "delete") continue;
    // Pending if file is in any prior ledger row's files (i.e. uploaded earlier).
    const prior = ledger.get(d.slug);
    if (prior?.files?.some(f => f.name === d.file)) pendingDelete++;
  }
  console.log(`[raw-sync --status]`);
  console.log(`  slugs total      : ${slugs.length}`);
  console.log(`  in-sync          : ${inSync}`);
  console.log(`  drift            : ${drift}`);
  console.log(`  unsynced         : ${unsynced}`);
  console.log(`  pending-delete   : ${pendingDelete}`);
}

async function cmdRestore(f: Flags): Promise<void> {
  assertR2Configured();
  const bucket = getR2Bucket();
  const client = getR2Client();
  const disposition = readDisposition();
  // Filter from R2 listing rather than local — we're bootstrapping.
  const prefix = f.host
    ? `raindrop/${f.host}/${f.slug ?? ""}`
    : `raindrop/`;
  let token: string | undefined;
  let restored = 0, skippedDisposition = 0, kept = 0;
  do {
    const resp = await client.send(new ListObjectsV2Command({
      Bucket: bucket, Prefix: prefix, ContinuationToken: token,
    }));
    for (const obj of resp.Contents ?? []) {
      const key = obj.Key!;
      const m = key.match(/^raindrop\/([^/]+)\/([^/]+)\/(.+)$/);
      if (!m) continue;
      const [, host, slug, file] = m;
      if (f.slug && slug !== f.slug) continue;
      // Respect disposition: skip files marked delete (don't resurrect).
      const dispDel = Array.from(disposition.values()).some(
        d => d.slug === slug && d.file === file && d.action === "delete",
      );
      if (dispDel) { skippedDisposition++; continue; }
      const localPath = join(RAINDROP_DIR, host, slug, file);
      if (existsSync(localPath)) { kept++; continue; }
      if (f.dryRun) { restored++; continue; }
      mkdirSync(dirname(localPath), { recursive: true });
      const o = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const stream = o.Body as ReadableStream<Uint8Array> | undefined;
      const buf = stream ? Buffer.from(await new Response(stream).arrayBuffer()) : Buffer.alloc(0);
      writeFileSync(localPath, buf);
      restored++;
      if (restored % 50 === 0) console.log(`  restored ${restored}…`);
    }
    token = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (token);
  console.log(`[raw-sync --restore] ${f.dryRun ? "[dry-run] " : ""}restored=${restored} kept-local=${kept} skipped-disposition=${skippedDisposition}`);
}

async function cmdRewriteSources(f: Flags): Promise<void> {
  const publicBase = getR2PublicBase();
  if (!existsSync(SOURCES_DIR)) {
    console.error(`[raw-sync] ${SOURCES_DIR} not found`);
    process.exit(1);
  }
  const files: string[] = [];
  function walk(dir: string): void {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (n.endsWith(".md")) files.push(p);
    }
  }
  walk(SOURCES_DIR);
  const re = /!\[([^\]]*)\]\(\.\.\/\.\.\/raw\/raindrop\/([^)]+)\)/g;
  let touched = 0, refs = 0;
  for (const file of files) {
    const before = readFileSync(file, "utf8");
    const after = before.replace(re, (_, alt: string, rest: string) => {
      refs++;
      return `![${alt}](${publicBase}/raindrop/${rest})`;
    });
    if (after !== before) {
      touched++;
      if (f.apply) writeFileAtomic(file, after);
    }
  }
  console.log(`[raw-sync --rewrite-sources] ${f.apply ? "applied" : "[dry-run]"} files-touched=${touched} refs-rewritten=${refs}`);
  if (!f.apply) console.log("  (re-run with --apply to write)");
}

async function cmdVerifySourceRefs(): Promise<void> {
  assertR2Configured();
  const publicBase = getR2PublicBase();
  if (!existsSync(SOURCES_DIR)) return;
  const files: string[] = [];
  function walk(dir: string): void {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (n.endsWith(".md")) files.push(p);
    }
  }
  walk(SOURCES_DIR);
  const refRe = new RegExp(`!\\[[^\\]]*\\]\\(${publicBase.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}/([^)]+)\\)`, "g");
  const bucket = getR2Bucket();
  const client = getR2Client();
  let ok = 0, missing = 0;
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    while ((m = refRe.exec(text))) {
      const key = m[1];
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        ok++;
      } catch (err: unknown) {
        const e = err as { name?: string; message?: string; $response?: { statusCode?: number } };
        const status = e?.$response?.statusCode;
        const isMissing = status === 404 || /NoSuchKey|NotFound/i.test(e?.name ?? "") || /NoSuchKey|NotFound|404/i.test(e?.message ?? "");
        if (isMissing) {
          missing++;
          console.error(`  [missing] ${file} → ${key}`);
        } else throw err;
      }
    }
  }
  console.log(`[raw-sync --verify-source-refs] ok=${ok} missing=${missing}`);
  if (missing > 0) process.exit(1);
}

async function cmdVerify(): Promise<void> {
  assertR2Configured();
  const ledger = readLedger();
  const entries = Array.from(ledger.values());
  if (entries.length === 0) { console.log("[raw-sync --verify] no ledger rows"); return; }
  const sampleN = Math.min(5, entries.length);
  const sample: LedgerRow[] = [];
  const picked = new Set<number>();
  while (sample.length < sampleN) {
    const idx = Math.floor(Math.random() * entries.length);
    if (picked.has(idx)) continue;
    picked.add(idx);
    sample.push(entries[idx]);
  }
  const bucket = getR2Bucket();
  const client = getR2Client();
  let ok = 0, mismatch = 0;
  for (const row of sample) {
    for (const f of row.files) {
      const key = r2KeyFor(row.host, row.slug, f.name);
      try {
        const o = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const stream = o.Body as ReadableStream<Uint8Array> | undefined;
        const buf = stream ? Buffer.from(await new Response(stream).arrayBuffer()) : Buffer.alloc(0);
        const sha = createHash("sha256").update(buf).digest("hex");
        if (sha === f.sha) ok++;
        else { mismatch++; console.error(`  [sha-mismatch] ${row.slug}/${f.name}: local=${f.sha} r2=${sha}`); }
      } catch (err) {
        mismatch++;
        console.error(`  [error] ${row.slug}/${f.name}: ${(err as Error).message}`);
      }
    }
  }
  console.log(`[raw-sync --verify] sampled=${sample.length} files-ok=${ok} mismatch=${mismatch}`);
  if (mismatch > 0) process.exit(1);
}

export async function main(argv: string[]): Promise<void> {
  const f = parseFlags(argv);
  if (f.status) return cmdStatus(f);
  if (f.restore) return cmdRestore(f);
  if (f.rewriteSources) return cmdRewriteSources(f);
  if (f.verify) return cmdVerify();
  if (f.verifySourceRefs) return cmdVerifySourceRefs();
  return cmdSync(f);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err.stack ?? err.message ?? err);
    process.exit(1);
  });
}
