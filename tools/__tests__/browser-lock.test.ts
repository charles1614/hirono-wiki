import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  acquireBrowserLock,
  withBrowserLock,
  opencliLockPath,
  acquireSlugLock,
  acquireFileLockAt,
} from "../hirono/shared/browser-lock.ts";

// Use a per-test ephemeral lockfile via the HIRONO_OPENCLI_LOCK_PATH env var.
function withEphemeralLock<T>(fn: (lockPath: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "brlock-"));
  const lockPath = join(dir, "opencli.lock");
  const prev = process.env.HIRONO_OPENCLI_LOCK_PATH;
  process.env.HIRONO_OPENCLI_LOCK_PATH = lockPath;
  try {
    return fn(lockPath);
  } finally {
    if (prev === undefined) delete process.env.HIRONO_OPENCLI_LOCK_PATH;
    else process.env.HIRONO_OPENCLI_LOCK_PATH = prev;
    rmSync(dir, { recursive: true, force: true });
  }
}

test("opencliLockPath: honors HIRONO_OPENCLI_LOCK_PATH env", () => {
  const prev = process.env.HIRONO_OPENCLI_LOCK_PATH;
  process.env.HIRONO_OPENCLI_LOCK_PATH = "/tmp/custom-opencli.lock";
  try {
    assert.equal(opencliLockPath(), "/tmp/custom-opencli.lock");
  } finally {
    if (prev === undefined) delete process.env.HIRONO_OPENCLI_LOCK_PATH;
    else process.env.HIRONO_OPENCLI_LOCK_PATH = prev;
  }
});

test("acquireBrowserLock: creates lock file with pid + metadata", () => {
  withEphemeralLock((path) => {
    const release = acquireBrowserLock("xhs-note", "2026-04-19-test");
    try {
      assert.ok(existsSync(path), "lock file should exist while held");
      const info = JSON.parse(readFileSync(path, "utf8"));
      assert.equal(info.pid, process.pid);
      assert.equal(info.slug, "2026-04-19-test");
      assert.equal(info.label, "xhs-note");
      assert.ok(info.started_at);
    } finally {
      release();
    }
    assert.equal(existsSync(path), false, "lock file should be gone after release");
  });
});

test("acquireBrowserLock: fails fast if another live process holds the lock", () => {
  withEphemeralLock((path) => {
    // Fake a live-held lock by writing current pid (guaranteed alive).
    const fakeInfo = {
      pid: process.pid,
      started_at: new Date().toISOString(),
      slug: "other-slug",
      label: "other-label",
    };
    writeFileSync(path, JSON.stringify(fakeInfo), "utf8");

    // Monkey-patch so acquire sees "someone else" by treating process.pid
    // as not-ours. We accomplish this by using a different pid (process.pid - 1)
    // as the holder — process.kill(pid, 0) will return true or EPERM for most
    // adjacent pids that exist. Skip if no suitable pid is found.
    // Simpler approach: just assert that holding with our pid makes a second
    // acquire in the same process see "our pid is alive and held".
    assert.throws(
      () => acquireBrowserLock("second-attempt"),
      (err: any) => err.code === "opencli-busy",
    );
  });
});

test("acquireBrowserLock: stale lock from dead pid is silently overwritten", () => {
  withEphemeralLock((path) => {
    // pid=1 is `init` / `launchd`; definitely alive on any unix, so use
    // an extremely high pid unlikely to exist as our "dead" marker.
    const deadPid = 2 ** 22;  // >4M, beyond any plausible running pid
    writeFileSync(
      path,
      JSON.stringify({ pid: deadPid, started_at: new Date().toISOString(), label: "dead" }),
      "utf8",
    );
    // Should NOT throw — the existing lock is stale.
    const release = acquireBrowserLock("fresh", "slug-x");
    try {
      const info = JSON.parse(readFileSync(path, "utf8"));
      assert.equal(info.pid, process.pid);
      assert.equal(info.label, "fresh");
    } finally {
      release();
    }
  });
});

