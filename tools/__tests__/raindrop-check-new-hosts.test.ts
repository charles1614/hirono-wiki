/**
 * Tests for the "new hosts since last check" / "new_singletons" surface
 * added to `hirono raindrop check`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { buildReport, formatReport, type CheckReport } from "../hirono/raindrop/check.ts";

// Ad-hoc helper to build a fake Cache fixture.
function fakeCache(bookmarks: Array<{ url: string; id: number }>) {
  return {
    bookmarks: bookmarks.map(b => ({
      bookmark_id: b.id,
      link: b.url,
      title: `bm-${b.id}`,
      tags: [],
      created: "2026-05-08T00:00:00Z",
    })),
  };
}

test("buildReport: surfaces new_singletons when host is missing from prior snapshot AND count==1", () => {
  // We can't easily inject a custom snapshot without monkey-patching
  // HOST_COUNTS_PATH. Instead, test the data-shape contract: when the
  // current cache has hosts not present in the saved snapshot, they
  // surface in `new_singletons` (count==1) or `brand_new` (count>=2).
  // Use the real loader (it reads tools/opencli/host-counts.json) — if
  // that file lists a known host like xhslink.com, we know the fixture
  // path works.
  const cache = fakeCache([
    { id: 1, url: "https://xhslink.com/o/abc" },        // existing host (should NOT be new)
    { id: 2, url: "https://newhostA.example/post" },    // new host, count 1
    { id: 3, url: "https://newhostB.example/post1" },   // new host, count 2
    { id: 4, url: "https://newhostB.example/post2" },
  ]);
  const report = buildReport(cache as any);

  // newhostA.example: present once, missing from prior snapshot → new_singleton
  const newA = report.new_singletons.find(g => g.hostname === "newhosta.example");
  assert.ok(newA, "newhostA.example should be in new_singletons");
  assert.equal(newA!.current_count, 1);

  // newhostB.example: present twice → brand_new (not new_singleton)
  const newB = report.brand_new.find(g => g.hostname === "newhostb.example");
  assert.ok(newB, "newhostB.example should be in brand_new (count >= 2)");
  assert.equal(report.new_singletons.find(g => g.hostname === "newhostb.example"), undefined);

  // xhslink.com: present in prior snapshot → not in either
  assert.equal(report.new_singletons.find(g => g.hostname === "xhslink.com"), undefined);
  assert.equal(report.brand_new.find(g => g.hostname === "xhslink.com"), undefined);
});

test("formatReport: 'New hosts since last check' section renders with count + table", () => {
  const report: CheckReport = {
    total_bookmarks: 5,
    unique_urls: 5,
    unique_hosts: 5,
    duplicates: [],
    hosts: [],
    uncovered_high_frequency: [],
    graduations: [],
    brand_new: [],
    new_singletons: [
      { hostname: "newsite.io", previous_count: 0, current_count: 1 },
      { hostname: "another.dev", previous_count: 0, current_count: 1 },
    ],
  };
  const md = formatReport(report);
  assert.match(md, /## New hosts since last check \(2\)/);
  assert.match(md, /\| newsite\.io \| 1 \|/);
  assert.match(md, /\| another\.dev \| 1 \|/);
  // Should also include the operator-actionable hint
  assert.match(md, /raindrop status --filter not-yet-fetched/);
});

test("formatReport: 'No new hosts' message when new_singletons empty", () => {
  const report: CheckReport = {
    total_bookmarks: 0, unique_urls: 0, unique_hosts: 0,
    duplicates: [], hosts: [], uncovered_high_frequency: [],
    graduations: [], brand_new: [], new_singletons: [],
  };
  const md = formatReport(report);
  assert.match(md, /## New hosts since last check \(0\)\n_No new hosts\._/);
});
