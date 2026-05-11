/**
 * Cross-site browser-eval helpers — used by the D-bucket site modules
 * (xhs, weixin, zhihu, deepwiki-com, deepwiki-litenext, epoch-ai,
 * linux-do, nvidianews) that drive opencli's headless Chrome to extract
 * outerHTML / DOM data from JS-rendered SPAs.
 *
 * Site modules using plain curl don't need any of this — see
 * `article-site-factory.ts` for the curl path.
 */

import { spawnSync } from "node:child_process";

import { makeError } from "../../fetch-raw.ts";

/**
 * Run an opencli command and return stdout. Throws a typed error on
 * non-zero exit, classifying common failure modes (extension offline,
 * login required, generic).
 */
export function runOpencli(args: string[], opts: { timeoutMs?: number } = {}): string {
  const res = spawnSync("opencli", args, {
    encoding: "utf8",
    timeout: opts.timeoutMs ?? 90_000,
    maxBuffer: 30 * 1024 * 1024,
  });
  if (res.status !== 0) {
    const stderr = (res.stderr ?? "").trim();
    if (/extension.*(offline|disconnect|not connected)/i.test(stderr)) {
      throw makeError("extension-offline", "L3", `opencli extension offline: ${stderr.slice(0, 200)}`,
        { remediation: "run `opencli doctor`; reconnect the Chrome Bridge extension" });
    }
    if (/login|sign in|未登录|please log in/i.test(stderr)) {
      throw makeError("login-expired", "L3", `opencli requires login: ${stderr.slice(0, 200)}`,
        { remediation: "log into the target site in the opencli-connected Chrome, then retry" });
    }
    throw makeError(
      "opencli-error", "L3",
      `opencli ${args.join(" ").slice(0, 160)} failed (exit ${res.status}): ${stderr.slice(0, 200)}`,
    );
  }
  return res.stdout;
}

/**
 * Browser-timeout knobs. Defaults match the hard-coded values used
 * throughout the browser extractors; each can be overridden via the
 * corresponding env var for operators running on slower machines or
 * behind a slow SPA.
 *
 * Not a total wall-clock budget for the whole adapter; per-call
 * timeouts combined with the module-wide opencli lock are sufficient
 * bounds — a hung browser blocks only the next acquirer, never the
 * whole batch.
 */
export function browserTimeoutMs(kind: "open" | "eval" | "close" | "doctor"): number {
  const envMap: Record<typeof kind, { env: string; def: number }> = {
    open:   { env: "HIRONO_BROWSER_OPEN_TIMEOUT_MS",   def: 30_000 },
    eval:   { env: "HIRONO_BROWSER_EVAL_TIMEOUT_MS",   def: 15_000 },
    close:  { env: "HIRONO_BROWSER_CLOSE_TIMEOUT_MS",  def: 5_000 },
    doctor: { env: "HIRONO_BROWSER_DOCTOR_TIMEOUT_MS", def: 10_000 },
  };
  const spec = envMap[kind];
  const raw = process.env[spec.env];
  if (!raw) return spec.def;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return spec.def;
  return n;
}

/**
 * Close the opencli browser tab if open. Best-effort — failures are ignored.
 */
export function closeBrowser(): void {
  try {
    spawnSync("opencli", ["browser", "close"], {
      encoding: "utf8",
      timeout: browserTimeoutMs("close"),
    });
  } catch { /* best-effort */ }
}

/**
 * `opencli browser open <url>` with self-healing retry. opencli's
 * automation tab occasionally enters a stuck state after many
 * back-to-back fetches (observed in bulk fetch-all runs: ~every 100–120
 * calls the next `open` hangs past its timeout, but a `browser close`
 * unsticks it). Instead of bubbling that up as an L3 halt that the
 * operator has to manually recover from, we transparently close + retry
 * once. The shape mirrors `spawnSync` so callers can swap it in for a
 * direct `spawnSync("opencli", ["browser", "open", url], ...)`.
 *
 * Returns `{ status, stdout, stderr }`. status === 0 on success, on
 * which callers proceed normally; non-zero means BOTH attempts failed
 * and the second attempt's stderr is what to report.
 */
export function openBrowserWithRetry(
  url: string,
  opts: { timeoutMs?: number } = {},
): { status: number; stdout: string; stderr: string } {
  const timeout = opts.timeoutMs ?? browserTimeoutMs("open");
  const attempt = () =>
    spawnSync("opencli", ["browser", "open", url], { encoding: "utf8", timeout });
  let res = attempt();
  if (res.status === 0) {
    return { status: 0, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
  }
  // First attempt failed (timeout or other) — clear any stuck tab and
  // retry once. closeBrowser is best-effort; a brief sleep lets the
  // daemon release the tab lease before we try again.
  closeBrowser();
  sleepMs(500);
  res = attempt();
  return {
    status: res.status ?? 1,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

/**
 * Small blocking sleep (we're serial + deliberate here; no Node
 * event-loop concerns). Spin-wait with `Atomics.wait` to avoid
 * burning CPU.
 */
export function sleepMs(ms: number): void {
  const end = Date.now() + ms;
  const sab = new SharedArrayBuffer(4);
  const i32 = new Int32Array(sab);
  while (Date.now() < end) {
    Atomics.wait(i32, 0, 0, Math.min(200, end - Date.now()));
  }
}

/**
 * Health probe used by `hirono doctor`. Confirms the opencli CLI is
 * installed AND its Chrome Bridge extension is reachable.
 */
export function opencliDoctorOk(): boolean {
  const out = spawnSync("opencli", ["doctor"], {
    encoding: "utf8",
    timeout: browserTimeoutMs("doctor"),
  });
  return out.stdout.includes("[OK] Extension:") && out.stdout.includes("[OK] Connectivity:");
}
