#!/usr/bin/env tsx
// snapshot-create — fetch a sample URL, apply the post-processor pipeline,
// land the result as a per-host snapshot + invariants sidecar, and print
// the final invariants for review.
//
// Usage:
//   npx tsx tools/__tests__/snapshot-create.ts <url> --slug <slug>
//
// Effects:
//   - Calls `hirono raindrop fetch` to land raw output under raw/2026/<slug>/.
//     The fetch path applies applyPostCleanups via transformMarkdown (see
//     hirono/raindrop/export.ts); we then run applyPostCleanups again at
//     line 127 below — both passes are idempotent so the snapshot is the
//     same as if we'd applied cleanups once.
//   - Reads back, runs applyPostCleanups against origin URL
//   - Derives host from URL → tools/__tests__/snapshots/<host>/<slug>.md
//   - Writes <slug>.invariants.json sidecar
//   - Cleans up raw/2026/<slug>/ (we don't keep ad-hoc fetches)
//   - Prints invariants + first/last 30 lines of snapshot for the operator
//     to eye-read.
//
// On invariants check failure (h1 != 1, missing frontmatter, remote
// images, chrome denylist matches), exits non-zero.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { applyPostCleanups } from "../sites/_shared/post-cleanup.ts";
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
  // Feishu wikis are hosted under per-tenant subdomains (e.g.
  // d0a901er7io.feishu.cn, scnajei2ds6y.feishu.cn). Treat the whole
  // .feishu.cn family as a single host bucket for snapshot organization
  // so they don't sprawl across one dir per tenant.
  if (/\.feishu\.cn$/i.test(host)) host = "feishu.cn";
} catch {
  console.error(`bad url: ${url}`);
  process.exit(2);
}

