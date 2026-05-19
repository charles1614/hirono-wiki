/**
 * Disposition log — `raw/raindrop/.disposition.jsonl`.
 *
 * Records explicit operator decisions about individual raw files:
 *   - delete: file is unwanted (avatar, broken fetch, etc.). Sync must
 *     ensure it is absent from R2. Re-fetches do NOT auto-re-add — they
 *     only re-add locally; sync still deletes from R2 next run.
 *   - keep: overrides a prior delete decision (revert).
 *
 * The disposition log is the SINGLE authority for R2 deletions. Sync
 * never infers deletion from "local missing"; that's just a SKIP (R2
 * keeps the file, recoverable via --restore).
 *
 * Last row wins per (slug, file). Append via O_APPEND + fsync.
 */
import { existsSync, readFileSync, openSync, writeSync, closeSync, fsyncSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..", "..");
const DISPOSITION_PATH = join(REPO_ROOT, "raw", "raindrop", ".disposition.jsonl");

export type DispositionAction = "delete" | "keep";

export interface DispositionRow {
  slug: string;
  host: string;
  file: string;
  action: DispositionAction;
  reason: string;
  decided_at: string;
}

export function dispositionPath(): string {
  return DISPOSITION_PATH;
}

function key(slug: string, file: string): string {
  return `${slug}\x00${file}`;
}

/**
 * Read all disposition rows. Returns Map<"slug\0file", row> with last
 * row winning per key. Partial last line tolerated.
 */
export function readDisposition(path: string = DISPOSITION_PATH): Map<string, DispositionRow> {
  const out = new Map<string, DispositionRow>();
  if (!existsSync(path)) return out;
  const lines = readFileSync(path, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as DispositionRow;
      out.set(key(row.slug, row.file), row);
    } catch {
      const isLast = i === lines.length - 1 || lines.slice(i + 1).every(l => !l.trim());
      if (isLast) {
        console.warn(`[r2-disposition] ${path}: ignoring partial last line (interrupted write?)`);
      } else {
        console.error(`[r2-disposition] ${path}: corrupt line at offset ${i + 1}`);
      }
      break;
    }
  }
  return out;
}

export function appendDispositionRow(row: DispositionRow, path: string = DISPOSITION_PATH): void {
  const fd = openSync(path, "a");
  try {
    writeSync(fd, JSON.stringify(row) + "\n");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/**
 * Lookup current action for a (slug, file). Defaults to "keep" when
 * no row exists. Caller cares mostly about `=== "delete"`.
 */
export function getDisposition(
  dispMap: Map<string, DispositionRow>,
  slug: string,
  file: string,
): DispositionAction {
  return dispMap.get(key(slug, file))?.action ?? "keep";
}

/**
 * Collect all (slug, file) pairs currently marked `delete`. Used when
 * walking R2 to issue cleanup deletions for pre-existing pruned files.
 */
export function listDeletions(dispMap: Map<string, DispositionRow>): DispositionRow[] {
  return Array.from(dispMap.values()).filter(r => r.action === "delete");
}
