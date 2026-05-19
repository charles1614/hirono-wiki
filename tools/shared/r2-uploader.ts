/**
 * Whole-slug atomic R2 upload + disposition-respecting delete.
 *
 * Implements the backup-semantics decision matrix:
 *
 *   local | R2     | disposition  | action
 *   ------+--------+--------------+---------------------
 *   p,X   | absent | -            | UPLOAD
 *   p,X   | p,X    | -            | SKIP
 *   p,X   | p,Y    | -            | UPLOAD (drift)
 *   absent| present| no entry     | SKIP (preserve)
 *   absent| present| delete       | DELETE
 *   p     | present| delete       | DELETE (+ warn)
 *   p     | absent | delete       | SKIP upload
 *
 * Whole-slug atomic: ledger row is appended only after every per-file
 * PUT/DELETE succeeded. Partial failure → no ledger row → next run
 * picks up where this one left off.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

import { getR2Client, getR2Bucket } from "./r2-client.ts";
import {
  readLedger,
  appendLedgerRow,
  type LedgerRow,
  type LedgerFile,
  type LedgerDelete,
} from "./r2-ledger.ts";
import {
  readDisposition,
  getDisposition,
  type DispositionRow,
} from "./r2-disposition.ts";

/** Files we never upload — local-only state. */
const SKIP_FILES = new Set([
  ".DS_Store",
  ".r2-sync-ledger.jsonl",
  ".disposition.jsonl",
  "_index.json",
]);

function shouldSkipName(name: string): boolean {
  if (SKIP_FILES.has(name)) return true;
  if (name.startsWith(".")) return true;     // dotfiles, tmp.*
  if (name.startsWith("tmp.")) return true;
  return false;
}

/**
 * List files inside slugDir recursively. Returns slug-relative posix paths
 * (forward slashes), suitable for use both as a local lookup key (with
 * `join(slugDir, name)`) and as the R2 key suffix.
 *
 * Skips entries whose path component matches `shouldSkipName` at any depth.
 */
function listSlugFiles(slugDir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const n of readdirSync(slugDir)) {
    if (shouldSkipName(n)) continue;
    const full = join(slugDir, n);
    let st;
    try { st = statSync(full); } catch { continue; }
    const rel = prefix ? `${prefix}/${n}` : n;
    if (st.isDirectory()) out.push(...listSlugFiles(full, rel));
    else if (st.isFile()) out.push(rel);
  }
  return out;
}

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function r2KeyFor(host: string, slug: string, file: string): string {
  return `raindrop/${host}/${slug}/${file}`;
}

export interface UploadSlugOptions {
  /** Bucket override (else getR2Bucket()). */
  bucket?: string;
  /** Client override (else getR2Client()). Tests use this. */
  client?: S3Client;
  /** Optional pre-loaded ledger to avoid repeat reads in batch runs. */
  ledger?: Map<string, LedgerRow>;
  /** Optional pre-loaded disposition map. */
  disposition?: Map<string, DispositionRow>;
  /** If true, skip writes — return what WOULD happen. */
  dryRun?: boolean;
  /** Override ledger file path (tests). */
  ledgerPath?: string;
}

export interface UploadSlugResult {
  slug: string;
  host: string;
  uploaded: LedgerFile[];
  skipped: LedgerFile[];     // in-sync, no-op
  r2Deletes: LedgerDelete[];
  bytesUploaded: number;
  errors: Array<{ file: string; message: string }>;
}

/**
 * Upload a single slug directory to R2 according to the decision matrix.
 *
 * @param slugDir Absolute path to `raw/raindrop/<host>/<slug>/`.
 * @param host    Hostname segment (used in R2 key).
 * @param slug    Slug segment (used in R2 key + ledger row).
 */