test("acquireBrowserLock: corrupt lock file is treated as stale", () => {
  withEphemeralLock((path) => {
    writeFileSync(path, "not valid json {{{", "utf8");
    const release = acquireBrowserLock("fresh", "x");
    try {
      const info = JSON.parse(readFileSync(path, "utf8"));
      assert.equal(info.pid, process.pid);
    } finally {
      release();
    }
  });
});

test("withBrowserLock: releases lock on success", () => {
  withEphemeralLock((path) => {
    withBrowserLock("x", undefined, () => {
      assert.ok(existsSync(path));
    });
    assert.equal(existsSync(path), false);
  });
});

test("withBrowserLock: releases lock on throw", () => {
  withEphemeralLock((path) => {
    assert.throws(() => {
      withBrowserLock("x", undefined, () => {
        assert.ok(existsSync(path));
        throw new Error("boom");
      });
    }, /boom/);
    assert.equal(existsSync(path), false, "lock must be released after throw");
  });
});

test("release() is idempotent", () => {
  withEphemeralLock((path) => {
    const release = acquireBrowserLock("x");
    release();
    release();  // Should not throw
    assert.equal(existsSync(path), false);
  });
});

test("release() doesn't clobber a lock taken over by another process", () => {
  withEphemeralLock((path) => {
    const release = acquireBrowserLock("first");
    // Simulate another process stealing the lock (by overwriting the file).
    writeFileSync(path, JSON.stringify({
      pid: process.pid + 1,
      started_at: new Date(Date.now() + 1000).toISOString(),
      label: "other",
    }), "utf8");
    release();  // Should NOT delete the other process's lock.
    assert.ok(existsSync(path), "lock owned by another holder must survive our release");
  });
});

// ---------------------------------------------------------------------------
// acquireSlugLock
// ---------------------------------------------------------------------------

test("acquireSlugLock: creates .fetch.lock in slug dir", () => {
  const dir = mkdtempSync(join(tmpdir(), "sluglock-"));
  try {
    const slugDir = join(dir, "2026", "2026-04-19-test");
    const release = acquireSlugLock(slugDir, "2026-04-19-test");
    try {
      const lockPath = join(slugDir, ".fetch.lock");
      assert.ok(existsSync(lockPath), "slug lock file should exist");
      const info = JSON.parse(readFileSync(lockPath, "utf8"));
      assert.equal(info.pid, process.pid);
      assert.equal(info.slug, "2026-04-19-test");
      assert.match(info.label, /slug-fetch:/);
    } finally {
      release();
    }
    assert.equal(existsSync(join(slugDir, ".fetch.lock")), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("acquireSlugLock: fails fast with slug-busy on contention", () => {
  const dir = mkdtempSync(join(tmpdir(), "sluglock-"));
  try {
    const slugDir = join(dir, "2026", "2026-04-19-test");
    const release = acquireSlugLock(slugDir, "2026-04-19-test");
    try {
      assert.throws(
        () => acquireSlugLock(slugDir, "2026-04-19-test"),
        (err: any) => err.code === "slug-busy",
      );
    } finally {
      release();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("acquireSlugLock: different slugs do NOT contend", () => {
  const dir = mkdtempSync(join(tmpdir(), "sluglock-"));
  try {
    const slugDirA = join(dir, "2026", "2026-04-19-a");
    const slugDirB = join(dir, "2026", "2026-04-19-b");
    const rA = acquireSlugLock(slugDirA, "a");
    const rB = acquireSlugLock(slugDirB, "b");
    try {
      assert.ok(existsSync(join(slugDirA, ".fetch.lock")));
      assert.ok(existsSync(join(slugDirB, ".fetch.lock")));
    } finally {
      rA();
      rB();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("acquireFileLockAt: custom busyCode propagates", () => {
  const dir = mkdtempSync(join(tmpdir(), "genlock-"));
  try {
    const path = join(dir, "thing.lock");
    const r = acquireFileLockAt(path, { label: "x", busyCode: "my-custom-busy" });
    try {
      assert.throws(
        () => acquireFileLockAt(path, { label: "y", busyCode: "my-custom-busy" }),
        (err: any) => err.code === "my-custom-busy",
      );
    } finally {
      r();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
