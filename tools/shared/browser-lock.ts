/**
 * Advisory lock for the single shared opencli Chrome browser session.
 *
 * Motivation: opencli's `browser` subcommand family (`open`, `eval`, `close`,
 * `web read`, `xiaohongshu note`, `weixin fetch`, etc. — anything that drives
 * the user's real Chrome via the extension bridge) all share ONE browser tab.
 * Two Node processes driving opencli concurrently will stomp on each other's
 * navigation + DOM state, silently producing wrong content for both.
 *
 * We don't run concurrently today, but:
 *   (a) a user may retry a batch while another is still running;
 *   (b) a future `--concurrency 2` would corrupt silently without this;
 *   (c) an editor / REPL session from the user in parallel is plausible.
 *
 * Implementation: a file lock at `~/Library/Caches/hirono/opencli.lock` (macOS)
 * or equivalent via `os.tmpdir()` fallback. Acquired at the top of every
 * browser-driving adapter, released in `finally`. Contains metadata
 * `{pid, started_at, slug}` so a stale lock from a crashed process shows
 * who to blame.
 *
 * Policy: **fail fast** if already held — throw `opencli-busy` (L3). Queueing
 * with blocking wait is a future feature; failing fast keeps the behavior
 * obvious while we're still stabilizing.
 *
 * Stale detection: if lockfile exists but the owning pid is not alive, the
 * acquirer treats it as stale and overwrites. `process.kill(pid, 0)` is the
 * standard liveness check.
 */
import {
  existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync,
  openSync, closeSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir, homedir, platform } from "node:os";

/** Filesystem path where the opencli lock lives. Platform-aware. */
export function opencliLockPath(): string {
  // macOS-ish: ~/Library/Caches/hirono/opencli.lock
  // Linux: $XDG_CACHE_HOME or ~/.cache/hirono/opencli.lock
  // Fallback: os.tmpdir()/hirono/opencli.lock
  if (process.env.HIRONO_OPENCLI_LOCK_PATH) {
    return process.env.HIRONO_OPENCLI_LOCK_PATH;
  }
  if (platform() === "darwin") {
    return join(homedir(), "Library", "Caches", "hirono", "opencli.lock");
  }
  const xdg = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
  return join(xdg, "hirono", "opencli.lock");
}

export interface LockInfo {
  pid: number;
  started_at: string;
  slug?: string;
  /** Free-form label describing what's holding the lock, e.g. "xhs-note:2026-04-19-foo" */
  label?: string;
}

/** Is `pid` currently alive? `kill(pid, 0)` throws ESRCH if not. */
function pidAlive(pid: number): boolean {
  if (pid === process.pid) return true;
  try {
    // Signal 0 = existence/permission check only; no actual signal sent.
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means it's alive but not ours; still alive.
    const code = (err as NodeJS.ErrnoException).code;
    return code === "EPERM";
  }
}

/**
 * Generic file-lock primitive. Acquires a lock at `path`; fail-fast with
 * `err.code = busyCode` if another live process holds it. Stale locks from
 * dead pids are silently overwritten. Returns a release function that
 * MUST be called in a finally block.
 *
 * Used by both the module-wide opencli lock (one path per machine) and
 * the per-slug fetch lock (one path per raw/<year>/<slug>/ dir).
 */
export function acquireFileLockAt(path: string, opts: {
  label: string;
  slug?: string;
  busyCode: string;
  busyMessage?: (existing: LockInfo) => string;
}): () => void {
  mkdirSync(dirname(path), { recursive: true });

  // Stale detection: if existing lock's owner is dead, steal it.
  if (existsSync(path)) {
    try {
      const existing = JSON.parse(readFileSync(path, "utf8")) as LockInfo;
      if (pidAlive(existing.pid)) {
        const msg = opts.busyMessage
          ? opts.busyMessage(existing)
          : `lock at ${path} held by pid=${existing.pid} ` +
            `(label=${existing.label ?? "unknown"}, slug=${existing.slug ?? "n/a"}, ` +
            `since=${existing.started_at}). Wait for it to finish, or kill the owner if stale.`;
        const err = new Error(msg);
        (err as NodeJS.ErrnoException).code = opts.busyCode;
        throw err;
      }
      // Stale — fall through to overwrite.
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === opts.busyCode) throw err;
      // Corrupt lock file; treat as stale and overwrite.
    }
  }

  const info: LockInfo = {
    pid: process.pid,
    started_at: new Date().toISOString(),
    slug: opts.slug,
    label: opts.label,
  };
  writeFileSync(path, JSON.stringify(info, null, 2), "utf8");

  let released = false;
  return function release(): void {
    if (released) return;
    released = true;
    try {
      // Only unlink if WE own it — protects against the case where we
      // overwrote a stale lock, then some other legitimate process
      // started and took it over before we finished.
      if (existsSync(path)) {
        const current = JSON.parse(readFileSync(path, "utf8")) as LockInfo;
        if (current.pid === process.pid && current.started_at === info.started_at) {
          unlinkSync(path);
        }
      }
    } catch {
      // Best-effort release; the next acquirer will stale-steal if needed.
    }
  };
}

/**
 * Acquire the opencli browser lock. Fail-fast: throws Error (with `.code =
 * "opencli-busy"`) if another live process holds the lock. Returns a release
 * function you MUST call in a `finally` block.
 *
 * If the lock exists but the owner is dead (stale), overwrite it silently.
 */
export function acquireBrowserLock(label: string, slug?: string): () => void {
  return acquireFileLockAt(opencliLockPath(), {
    label,
    slug,
    busyCode: "opencli-busy",
    busyMessage: (existing) =>
      `opencli browser lock held by pid=${existing.pid} ` +
      `(label=${existing.label ?? "unknown"}, slug=${existing.slug ?? "n/a"}, ` +
      `since=${existing.started_at}). ` +
      `Wait for it to finish, or kill the owning process if stale.`,
  });
}

/**
 * Acquire a per-slug fetch lock at `<slugDir>/.fetch.lock`. Prevents two
 * `fetchUrlAndStore(slug=X)` invocations from interleaving writes to the
 * same `raw/<year>/<slug>/` directory. Failure code: `slug-busy`.
 *
 * Idiomatic use:
 *   const release = acquireSlugLock(slugDir, slug);
 *   try { ... } finally { release(); }
 */
export function acquireSlugLock(slugDir: string, slug: string): () => void {
  return acquireFileLockAt(join(slugDir, ".fetch.lock"), {
    label: `slug-fetch:${slug}`,
    slug,
    busyCode: "slug-busy",
    busyMessage: (existing) =>
      `slug ${slug} is already being fetched by pid=${existing.pid} ` +
      `(started ${existing.started_at}). Refusing to interleave writes to ` +
      `raw/.../${slug}/. Wait for the other fetch to finish, or delete ` +
      `${slugDir}/.fetch.lock if the owning process is dead.`,
  });
}

/** Convenience wrapper: run `fn` under the lock, release on exit (success or throw). */
export function withBrowserLock<T>(label: string, slug: string | undefined, fn: () => T): T {
  const release = acquireBrowserLock(label, slug);
  try {
    return fn();
  } finally {
    release();
  }
}