export async function uploadSlug(
  slugDir: string,
  host: string,
  slug: string,
  opts: UploadSlugOptions = {},
): Promise<UploadSlugResult> {
  const bucket = opts.bucket ?? getR2Bucket();
  const client = opts.client ?? getR2Client();
  const ledger = opts.ledger ?? readLedger();
  const disposition = opts.disposition ?? readDisposition();
  const prior = ledger.get(slug);
  const priorFiles = new Map<string, LedgerFile>(
    (prior?.files ?? []).map(f => [f.name, f]),
  );

  // Walk slug dir recursively. Names are slug-relative posix paths (use /
  // separators so the same string serves as both the file lookup and the
  // R2 key suffix). Subdirs matter — Marker emits per-paper figures under
  // <slug>-figures/, and ingest-side caches sit alongside.
  const localNames = existsSync(slugDir) ? listSlugFiles(slugDir) : [];

  // Set of files we need to consider for delete: prior-uploaded files
  // + disposition entries for this slug.
  const consideredNames = new Set<string>([...localNames, ...priorFiles.keys()]);
  for (const d of disposition.values()) {
    if (d.slug === slug && d.action === "delete") consideredNames.add(d.file);
  }

  const result: UploadSlugResult = {
    slug,
    host,
    uploaded: [],
    skipped: [],
    r2Deletes: [],
    bytesUploaded: 0,
    errors: [],
  };

  for (const name of consideredNames) {
    const dispAction = getDisposition(disposition, slug, name);
    const localPath = join(slugDir, name);
    const localExists = existsSync(localPath);

    if (dispAction === "delete") {
      // Issue DELETE — idempotent, swallow NoSuchKey.
      if (localExists) {
        console.warn(`[r2-uploader] ${slug}/${name}: disposition=delete but local copy still present; will DELETE from R2 (local survives)`);
      }
      const dispRow = Array.from(disposition.values()).find(
        d => d.slug === slug && d.file === name && d.action === "delete",
      );
      const reason = dispRow?.reason ?? "(unspecified)";
      if (!opts.dryRun) {
        try {
          await client.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: r2KeyFor(host, slug, name),
          }));
        } catch (err: unknown) {
          const e = err as { name?: string; message?: string; $response?: { statusCode?: number } };
          const status = e?.$response?.statusCode;
          const isMissing = status === 404 || /NoSuchKey|NotFound/i.test(e?.name ?? "") || /NoSuchKey|NotFound|404/i.test(e?.message ?? "");
          if (!isMissing) {
            result.errors.push({ file: name, message: e?.message ?? String(err) });
            continue;
          }
        }
      }
      result.r2Deletes.push({ name, reason });
      continue;
    }

    if (!localExists) {
      // Backup semantics: do NOT delete from R2. Preserve.
      // (If the file was in priorFiles, keep it in ledger by reflecting
      // it as skipped — so the next ledger row still records it.)
      const priorEntry = priorFiles.get(name);
      if (priorEntry) result.skipped.push(priorEntry);
      continue;
    }

    // Local present, no delete disposition → check drift.
    const buf = readFileSync(localPath);
    const sha = sha256Hex(buf);
    const priorEntry = priorFiles.get(name);
    if (priorEntry && priorEntry.sha === sha) {
      result.skipped.push(priorEntry);
      continue;
    }

    // Upload (new or drifted).
    if (!opts.dryRun) {
      try {
        await client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: r2KeyFor(host, slug, name),
          Body: buf,
          ContentLength: buf.length,
        }));
      } catch (err: unknown) {
        result.errors.push({ file: name, message: (err as Error).message ?? String(err) });
        continue;
      }
    }
    const entry: LedgerFile = { name, sha, bytes: buf.length };
    result.uploaded.push(entry);
    result.bytesUploaded += buf.length;
  }

  // Whole-slug atomic ledger append. Only if no errors.
  if (result.errors.length > 0) return result;
  if (opts.dryRun) return result;

  // Skip ledger append when nothing changed AND no fresh deletes happened.
  if (result.uploaded.length === 0 && result.r2Deletes.length === 0) return result;

  const newRow: LedgerRow = {
    slug,
    host,
    uploaded_at: new Date().toISOString(),
    files: [...result.uploaded, ...result.skipped],
    r2_deletes: result.r2Deletes.length > 0 ? result.r2Deletes : undefined,
  };
  if (opts.ledgerPath) appendLedgerRow(newRow, opts.ledgerPath);
  else appendLedgerRow(newRow);
  return result;
}

/**
 * Convenience for the per-fetch hook in fetch-raw.ts. Fire-and-forget;
 * caller should `.catch` to a flag/warn rather than throw.
 */
export async function uploadSlugBest(
  slugDir: string,
  host: string,
  slug: string,
): Promise<UploadSlugResult> {
  return uploadSlug(slugDir, host, slug);
}

/**
 * Probe whether a specific R2 key exists. Used by --verify-source-refs.
 */
export async function r2KeyExists(
  bucket: string,
  key: string,
  client: S3Client,
): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err: unknown) {
    const msg = (err as Error).message ?? String(err);
    if (/NoSuchKey|NotFound|404/i.test(msg)) return false;
    throw err;
  }
}

export { sha256Hex, r2KeyFor, shouldSkipName };