// Compute the raw landing dir using the same hostname-keyed scheme that
// `tools/fetch-raw.ts` uses for writes: raw/raindrop/<host>/<slug>/.
// `host` here is already normalized (lowercased, www-stripped, feishu
// folded). The fetcher uses `hostnameOf(originUrl)`; the two must agree
// to find the output. For feishu the URL host stays the per-tenant
// subdomain, so look up via the live host instead of the folded one.
const fetcherHost = (() => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch { return host; }
})();
const slugDir = `raw/raindrop/${fetcherHost}/${slug}`;
console.log(`[1/4] fetch ${url} → ${slugDir}`);
try {
  execSync(
    `npx tsx tools/bin/hirono.ts raindrop fetch "${url.replace(/"/g, '\\"')}" --slug ${slug} --force`,
    { stdio: "inherit" },
  );
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
const stubFlags = new Set([
  "intentional-stub",
  "xhs-text-body-unavailable",
  "auto-skipped-hf-space",
  "feishu-auth-gated",
  "reddit-deleted",
  "reddit-blocked",
  "arxiv-pdf",
  "arxiv-listing",
  "huggingface-non-blog",
  "huggingface-space",
  "x-twitter-auth-gated",
  "qwen-ai-spa",
]);
const isStub = flags.some((f: string) => stubFlags.has(f));
// Per-host minimum content lengths. Micro-post hosts (xhs, x.com) are
// LEGITIMATELY short — the gate must accept them. Long-form hosts get
// the standard 2000-char floor.
const MICRO_POST_HOSTS = new Set([
  "xhslink.com", "www.xiaohongshu.com", "xiaohongshu.com", "x.com", "twitter.com",
]);
// PR/issue/discussion bodies on github.com are often short by design
// (especially small bug-fix PRs). 1000-char floor catches genuinely empty
// pages without false-rejecting normal short PRs.
const GITHUB_HOSTS = new Set(["github.com"]);
// Feishu wiki pages can be legitimately short (focused fragments, glossary
// entries, single-table reference pages). 1000-char floor.
const isFeishu = /\.feishu\.cn$/i.test(host);
const minLen = MICRO_POST_HOSTS.has(host) || MICRO_POST_HOSTS.has(`www.${host}`)
  ? 500
  : GITHUB_HOSTS.has(host) || isFeishu ? 1000 : 2000;
if (!isStub && (qStatus !== "good" || cLen < minLen)) {
  console.error(`[gate] sample fails validity (need status=good AND length>${minLen}, OR intentional-stub)`);
  console.error(`       got status=${qStatus} length=${cLen} flags=${flags.join(",")}`);
  process.exit(1);
}

console.log(`[3/4] apply post-cleanups`);
const r = applyPostCleanups(rawMd, originUrl);
console.log(`     applied: ${r.appliedNames.join(", ") || "(none)"}`);

const snapDir = `tools/__tests__/snapshots/${host}`;
mkdirSync(snapDir, { recursive: true });
const snapPath = `${snapDir}/${slug}.md`;
writeFileSync(snapPath, r.md);
const inv = countFeatures(r.md);
writeInvariants(snapPath, inv);

// Copy raw images alongside snapshot so referenced files exist on disk.
// Snapshot becomes self-contained: <slug>.md, <slug>.invariants.json,
// <slug>-images/*. Walks every local image ref in the markdown, resolves
// it against raw/<slug>/, copies into <slug>-images/, and rewrites the ref
// to point at the bundled copy. Handles both `images/foo.jpg` (weixin,
// zhihu pattern) and bare `foo.jpg` (xhs/xiaohongshu pattern).
const snapImageDir = `${snapDir}/${slug}-images`;
const refsToRewrite = new Map<string, string>(); // raw ref → new ref
let copiedImages = 0;
let totalBytes = 0;
const missingRefs: string[] = [];
const localRefs = new Set<string>();
// Strip inline-code spans + fenced code blocks BEFORE scanning, so literal
// markdown-syntax examples (e.g. sspai's `![$fileName]($url)` config docs)
// don't false-positive as real image refs.
const scrubbed = scrubCodeForImageScan(r.md);
for (const m of scrubbed.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
  const ref = m[1];
  if (/^https?:\/\//i.test(ref)) continue;
  if (ref.startsWith("data:")) continue;
  localRefs.add(ref);
}
// Clean the images dir unconditionally so re-captures don't leave
// orphan files from the previous capture. (Previously this only
// fired when localRefs.size > 0, which left old images behind when
// the new converter output had zero image refs.)
rmSync(snapImageDir, { recursive: true, force: true });
if (localRefs.size > 0) {
  mkdirSync(snapImageDir, { recursive: true });
  for (const ref of localRefs) {
    const src = join(slugDir, ref);
    if (!existsSync(src)) { missingRefs.push(ref); continue; }
    const baseName = ref.split("/").pop()!;
    const dst = join(snapImageDir, baseName);
    copyFileSync(src, dst);
    totalBytes += statSync(dst).size;
    copiedImages++;
    refsToRewrite.set(ref, `${slug}-images/${baseName}`);
  }
}
if (refsToRewrite.size > 0) {
  let rewritten = r.md;
  // Sort longest-first so partial-prefix refs don't collide.
  const sortedRefs = [...refsToRewrite.keys()].sort((a, b) => b.length - a.length);
  for (const ref of sortedRefs) {
    const newRef = refsToRewrite.get(ref)!;
    const escaped = ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Match `(ref)` and `(ref "title")` — keep title attribute when rewriting.
    rewritten = rewritten.replace(
      new RegExp(`!\\[([^\\]]*)\\]\\(${escaped}(\\s+"[^"]*")?\\)`, "g"),
      (_full, alt: string, title: string | undefined) => `![${alt}](${newRef}${title || ""})`,
    );
  }
  writeFileSync(snapPath, rewritten);
}

console.log(`[4/4] snapshot → ${snapPath}`);
console.log(`     invariants: ${JSON.stringify(inv)}`);
if (copiedImages > 0) {
  console.log(`     images: ${copiedImages} files, ${(totalBytes / 1024).toFixed(0)}KB → ${snapImageDir}/`);
}
console.log("");
console.log("--- TOP 30 ---");
console.log(r.md.split("\n").slice(0, 30).join("\n"));
console.log("--- TAIL 30 ---");
console.log(r.md.split("\n").slice(-30).join("\n"));

// Hard rules — keep in sync with per-host-snapshot.test.ts hard-rule asserts.
// Recompute invariants from the FINAL on-disk markdown (after image-ref
// rewriting above) so we catch any bug introduced by the rewrite pass too.
const finalInv = countFeatures(readFileSync(snapPath, "utf8"));
// Stamp the source URL into the sidecar so check-drift.ts knows what to
// re-fetch. Existing pre-source_url sidecars will be backfilled on the
// next snapshot refresh through this path.
finalInv.source_url = url;
writeInvariants(snapPath, finalInv);
const fail: string[] = [];
if (finalInv.h1 !== 1) fail.push(`h1=${finalInv.h1} (expected 1)`);
if (!finalInv.frontmatter_present) fail.push(`'> 原文链接:' not in first 10 lines`);
if (finalInv.unbalanced_bold_runs > 0) fail.push(`${finalInv.unbalanced_bold_runs} line(s) with unbalanced bold (3+ stars OR odd \`**\` count) — see CLAUDE.md §4 mdnice recipe`);
if (finalInv.empty_headings > 0) fail.push(`${finalInv.empty_headings} empty heading line(s) like '## '`);
if (finalInv.splicer_appendix_markers > 0) fail.push(`${finalInv.splicer_appendix_markers} '附录（位置未识别）' marker(s) — splicer fallback fired`);
if (finalInv.remote_images > 0) fail.push(`remote-image refs = ${finalInv.remote_images} (expected 0)`);
if (finalInv.chrome_denylist_matches > 0) fail.push(`chrome denylist matches = ${finalInv.chrome_denylist_matches} (expected 0)`);

if (missingRefs.length > 0) {
  fail.push(`${missingRefs.length} image refs in markdown that aren't in raw/: ${missingRefs.slice(0, 3).join(", ")}${missingRefs.length > 3 ? "..." : ""} (adapter bug: emits ref but doesn't download file)`);
}

// Verify every image reference in the snapshot resolves to a real file.
const finalMd = readFileSync(snapPath, "utf8");
const danglingImages: string[] = [];
const scrubbedFinal = scrubCodeForImageScan(finalMd);
for (const m of scrubbedFinal.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
  const ref = m[1];
  if (/^https?:\/\//i.test(ref)) continue;
  if (ref.startsWith("data:")) continue;
  const abs = join(snapDir, ref);
  if (!existsSync(abs)) danglingImages.push(ref);
}

/** Strip fenced code blocks + inline code spans before scanning for
 *  image refs — markdown-syntax examples (`![$fileName]($url)`)
 *  inside code spans aren't real image refs. */
function scrubCodeForImageScan(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line.trim())) { inFence = !inFence; out.push(""); continue; }
    if (inFence) { out.push(""); continue; }
    out.push(line.replace(/`[^`\n]+`/g, ""));
  }
  return out.join("\n");
}
if (danglingImages.length > 0) {
  fail.push(`${danglingImages.length} dangling image refs in snapshot: ${danglingImages.slice(0, 3).join(", ")}${danglingImages.length > 3 ? "..." : ""}`);
}

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
