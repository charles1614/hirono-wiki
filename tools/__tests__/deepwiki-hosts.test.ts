/**
 * DeepWiki host move: the legacy host stays recognisable (dedupe, archives)
 * but never receives a request. Egress is asserted with fake `curl` and
 * `opencli` binaries on PATH, so this file needs no network.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEEPWIKI_HOST as NEW,
  DEEPWIKI_LEGACY_HOSTS,
  currentDeepwikiUrl,
  isDeepwikiLitenextUrl,
} from "../shared/deepwiki-hosts.ts";
import { normalizeUrl } from "../bin/build-sources-index.ts";
import { cmdPlan } from "../bin/ingest_batch.ts";
import { isInSkipList } from "../curation.ts";
import {
  buildSyncPlan,
  classifyQuality,
  downloadImage,
  headCheck,
  rawDirFor,
  rebuildRawIndex,
} from "../fetch-raw.ts";
import { buildReport } from "../hirono/raindrop/check.ts";
import { forget } from "../hirono/raindrop/forget.ts";
import { findNewBookmarks } from "../hirono/raindrop/new-bookmarks.ts";
import { buildStatusRows } from "../hirono/raindrop/status.ts";
import { routeSite } from "../sites/index.ts";
import { testHooks } from "../sites/deepwiki-litenext/test-hooks.ts";

const OLD = DEEPWIKI_LEGACY_HOSTS[0];
const SLUG = "2026-01-20-deepwiki-jax";
const PATH = "/wiki/jax?file=01-overview";
const oldUrl = `https://${OLD}${PATH}`;
const newUrl = `https://${NEW}${PATH}`;

const LEGACY_SPELLINGS = [
  oldUrl,
  `http://${OLD}${PATH}`,
  `https://www.${OLD}${PATH}`,
  `https://${OLD}.${PATH}`,
  `https://${OLD.toUpperCase()}${PATH}`,
  `https://user:pw@${OLD}:8443${PATH}`,
];

function withTemp(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "deepwiki-hosts-"));
  try { fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

/** A pre-move archive, plus a sources index built before the move. */
function seedArchive(dir: string) {
  const rawRoot = join(dir, "raw");
  const slugDir = join(rawRoot, "raindrop", OLD, SLUG);
  mkdirSync(slugDir, { recursive: true });
  writeFileSync(join(slugDir, "content.md"), "# JAX\n");
  writeFileSync(join(slugDir, "source.json"), JSON.stringify({
    origin: `url:${oldUrl}`,
    origin_url: oldUrl,
    quality_status: "good",
    quality_flags: [],
    images: [],
  }));
  const index = join(dir, "index.json");
  writeFileSync(index, JSON.stringify({
    [oldUrl]: { slug: SLUG, repo_path: `03_Sources/2026/${SLUG}.md`, source_url: oldUrl, ingested_at: "2026-05-15" },
  }));
  const cache = join(dir, "cache.json");
  writeFileSync(cache, JSON.stringify({ bookmarks: [{ bookmark_id: 1, title: "JAX", link: newUrl }] }));
  return { rawRoot, slugDir, index, cache };
}

test("deepwiki host: every legacy spelling maps to https on the current host", () => {
  for (const url of LEGACY_SPELLINGS) {
    assert.equal(currentDeepwikiUrl(url), newUrl, url);
    assert.equal(routeSite(url).name, "deepwiki-litenext", url);
  }
  assert.equal(currentDeepwikiUrl(`${oldUrl}#section`), `${newUrl}#section`);
  assert.equal(routeSite(newUrl).name, "deepwiki-litenext");
});

test("deepwiki host: look-alike and unrelated URLs are untouched", () => {
  for (const url of [
    `https://hirono-${OLD}/a.png`,
    `https://${OLD}.example.com/wiki`,
    `https://${OLD}@example.com/wiki`,
    `https://example.com/?u=${oldUrl}`,
    "https://deepwiki.com/google/jax",
    "not a url",
  ]) {
    assert.equal(currentDeepwikiUrl(url), url);
    assert.equal(isDeepwikiLitenextUrl(url), false, url);
  }
});

test("deepwiki host: both hosts share one identity and one quality floor", () => {
  assert.equal(normalizeUrl(oldUrl), normalizeUrl(newUrl));
  const body = `# T\n\n## H\n\n${"word ".repeat(150)}`;
  for (const originUrl of [oldUrl, newUrl]) {
    assert.ok(classifyQuality(body, { originUrl }).flags.includes("below-host-expected-size"), originUrl);
  }
  assert.ok(isInSkipList(newUrl, [{ key: oldUrl, reason: "duplicate", rationale: "" }]));
});

