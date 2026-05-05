#!/usr/bin/env tsx
// Surface raindrop bookmarks that are likely duplicates beyond exact-URL match.
// Heuristics:
//   1. Same normalized title (case-insensitive, trimmed) across different URLs
//   2. xhslink + xiaohongshu pairs that share a normalized title
//   3. Same wiki path on deepwiki.com + wiki.litenext.digital
//   4. Same path on multiple feishu host mirrors
//
// Usage: npx tsx tools/find-dupes.ts
// Output: markdown table per category, with bookmark IDs so the user can
// pick which to delete.

import { readFileSync } from "node:fs";

interface Bookmark { bookmark_id: number; title: string; link: string; created?: string }
interface Cache { bookmarks: Bookmark[] }

const cache: Cache = JSON.parse(readFileSync(".wiki-raindrop-cache.json", "utf8"));

function normTitle(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, " ").replace(/[「」『』""''《》()()【】\[\]]/g, "");
}

function host(u: string): string {
  try { return new URL(u).hostname; } catch { return ""; }
}

function path(u: string): string {
  try { return new URL(u).pathname; } catch { return ""; }
}

// 1. Same normalized title
const byTitle = new Map<string, Bookmark[]>();
for (const b of cache.bookmarks) {
  if (!b.title || b.title.length < 8) continue;  // skip short/empty titles
  const k = normTitle(b.title);
  if (!k) continue;
  const list = byTitle.get(k) ?? [];
  list.push(b);
  byTitle.set(k, list);
}
const titleDupes = [...byTitle.entries()]
  .filter(([_, arr]) => arr.length > 1)
  .sort((a, b) => b[1].length - a[1].length);

console.log(`# Likely duplicate bookmarks\n`);
console.log(`Cache: ${cache.bookmarks.length} bookmarks\n`);

console.log(`## 1. Same title across different URLs (${titleDupes.length} groups)\n`);
if (titleDupes.length === 0) {
  console.log(`_None._\n`);
} else {
  for (const [t, arr] of titleDupes.slice(0, 50)) {
    console.log(`**${t}**`);
    for (const b of arr) {
      console.log(`  - \`${b.bookmark_id}\` ${host(b.link)}${path(b.link).slice(0, 60)} — ${(b.created ?? "").slice(0, 10)}`);
    }
    console.log();
  }
  if (titleDupes.length > 50) console.log(`_(+${titleDupes.length - 50} more groups)_\n`);
}

// 2. deepwiki.com + wiki.litenext.digital path overlap
const byDeepwikiPath = new Map<string, Bookmark[]>();
for (const b of cache.bookmarks) {
  const h = host(b.link);
  const p = path(b.link).replace(/^\/wiki\//, "/").toLowerCase();
  if (h === "deepwiki.com" || h === "wiki.litenext.digital") {
    const key = p.split("?")[0].split("#")[0];
    if (!key || key === "/") continue;
    const list = byDeepwikiPath.get(key) ?? [];
    list.push(b);
    byDeepwikiPath.set(key, list);
  }
}
const deepwikiDupes = [...byDeepwikiPath.entries()].filter(([_, arr]) => arr.length > 1);
console.log(`## 2. Same path on deepwiki.com vs wiki.litenext.digital (${deepwikiDupes.length} groups)\n`);
if (deepwikiDupes.length === 0) console.log(`_None — different paths or only one host has each._\n`);
else {
  for (const [p, arr] of deepwikiDupes) {
    console.log(`**path \`${p}\`**`);
    for (const b of arr) console.log(`  - \`${b.bookmark_id}\` ${host(b.link)} — ${b.title?.slice(0, 60)}`);
    console.log();
  }
}

// 3. Bookmarks where short URL → long URL pair
//    (different hosts, same normalized title)
const xhsDupes = titleDupes.filter(([_, arr]) => {
  const hosts = new Set(arr.map((b) => host(b.link)));
  return hosts.has("xhslink.com") && (hosts.has("www.xiaohongshu.com") || hosts.has("xiaohongshu.com"));
});
console.log(`## 3. xhslink shortlink ↔ xiaohongshu canonical with same title (${xhsDupes.length} pairs)\n`);
if (xhsDupes.length === 0) console.log(`_None._\n`);
else {
  for (const [t, arr] of xhsDupes.slice(0, 30)) {
    console.log(`**${t}**`);
    for (const b of arr) console.log(`  - \`${b.bookmark_id}\` ${host(b.link)} — ${b.link}`);
    console.log();
  }
}
