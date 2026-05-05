/**
 * `hirono doctor` — environment health check.
 *
 * Verifies:
 *   1. opencli CLI exists + `opencli doctor` reports OK (extension + daemon)
 *   2. ~/.opencli/clis/wiki-custom symlink points to {repo}/tools/opencli-adapters
 *   3. Any .js files under tools/opencli-adapters/<site>/ load without syntax errors
 *   4. raw/ directory status — any `quality_status != good` sources
 *
 * With `--fix`:
 *   - Create the wiki-custom symlink if missing
 *   - Create ~/.opencli/clis/ if missing
 *
 * Exits 0 if healthy, non-zero if any issue found.
 */

import { existsSync, mkdirSync, symlinkSync, unlinkSync, statSync, lstatSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import {
  LOCAL_ADAPTERS_DIR,
  GLOBAL_SYMLINK_PATH,
  GLOBAL_SYMLINK_PARENT,
  inspectSymlink,
  listLocalAdapters,
} from "./shared/adapter-paths.ts";
import { listRawSlugs } from "../fetch-raw.ts";
import { opencliDoctorOk } from "../sites/_shared/browser-helpers.ts";

export interface DoctorOpts {
  fix?: boolean;
  verbose?: boolean;
}

export interface DoctorFinding {
  check: string;
  ok: boolean;
  summary: string;
  hint?: string;
}

export function runDoctor(opts: DoctorOpts = {}): { findings: DoctorFinding[]; exitCode: number } {
  const findings: DoctorFinding[] = [];

  // 1. opencli doctor
  const opencliOk = opencliDoctorOk();
  findings.push({
    check: "opencli-doctor",
    ok: opencliOk,
    summary: opencliOk
      ? "opencli daemon + extension connected"
      : "opencli doctor reports problems",
    hint: opencliOk ? undefined : "run `opencli doctor` for details; install or reconnect the Chrome extension",
  });

  // 2. wiki-custom symlink
  let symStatus = inspectSymlink();
  if (!symStatus.correct && opts.fix) {
    try {
      if (!existsSync(GLOBAL_SYMLINK_PARENT)) {
        mkdirSync(GLOBAL_SYMLINK_PARENT, { recursive: true });
      }
      if (existsSync(GLOBAL_SYMLINK_PATH)) {
        // Only unlink if it's a symlink (don't clobber a real directory)
        if (lstatSync(GLOBAL_SYMLINK_PATH).isSymbolicLink()) {
          unlinkSync(GLOBAL_SYMLINK_PATH);
        }
      }
      if (!existsSync(GLOBAL_SYMLINK_PATH)) {
        symlinkSync(LOCAL_ADAPTERS_DIR, GLOBAL_SYMLINK_PATH, "dir");
      }
      symStatus = inspectSymlink();
    } catch (err) {
      findings.push({
        check: "wiki-custom-symlink",
        ok: false,
        summary: `--fix failed: ${(err as Error).message}`,
        hint: `create manually: ln -sfn ${LOCAL_ADAPTERS_DIR} ${GLOBAL_SYMLINK_PATH}`,
      });
    }
  }
  findings.push({
    check: "wiki-custom-symlink",
    ok: symStatus.correct,
    summary: symStatus.summary,
    hint: symStatus.correct
      ? undefined
      : `run \`hirono doctor --fix\` to create; or manually: ln -sfn ${LOCAL_ADAPTERS_DIR} ${GLOBAL_SYMLINK_PATH}`,
  });

  // 3. Adapter file validity (load-check each .js)
  const adapters = listLocalAdapters();
  if (adapters.length === 0) {
    findings.push({
      check: "adapter-files",
      ok: true,
      summary: `no adapters authored yet (${LOCAL_ADAPTERS_DIR} is empty — that's fine)`,
    });
  } else {
    const adapterIssues: string[] = [];
    for (const a of adapters) {
      // Use node --check for syntax validation (doesn't execute the module)
      const res = spawnSync("node", ["--check", a.path], { encoding: "utf8", timeout: 5000 });
      if (res.status !== 0) {
        adapterIssues.push(`${a.site}/${a.name}.js: ${(res.stderr || "").slice(0, 200)}`);
      }
    }
    findings.push({
      check: "adapter-files",
      ok: adapterIssues.length === 0,
      summary: adapterIssues.length === 0
        ? `${adapters.length} adapter file(s) pass node --check`
        : `${adapterIssues.length} of ${adapters.length} adapter(s) have syntax errors`,
      hint: adapterIssues.length > 0 ? adapterIssues.join("\n         ") : undefined,
    });
  }

  // 4. raw/ quality — surface non-good sources for user awareness
  const rawSlugs = listRawSlugs();
  const nonGood = rawSlugs.filter((s) => s.quality_status !== "good");
  findings.push({
    check: "raw-quality",
    ok: nonGood.length === 0,
    summary: nonGood.length === 0
      ? `all ${rawSlugs.length} raw/ sources clean (quality_status=good)`
      : `${nonGood.length} of ${rawSlugs.length} raw/ sources need attention (flagged/failed)`,
    hint: nonGood.length > 0
      ? `run \`hirono raindrop export <slug>\` to refetch with post-processors; slugs: ${nonGood.slice(0, 5).map((s) => s.slug).join(", ")}${nonGood.length > 5 ? "..." : ""}`
      : undefined,
  });

  const exitCode = findings.some((f) => !f.ok) ? 1 : 0;
  return { findings, exitCode };
}

export function printFindings(findings: DoctorFinding[]): void {
  for (const f of findings) {
    const mark = f.ok ? "✓" : "✗";
    console.log(`${mark} ${f.check.padEnd(22)} ${f.summary}`);
    if (f.hint) console.log(`    → ${f.hint}`);
  }
}

export function main(argv: string[]): void {
  const fix = argv.includes("--fix");
  const verbose = argv.includes("--verbose");
  const { findings, exitCode } = runDoctor({ fix, verbose });
  printFindings(findings);
  process.exit(exitCode);
}