test("deepwiki host: existing archives keep their dir, new ones use the current host", () => {
  withTemp((dir) => {
    const { rawRoot, slugDir } = seedArchive(dir);
    for (const url of [oldUrl, newUrl]) {
      assert.equal(rawDirFor(SLUG, url, rawRoot), slugDir);
      assert.equal(rawDirFor("new-slug", url, rawRoot), join(rawRoot, "raindrop", NEW, "new-slug"));
    }
  });
});

test("deepwiki host: a pre-move sources index still freezes and dedupes", () => {
  withTemp((dir) => {
    const { rawRoot, index, cache } = seedArchive(dir);
    const none = join(dir, "none");

    const plan = buildSyncPlan({
      retryFlagged: true, dryRun: true, reclassify: false,
      rawRoot, sourcesIndexPath: index, ingestBatchPath: none, decisionsPath: none, healthOverridesPath: none,
    });
    assert.deepEqual(plan.map((p) => p.action), ["skip-frozen-slug"]);

    assert.deepEqual(findNewBookmarks({ raindropCachePath: cache, sourcesIndexPath: index }), []);

    const rows = buildStatusRows({ raindropCachePath: cache, sourcesIndexPath: index, overridesPath: none, rawDir: rawRoot });
    assert.equal(rows.length, 1, "bookmark and archive are one row");
    assert.equal(rows[0].slug, SLUG);

    const candidates = join(dir, "candidates.json");
    writeFileSync(candidates, JSON.stringify([{ id: "jax", url: newUrl }]));
    const planned = cmdPlan(candidates, { state: join(dir, "state.json"), sourcesIndex: index });
    assert.equal(planned.dedupedByUrl, 1);

    const entry = rebuildRawIndex(rawRoot, cache, index).slugs[SLUG];
    assert.equal(entry.bookmark_id, 1);
    assert.equal(entry.state, "ingested");
  });
});

test("deepwiki host: forget finds a legacy archive by its current URL", () => {
  withTemp((dir) => {
    seedArchive(dir);
    assert.equal(forget(dir, newUrl, { reason: "test" }).slug, SLUG);
  });
});

test("deepwiki host: the watchdog reports both hosts as the current one", () => {
  const report = buildReport({
    fetched_at: "", total: 2,
    bookmarks: [{ bookmark_id: 1, title: "a", link: oldUrl }, { bookmark_id: 2, title: "b", link: newUrl }],
  });
  assert.deepEqual(report.hosts.map((h) => [h.hostname, h.count]), [[NEW, 2]]);
  assert.equal(report.duplicates.length, 1);
});

test("deepwiki host: no fetch path sends a request to the legacy host", () => {
  withTemp((dir) => {
    const log = join(dir, "egress.log");
    for (const bin of ["curl", "opencli"]) {
      const path = join(dir, bin);
      writeFileSync(path, `#!/bin/sh\necho "${bin} $*" >> "${log}"\nexit 22\n`);
      chmodSync(path, 0o755);
    }
    const savedPath = process.env.PATH;
    process.env.PATH = `${dir}${delimiter}${savedPath}`;
    try {
      for (const url of LEGACY_SPELLINGS) {
        downloadImage(url, join(dir, "img.png"));
        headCheck(url);
        assert.throws(() => testHooks.capture(url), /browser open failed/);
        routeSite(url).fetch(url, { slugDir: join(dir, "out") });
      }
    } finally {
      process.env.PATH = savedPath;
    }
    assert.ok(existsSync(log), "fake binaries were invoked");
    const calls = readFileSync(log, "utf8").trim().split("\n");
    assert.equal(calls.length, LEGACY_SPELLINGS.length * 4);
    for (const call of calls) {
      assert.ok(!call.toLowerCase().includes(OLD), call);
      assert.ok(call.includes(newUrl), call);
    }
  });
});

test("deepwiki host: every legacy domain still resolves, not only the newest", () => {
  for (const host of DEEPWIKI_LEGACY_HOSTS) {
    assert.equal(currentDeepwikiUrl(`https://${host}${PATH}`), newUrl, host);
    withTemp((dir) => {
      const slugDir = join(dir, "raindrop", host, SLUG);
      mkdirSync(slugDir, { recursive: true });
      assert.equal(rawDirFor(SLUG, newUrl, dir), slugDir);
    });
  }
});

test("deepwiki host: the domain is written only in site.json", () => {
  const tools = fileURLToPath(new URL("..", import.meta.url));
  const site = JSON.parse(readFileSync(join(tools, "shared", "site.json"), "utf8"));
  const domains: string[] = [site.baseDomain, ...site.legacyBaseDomains];
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === "__tests__") continue;
      const path = join(dir, e.name);
      if (e.isDirectory()) walk(path);
      else if (e.name.endsWith(".ts") && domains.some((d) => readFileSync(path, "utf8").includes(d))) offenders.push(path);
    }
  };
  walk(tools);
  assert.deepEqual(offenders, []);
});
