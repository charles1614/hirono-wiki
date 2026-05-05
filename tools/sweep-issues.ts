#!/usr/bin/env tsx
// Sweep every landed raw/2026/<slug>/content.md and post-process it,
// flag per-file §1 / §3 contract violations grouped by host.
//
// Usage: npx tsx tools/sweep-issues.ts

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { applyPostCleanups } from "./sites/_shared/post-cleanup.ts";

interface Issue { slug: string; host: string; problems: string[]; status: string }

const RAW = "raw/2026";
const entries = readdirSync(RAW).filter((n) => {
  const p = join(RAW, n);
  try { return readFileSync(join(p, "content.md"), "utf8").length > 0; } catch { return false; }
});

const issues: Issue[] = [];
const byHost = new Map<string, Issue[]>();

for (const slug of entries) {
  const contentPath = join(RAW, slug, "content.md");
  const srcPath = join(RAW, slug, "source.json");
  if (!existsSync(contentPath) || !existsSync(srcPath)) continue;
  const md = readFileSync(contentPath, "utf8");
  const src = JSON.parse(readFileSync(srcPath, "utf8"));
  const url: string = src.origin_url ?? "";
  let host = "";
  try { host = new URL(url).hostname; } catch {}
  const status: string = src.quality_status ?? "";
  const flags: string[] = src.quality_flags ?? [];
  // Treat xhs-text-body-unavailable as a soft stub: the post body is
  // genuinely auth-gated by xhs and we've emitted a degraded stub message.
  // Same for other "content unavailable" auth-gating flags.
  const stubLikeFlags = new Set([
    "intentional-stub",
    "xhs-text-body-unavailable",
    "auto-skipped-hf-space",
  ]);
  const intentionalStub = flags.some((f) => stubLikeFlags.has(f));

  const r = applyPostCleanups(md, url);
  const final = r.md;

  const problems: string[] = [];

  const h1 = (() => {
    const lines = final.split("\n");
    let inFence = false;
    let n = 0;
    for (const l of lines) {
      if (/^```/.test(l.trim())) inFence = !inFence;
      else if (!inFence && /^# /.test(l)) n++;
    }
    return n;
  })();
  if (h1 !== 1 && !intentionalStub) problems.push(`h1=${h1}`);

  const remote = (final.match(/!\[[^\]]*\]\(https?:\/\//g) || []).length;
  if (remote > 0) problems.push(`remote-img=${remote}`);

  if (!intentionalStub && flags.length > 0) {
    // Filter out stub-like flags from the noise — they're not bugs.
    const realFlags = flags.filter((f) => !stubLikeFlags.has(f));
    if (realFlags.length > 0) problems.push(`flags=${realFlags.join(",")}`);
  }

  // Look for obvious chrome signatures in top-30 lines (post-processed)
  const top30 = final.split("\n").slice(0, 30).join("\n");
  const chromeSignatures = [
    { name: "share-widget-lines", re: /^\s*(Share|Copy link|Subscribe)\s*$/m },
    { name: "sidebar-nav-heading", re: /^(Menu|## On this page|### On this page|表of contents)\s*$/m },
    // discourse-emoji must be a paragraph that contains ONLY a `:name:`
    // shortcode token (with optional surrounding whitespace), not a substring
    // appearing inside a URL like `:dongfengweixiao:`.
    { name: "discourse-emoji-shortcode", re: /^\s*:\w{3,20}:\s*$/m },
  ];
  for (const { name, re } of chromeSignatures) {
    if (re.test(top30)) problems.push(name);
  }

  if (problems.length > 0) {
    const iss: Issue = { slug, host, problems, status };
    issues.push(iss);
    const list = byHost.get(host) ?? [];
    list.push(iss);
    byHost.set(host, list);
  }
}

// Print by-host summary
const hostsSorted = [...byHost.keys()].sort((a, b) => (byHost.get(b)!.length - byHost.get(a)!.length));
console.log(`\nSwept ${entries.length} slugs. Issues in ${issues.length}/${entries.length} files across ${byHost.size} hosts.\n`);
for (const h of hostsSorted) {
  const list = byHost.get(h)!;
  console.log(`## ${h}  (${list.length} file(s))`);
  for (const iss of list.slice(0, 3)) {
    console.log(`  - ${iss.slug.slice(0, 60).padEnd(62)} ${iss.problems.join(" / ")}`);
  }
  if (list.length > 3) console.log(`  ... +${list.length - 3} more`);
  console.log();
}
