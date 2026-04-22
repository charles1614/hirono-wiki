/**
 * Atomic file write helper.
 *
 * Motivation: every gitignored state file in this repo (batch state,
 * sources index, lark link map, fetch-raw source.json) is written with
 * `writeFileSync(path, ...)` today. A Ctrl-C — or any process crash —
 * between the truncation and the full write leaves a zero-byte (or
 * half-written) file, wiping progress. For a 598-source bulk fetch that
 * runs for an hour, this is unacceptable.
 *
 * Fix: write to a sibling tmp file, fsync to flush to disk, then rename
 * over the target. `rename(2)` is atomic on POSIX when source and dest
 * are on the same filesystem (always true here — we write tmp in the
 * same dir as target).
 *
 * This helper is intentionally dependency-free and ~15 LOC so it's
 * trivial to reason about.
 */
import { openSync, writeFileSync, renameSync, fsyncSync, closeSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";

/**
 * Atomically write `contents` to `path`.
 *
 * Algorithm: write to `<dir>/.<basename>.tmp-<pid>-<ts>`, fsync to flush
 * buffers to disk, then rename over `path`. On any error before rename,
 * best-effort unlink the tmp file so we don't accumulate garbage.
 *
 * Not safe against two concurrent writers to the same path (last-rename
 * wins) — if we ever need that, add a file lock. For now every caller
 * is effectively serialized by the fact that only one Node process
 * writes a given state file at a time.
 */
export function writeFileAtomic(path: string, contents: string): void {
  const dir = dirname(path);
  const base = basename(path);
  const tmp = join(dir, `.${base}.tmp-${process.pid}-${Date.now()}`);
  let fd: number | null = null;
  try {
    // writeFileSync is simplest; for fsync we need the fd, so open
    // explicitly.
    fd = openSync(tmp, "w");
    writeFileSync(fd, contents);
    fsyncSync(fd);
    closeSync(fd);
    fd = null;
    renameSync(tmp, path);
  } catch (err) {
    // Cleanup: close fd if still open, unlink tmp if it exists.
    if (fd !== null) {
      try { closeSync(fd); } catch {}
    }
    try { if (existsSync(tmp)) unlinkSync(tmp); } catch {}
    throw err;
  }
}
