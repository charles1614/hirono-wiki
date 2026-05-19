/**
 * R2 sync ledger — `raw/raindrop/.r2-sync-ledger.jsonl`.
 *
 * Append-only record of every successful per-slug R2 upload. Each row
 * captures the file set + per-file SHA + bytes uploaded for that slug at
 * that point in time. Drift = current local file SHA differs from the
 * last row's recorded SHA for that file (so sync detects single-image
 * changes, not just whole-slug content_sha drift).
 *
 * Layout mirrors `revisions.ts`:
 *  - readLedger() returns Map<slug, latest-row>
 *  - appendLedgerRow() appends with O_APPEND + fsync
 *  - partial trailing line on read = warning, not error
 *
 * `r2_deletes` records files this run actively removed from R2 (because
 * the disposition log said so) — provenance trail for "why did this
 * R2 object go away?"
 */
import { existsSync, readFileSync, openSync, writeSync, closeSync, fsyncSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..", "..");
const LEDGER_PATH = join(REPO_ROOT, "raw", "raindrop", ".r2-sync-ledger.jsonl");

export interface LedgerFile {
  name: string;
  sha: string;
  bytes: number;
}

export interface LedgerDelete {
  name: string;
  reason: string;
}

export interface LedgerRow {
  slug: string;
  host: string;
  uploaded_at: string;
  files: LedgerFile[];
  r2_deletes?: LedgerDelete[];
}

export function ledgerPath(): string {
  return LEDGER_PATH;
}

/**
 * Read all ledger rows. Last row wins per slug.
 */
export function readLedger(path: string = LEDGER_PATH): Map<string, LedgerRow> {
  const out = new Map<string, LedgerRow>();
  if (!existsSync(path)) return out;
  const lines = readFileSync(path, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as LedgerRow;
      out.set(row.slug, row);
    } catch {
      const isLast = i === lines.length - 1 || lines.slice(i + 1).every(l => !l.trim());
      if (isLast) {
        console.warn(`[r2-ledger] ${path}: ignoring partial last line (interrupted write?)`);
      } else {
        console.error(`[r2-ledger] ${path}: corrupt line at offset ${i + 1}`);
      }
      break;
    }
  }
  return out;
}

export function appendLedgerRow(row: LedgerRow, path: string = LEDGER_PATH): void {
  const fd = openSync(path, "a");
  try {
    writeSync(fd, JSON.stringify(row) + "\n");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
