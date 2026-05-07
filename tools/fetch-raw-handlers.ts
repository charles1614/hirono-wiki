/**
 * CLI handler library for the Raindrop fetch pipeline.
 *
 * These functions are dispatched by `tools/bin/hirono.ts` for the
 * `hirono raindrop {fetch, refetch, sync, verify, status, store,
 * fetch-lark}` subcommands. They handle argv parsing + console output;
 * the underlying side-effecting logic lives in `tools/fetch-raw.ts`
 * (the library).
 *
 * No binary entry point — invoke via `hirono raindrop <subcommand>`.
 *
 * (Predecessor: `tools/bin/fetch-raw.ts`. Removed when the CLI was
 * consolidated under `hirono raindrop`.)
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  type FetchError,
  type FetcherKind,
  type LarkMeta,
  type RaindropMeta,
  type SourceJson,
  type StatusReport,
  type SyncPlanItem,
  buildStatusReport,
  buildSyncPlan,
  executeFetchPlanItem,
  fetchUrlAndStore,
  fetchViaLarkHirono,
  listRawSlugs,
  printStatusReport,
  rawDirFor,
  reclassifyRawSlug,
  writeRawArchive,
  yearForSlug,
} from "./fetch-raw.ts";

function argVal(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function argFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(2);
}

function readAll(path: string | undefined): string {
  if (path) return readFileSync(resolve(path), "utf8");
  // stdin
  const chunks: Buffer[] = [];
  const fs = require("node:fs") as typeof import("node:fs");
  const fd = 0;
  try {
    const buf = Buffer.alloc(65536);
    while (true) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (n === 0) break;
      chunks.push(Buffer.from(buf.subarray(0, n)));
    }
  } catch {}
  return Buffer.concat(chunks).toString("utf8");
}

export function cmdStore(positional: string[], args: string[]): void {
  const slug = positional[0];
  if (!slug) fail("hirono raindrop store: missing <slug>");
  const origin = argVal(args, "--origin");
  const originUrl = argVal(args, "--origin-url");
  if (!origin || !originUrl) fail("hirono raindrop store: --origin and --origin-url required");
  const input = argVal(args, "--input");
  const title = argVal(args, "--title");
  const raindropMetaPath = argVal(args, "--raindrop-meta");
  const larkMetaPath = argVal(args, "--lark-meta");
  const downloadImages = !argFlag(args, "--no-images");
  const force = argFlag(args, "--force");

  const rawMarkdown = readAll(input);
  if (!rawMarkdown.trim()) {
    console.error("hirono raindrop store: empty input — nothing to write");
    process.exit(2);
  }

  const raindropMeta = raindropMetaPath
    ? (JSON.parse(readFileSync(resolve(raindropMetaPath), "utf8")) as RaindropMeta)
    : undefined;
  const larkMeta = larkMetaPath
    ? (JSON.parse(readFileSync(resolve(larkMetaPath), "utf8")) as LarkMeta)
    : undefined;

  const fetcher: FetcherKind = origin.startsWith("raindrop:")
    ? "raindrop-mcp-piped"
    : origin.startsWith("lark:")
    ? "lark-hirono"
    : "url-static";
  const src = writeRawArchive({
    slug,
    origin: origin!,
    originUrl: originUrl!,
    rawMarkdown,
    title,
    fetcher,
    fetcherReason: "direct",
    raindropMeta,
    larkMeta,
    downloadImages,
    force,
  });
  console.log(`[store] raw/${yearForSlug(slug)}/${slug}/ (${src.content_length} chars, ${src.images.length} images, flags=${src.quality_flags.join(",") || "none"})`);
}

export function cmdFetchLark(positional: string[], args: string[]): void {
  const nodeToken = positional[0];
  if (!nodeToken) fail("hirono raindrop fetch-lark: missing <node-token>");
  const slug = argVal(args, "--slug");
  if (!slug) fail("hirono raindrop fetch-lark: --slug required");
  const downloadImages = !argFlag(args, "--no-images");
  const force = argFlag(args, "--force");

  const r = fetchViaLarkHirono(nodeToken);
  const src = writeRawArchive({
    slug,
    origin: `lark:${nodeToken}`,
    originUrl: `https://my.feishu.cn/wiki/${nodeToken}`,
    rawMarkdown: r.content,
    fetcher: "lark-hirono",
    fetcherReason: "direct",
    larkMeta: { node_token: nodeToken, title: r.title },
    downloadImages,
    force,
  });
  console.log(`[fetch-lark] raw/${yearForSlug(slug)}/${slug}/ (${src.content_length} chars, ${src.images.length} images)`);
}

export function cmdFetchUrl(positional: string[], args: string[]): void {
  const url = positional[0];
  if (!url) fail("hirono raindrop fetch: missing <url>");
  const slug = argVal(args, "--slug");
  if (!slug) fail("hirono raindrop fetch: --slug required");
  const viaBrowser = argFlag(args, "--via-browser");
  const downloadImages = !argFlag(args, "--no-images");
  const force = argFlag(args, "--force");

  const src = fetchUrlAndStore({ slug, url, viaBrowser, downloadImages, force });
  console.log(
    `[fetch-url] raw/${yearForSlug(slug)}/${slug}/ ` +
    `(fetcher=${src.fetcher} reason=${src.fetcher_reason} ${src.content_length} chars, ${src.images.length} images, flags=${src.quality_flags.join(",") || "none"})`,
  );
}

export function cmdVerify(positional: string[]): void {
  const slug = positional[0];
  if (!slug) fail("hirono raindrop verify: missing <slug>");
  const dir = rawDirFor(slug);
  const probs: string[] = [];
  if (!existsSync(dir)) probs.push(`dir missing: ${dir}`);
  if (!existsSync(join(dir, "content.md"))) probs.push(`content.md missing`);
  if (!existsSync(join(dir, "source.json"))) probs.push(`source.json missing`);
  else {
    try {
      const src = JSON.parse(readFileSync(join(dir, "source.json"), "utf8"));
      if (!src.origin || !src.fetcher) probs.push(`source.json missing required fields`);
    } catch (err) {
      probs.push(`source.json unparseable: ${(err as Error).message}`);
    }
  }
  if (probs.length === 0) {
    console.log(`[verify] ✓ ${slug}`);
    return;
  }
  console.error(`[verify] ✗ ${slug}`);
  for (const p of probs) console.error(`  - ${p}`);
  process.exit(1);
}

export function cmdStatus(args: string[]): void {
  const quiet = argFlag(args, "--quiet");
  const report: StatusReport = buildStatusReport();
  if (!quiet) printStatusReport(report);
  // Exit 1 when there are slugs needing attention (suitable for CI/script gates).
  if (report.needsAttention.length > 0) process.exit(1);
}

export function cmdSync(args: string[]): void {
  const limitStr = argVal(args, "--limit");
  const limit = limitStr !== undefined ? parseInt(limitStr, 10) : undefined;
  const retryFlagged = argFlag(args, "--retry-flagged");
  const retryKind = argVal(args, "--retry-kind");
  const retryPrefix = argVal(args, "--retry-prefix");
  const checkStale = argFlag(args, "--check-stale");
  const maxAgeStr = argVal(args, "--max-age");
  const maxAgeDays = maxAgeStr !== undefined ? parseInt(maxAgeStr, 10) : undefined;
  const onlyStr = argVal(args, "--only");
  const only = onlyStr
    ? new Set(onlyStr.split(",").map((s) => s.trim()).filter(Boolean))
    : undefined;
  const dryRun = argFlag(args, "--dry-run");
  const downloadImages = !argFlag(args, "--no-images");
  const reclassify = !argFlag(args, "--no-reclassify");  // default on

  const plan = buildSyncPlan({
    limit: typeof limit === "number" && !isNaN(limit) ? limit : undefined,
    retryFlagged,
    retryKind,
    retryPrefix,
    checkStale,
    maxAgeDays: typeof maxAgeDays === "number" && !isNaN(maxAgeDays) ? maxAgeDays : undefined,
    only,
    dryRun,
    reclassify,
  });

  const toFetch = plan.filter((p) => p.action === "fetch" || p.action === "head-check");
  const headChecks = plan.filter((p) => p.action === "head-check").length;
  const skipped = plan.length - toFetch.length;
  const fetchCount = toFetch.length - headChecks;
  console.log(`[sync] plan: ${fetchCount} fetch, ${headChecks} head-check, ${skipped} skip`);

  if (toFetch.length > 0) {
    console.log("\n## will fetch / head-check");
    for (const item of toFetch) {
      const tag = item.action === "head-check" ? "[head]" : "[fetch]";
      console.log(`  ${tag} ${item.slug}  ←  ${item.originUrl ?? "(no url)"}  (${item.reason})`);
    }
  }
  if (skipped > 0 && argFlag(args, "--verbose")) {
    console.log("\n## will skip");
    for (const item of plan.filter((p) => p.action !== "fetch")) {
      console.log(`  ${item.action.padEnd(18)} ${item.slug}  (${item.reason})`);
    }
  }

  if (dryRun) {
    console.log("\n[sync] --dry-run: no side effects");
    return;
  }

  if (toFetch.length === 0) {
    console.log("\n[sync] nothing to do ✓");
    return;
  }

  let ok = 0;
  let failed = 0;
  for (const item of toFetch) {
    console.log(`\n[sync] fetching ${item.slug} …`);
    try {
      const src = executeFetchPlanItem(item, downloadImages);
      if (src) {
        const flagStr = src.quality_flags.length ? src.quality_flags.join(",") : "none";
        console.log(`[sync] ✓ ${item.slug} (status=${src.quality_status}, flags=${flagStr})`);
        ok++;
      } else {
        console.log(`[sync] skipped ${item.slug} (no executor for origin)`);
      }
    } catch (err) {
      failed++;
      const fe = err as FetchError;
      if (fe.level && fe.code) {
        console.error(`[sync] ✗ ${item.slug} — ${fe.level} ${fe.code}: ${fe.message}`);
        if (fe.remediation) console.error(`  remediation: ${fe.remediation}`);
        if (fe.level === "L3") {
          console.error(`[sync] L3 halts batch — exiting`);
          process.exit(1);
        }
      } else {
        console.error(`[sync] ✗ ${item.slug} — ${(err as Error).message}`);
      }
    }
  }

  console.log(`\n[sync] complete: ${ok} ok, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

export function cmdRefetch(positional: string[], args: string[]): void {
  const slug = positional[0];
  if (!slug) fail("hirono raindrop refetch: missing <slug>");
  const downloadImages = !argFlag(args, "--no-images");
  const slugDir = rawDirFor(slug);
  const sourcePath = join(slugDir, "source.json");
  if (!existsSync(sourcePath)) {
    console.error(`[refetch] no source.json at ${sourcePath} — use 'hirono raindrop fetch' first`);
    process.exit(2);
  }
  const src = JSON.parse(readFileSync(sourcePath, "utf8")) as SourceJson;
  const item: SyncPlanItem = {
    slug,
    action: "fetch",
    origin: src.origin,
    originUrl: src.origin_url,
    reason: "forced refetch",
  };
  const out = executeFetchPlanItem(item, downloadImages);
  if (!out) {
    console.error(`[refetch] nothing produced (no executor matched origin "${src.origin}")`);
    process.exit(1);
  }
  console.log(
    `[refetch] raw/${yearForSlug(slug)}/${slug}/ ` +
    `(status=${out.quality_status}, ${out.content_length} chars, ${out.images.length} images, flags=${out.quality_flags.join(",") || "none"})`,
  );
}

/**
 * Wrap a CLI handler so FetchError instances are surfaced with their
 * level / code / remediation, and non-FetchError throws propagate.
 * Used by `hirono raindrop` dispatch in `tools/bin/hirono.ts`.
 */
export function withFetchErrorHandling(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    const fe = err as FetchError;
    if (fe.level && fe.code) {
      console.error(`[hirono raindrop] ${fe.level} ${fe.code}: ${fe.message}`);
      if (fe.remediation) console.error(`  remediation: ${fe.remediation}`);
      process.exit(fe.level === "L1" ? 2 : fe.level === "L2" ? 0 : 1);
    }
    throw err;
  }
}
