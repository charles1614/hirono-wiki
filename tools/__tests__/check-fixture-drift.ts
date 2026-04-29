#!/usr/bin/env tsx
/**
 * Live-fetch fixture drift detector. Walks every fixture under
 * `__tests__/fixtures/converters/<host>/<name>.input.json`, extracts
 * the source URL from the captured args, re-runs `hooks.capture(url)`
 * against the LIVE URL, and diffs the fresh output vs the saved
 * `expected.md`.
 *
 * Operator-run, NOT in CI. Network-dependent.
 *
 * Reports per-fixture:
 *   ✓ unchanged          — bytes match exactly (fixture is current)
 *   ~ trivial-diff       — only whitespace / single-character drift
 *   ✗ significant-diff   — content-affecting change (fixture is stale)
 *   ! fetch-failed       — re-fetch failed (auth, network, host change)
 *   ? no-source-url      — couldn't extract URL from input.json
 *   ? no-hooks           — no site-module owns this fixture (legacy web-fetch)
 *
 * Usage:
 *   npx tsx tools/__tests__/check-fixture-drift.ts                 # all fixtures
 *   npx tsx tools/__tests__/check-fixture-drift.ts --host substack # filter by host dir
 *   npx tsx tools/__tests__/check-fixture-drift.ts --diff-only     # exit non-zero on any sig-diff
 *
 * After surfacing drift, refresh affected fixtures via `approve.ts`:
 *   npx tsx tools/__tests__/approve.ts --site <site> --name <name> --url <url>
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { findHooksByName } from "../sites/test-hooks-registry.ts";

const FIXTURES_ROOT = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "converters");

interface FixtureEntry {
  host: string;          // fixture directory name (matches site name OR "web-<host>")
  name: string;
  inputPath: string;
  expectedMdPath: string;
  url: string | null;    // extracted from input.json args; null if not found
}

function extractUrl(args: unknown[]): string | null {
  // Walk args, look for any field that looks like a URL.
  for (const a of args) {
    if (typeof a === "string" && /^https?:\/\//.test(a)) return a;
    if (a && typeof a === "object") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const o = a as any;
      for (const k of ["url", "originUrl", "canonicalUrl", "finalUrl", "csvUrl"]) {
        if (typeof o[k] === "string" && /^https?:\/\//.test(o[k])) return o[k];
      }
    }
  }
  return null;
}

function listFixtures(): FixtureEntry[] {
  const out: FixtureEntry[] = [];
  if (!existsSync(FIXTURES_ROOT)) return out;
  for (const host of readdirSync(FIXTURES_ROOT)) {
    const dir = join(FIXTURES_ROOT, host);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".input.json")) continue;
      const name = f.replace(/\.input\.json$/, "");
      const inputPath = join(dir, f);
      const expectedMdPath = join(dir, `${name}.expected.md`);
      try {
        const input = JSON.parse(readFileSync(inputPath, "utf8")) as { args: unknown[] };
        const url = extractUrl(input.args || []);
        out.push({ host, name, inputPath, expectedMdPath, url });
      } catch {
        out.push({ host, name, inputPath, expectedMdPath, url: null });
      }
    }
  }
  return out;
}

function categorizeDiff(saved: string, fresh: string): "unchanged" | "trivial-diff" | "significant-diff" {
  if (saved === fresh) return "unchanged";
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  if (norm(saved) === norm(fresh)) return "trivial-diff";
  const delta = Math.abs(saved.length - fresh.length);
  const pct = delta / Math.max(1, saved.length);
  if (pct < 0.005) return "trivial-diff";
  return "significant-diff";
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag);
    if (i < 0 || i === argv.length - 1) return null;
    return argv[i + 1];
  };
  const has = (flag: string): boolean => argv.includes(flag);

  const filterHost = get("--host");
  const diffOnly = has("--diff-only");

  console.log(`[1/3] enumerate fixtures`);
  let entries = listFixtures();
  if (filterHost) entries = entries.filter((e) => e.host === filterHost);
  console.log(`     ${entries.length} fixture(s) to check`);

  console.log(`[2/3] re-fetch + diff each`);
  const results: Array<{ entry: FixtureEntry; status: string; detail: string }> = [];
  for (const e of entries) {
    if (!e.url) {
      results.push({ entry: e, status: "no-source-url", detail: "no URL in input.json args" });
      continue;
    }
    // Map fixture host directory → site-module name. Handle two shapes:
    //   - "web-<host>" → no site module (legacy generic-converter)
    //   - "<site>" → look up by name in registry
    if (e.host.startsWith("web-")) {
      results.push({ entry: e, status: "no-hooks", detail: `legacy web-fetch (no site module): ${e.url}` });
      continue;
    }
    const hooks = findHooksByName(e.host);
    if (!hooks) {
      results.push({ entry: e, status: "no-hooks", detail: `no site-module named "${e.host}"` });
      continue;
    }
    try {
      process.stderr.write(`     fetching ${e.host}/${e.name}…\n`);
      const captured = hooks.capture(e.url);
      const saved = readFileSync(e.expectedMdPath, "utf8");
      const status = categorizeDiff(saved, captured.markdown);
      const delta = captured.markdown.length - saved.length;
      results.push({ entry: e, status, detail: `Δ ${delta >= 0 ? "+" : ""}${delta} bytes` });
    } catch (err) {
      results.push({
        entry: e,
        status: "fetch-failed",
        detail: err instanceof Error ? err.message.slice(0, 120) : String(err),
      });
    }
  }

  console.log(`[3/3] summary`);
  const buckets: Record<string, number> = {};
  for (const r of results) buckets[r.status] = (buckets[r.status] || 0) + 1;
  for (const [status, count] of Object.entries(buckets).sort()) {
    console.log(`     ${status}: ${count}`);
  }
  console.log("");

  // Group by status for readable output.
  const orderedStatuses = ["significant-diff", "fetch-failed", "trivial-diff", "no-hooks", "no-source-url", "unchanged"];
  for (const st of orderedStatuses) {
    const inSt = results.filter((r) => r.status === st);
    if (inSt.length === 0) continue;
    const icon = st === "unchanged" ? "✓"
      : st === "trivial-diff" ? "~"
      : st === "significant-diff" ? "✗"
      : st === "fetch-failed" ? "!"
      : "?";
    for (const r of inSt) {
      console.log(`  ${icon} [${st}] ${r.entry.host}/${r.entry.name} — ${r.detail}`);
    }
  }

  if (diffOnly) {
    const sig = (buckets["significant-diff"] || 0) + (buckets["fetch-failed"] || 0);
    if (sig > 0) {
      console.log("");
      console.log(`--diff-only: ${sig} significant diff(s) or fetch failure(s) — exiting non-zero`);
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(`check-fixture-drift.ts failed: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
