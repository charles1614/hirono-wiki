#!/usr/bin/env tsx
// snapshot-create — fetch a sample URL, apply the post-processor pipeline,
// land the result as a per-host snapshot + invariants sidecar, and print
// the final invariants for review.
//
// Usage:
//   npx tsx tools/__tests__/snapshot-create.ts <url> --slug <slug>
//
// Effects:
//   - Calls fetch-raw.ts fetch-url to land raw output under raw/2026/<slug>/
//   - Reads back, runs applyPostProcessors against origin URL
//   - Derives host from URL → tools/__tests__/snapshots/<host>/<slug>.md
//   - Writes <slug>.invariants.json sidecar
//   - Cleans up raw/2026/<slug>/ (we don't keep ad-hoc fetches)
//   - Prints invariants + first/last 30 lines of snapshot for the operator
//     to eye-read.
//
// On invariants check failure (h1 != 1, missing frontmatter, remote
// images, chrome denylist matches), exits non-zero.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { applyPostProcessors } from "../hirono/shared/post-process.ts";
import { countFeatures, writeInvariants } from "./snapshot-helpers.ts";

const args = process.argv.slice(2);
const slugIdx = args.indexOf("--slug");
if (slugIdx < 0 || args.length < 3) {
  console.error("usage: snapshot-create.ts <url> --slug <slug>");
  process.exit(2);
}
const url = args[0];
const slug = args[slugIdx + 1];
if (!url || !slug) {
  console.error("usage: snapshot-create.ts <url> --slug <slug>");
  process.exit(2);
}

let host: string;
try {
  host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
} catch {
  console.error(`bad url: ${url}`);
  process.exit(2);
}

const slugDir = `raw/2026/${slug}`;
console.log(`[1/4] fetch ${url} → ${slugDir}`);
try {
  execSync(`npx tsx tools/fetch-raw.ts fetch-url "${url.replace(/"/g, '\\"')}" --slug ${slug} --force`, { stdio: "inherit" });
} catch (e) {
  console.error(`[fetch] failed`);
  process.exit(1);
}

const contentPath = join(slugDir, "content.md");
const sourcePath = join(slugDir, "source.json");
if (!existsSync(contentPath) || !existsSync(sourcePath)) {
  console.error(`[fetch] no output at ${slugDir}`);
  process.exit(1);
}

const rawMd = readFileSync(contentPath, "utf8");
const src = JSON.parse(readFileSync(sourcePath, "utf8"));
const originUrl: string = src.origin_url ?? url;
const qStatus: string = src.quality_status ?? "";
const cLen: number = src.content_length ?? 0;

console.log(`[2/4] sample-validity gate: quality_status=${qStatus} content_length=${cLen}`);
const flags: string[] = src.quality_flags ?? [];
const stubFlags = new Set(["intentional-stub", "xhs-text-body-unavailable", "auto-skipped-hf-space"]);
const isStub = flags.some((f: string) => stubFlags.has(f));
if (!isStub && (qStatus !== "good" || cLen < 2000)) {
  console.error(`[gate] sample fails validity (need status=good AND length>2000, OR intentional-stub)`);
  console.error(`       got status=${qStatus} length=${cLen} flags=${flags.join(",")}`);
  process.exit(1);
}

console.log(`[3/4] apply post-processors`);
const r = applyPostProcessors(rawMd, originUrl);
console.log(`     applied: ${r.appliedNames.join(", ") || "(none)"}`);

const snapDir = `tools/__tests__/snapshots/${host}`;
mkdirSync(snapDir, { recursive: true });
const snapPath = `${snapDir}/${slug}.md`;
writeFileSync(snapPath, r.md);
const inv = countFeatures(r.md);
writeInvariants(snapPath, inv);

console.log(`[4/4] snapshot → ${snapPath}`);
console.log(`     invariants: ${JSON.stringify(inv)}`);
console.log("");
console.log("--- TOP 30 ---");
console.log(r.md.split("\n").slice(0, 30).join("\n"));
console.log("--- TAIL 30 ---");
console.log(r.md.split("\n").slice(-30).join("\n"));

// Hard rules
const fail: string[] = [];
if (inv.h1 !== 1) fail.push(`h1=${inv.h1} (expected 1)`);
if (!inv.frontmatter_present) fail.push(`'> 原文链接:' not in first 10 lines`);
if (inv.remote_images > 0) fail.push(`remote-image refs = ${inv.remote_images} (expected 0)`);
if (inv.chrome_denylist_matches > 0) fail.push(`chrome denylist matches = ${inv.chrome_denylist_matches} (expected 0)`);

// Cleanup raw fetch dir — we keep snapshots, not ad-hoc fetches
try { rmSync(slugDir, { recursive: true, force: true }); } catch {}

if (fail.length > 0) {
  console.error("");
  console.error("FAIL:");
  for (const f of fail) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("");
console.log("✓ snapshot accepted; commit to lock it in.");
