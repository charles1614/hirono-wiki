#!/usr/bin/env node
/**
 * hirono — single entry point for the wiki's raw-source acquisition
 * tooling. Three conceptual layers:
 *
 *   1. Raindrop fetch pipeline (this file's `raindrop` namespace) —
 *      everything that exports Raindrop bookmarks into raw/<slug>/.
 *      Includes: fetch / refetch / sync / verify / status / history /
 *      diff / new / check / refresh-cache / fetch-all / store /
 *      fetch-lark.
 *
 *   2. Wiki ingest (separate top-level binary) —
 *      `tools/bin/ingest_batch.ts` manages the pending/in-progress/
 *      done state for the LLM-driven Sources/<slug>.md authoring loop.
 *      Conceptually downstream of the raindrop fetch pipeline.
 *
 *   3. Wiki maintenance (separate top-level binaries) —
 *      `tools/bin/{reindex,build-sources-index,build-mention-map,
 *      lint,find-dupes,sweep-issues}.ts` operate on Sources/Entities/
 *      Topics tree, not on raw/ or Raindrop state.
 *
 * The legacy `tools/bin/fetch-raw.ts` CLI still works (deprecation
 * notice on use). Every fetch-raw subcommand has a matching
 * `hirono raindrop <subcommand>` form.
 *
 * For subcommand-specific help:  hirono <subcommand> --help
 *                                hirono raindrop <subcommand> --help
 */

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const THIS_FILE = fileURLToPath(import.meta.url);

function usage(): never {
  console.error(`usage: hirono <subcommand> [options]

Raindrop fetch pipeline (raw export):
  raindrop check                          enumerate corpus; duplicates + coverage gaps
  raindrop refresh-cache                  pull all bookmarks from Raindrop API → cache
  raindrop new                            list bookmarks not yet in the sources index
  raindrop fetch <url|slug|id> [--slug]   fetch one source → raw/<slug>/
                                          (alias: 'export', kept for backwards compat)
  raindrop refetch <slug>                 force re-fetch using saved origin
                                          (preserves append-only: writes content-rev2.md)
  raindrop sync                           idempotent (re)fetch over raw/ + ingest queue
                                          flags: --retry-flagged --retry-kind <k>
                                                 --retry-prefix <p> --check-stale --max-age N
                                                 --only <slug,...> --limit N --dry-run
  raindrop verify <slug>                  re-classify quality of an existing slug
  raindrop status                         join corpus + index + raw/; classify failures
                                          flags: --json --csv --md --filter <kind>
                                                 --filter-prefix <p> --out <path>
  raindrop history <slug>                 list all revisions for a slug
  raindrop diff <slug>                    unified diff between two revisions
                                          flags: --from <rev|date> --to <rev|date>
                                                 --summary --no-color
  raindrop fetch-all                      bulk fetch one copy of every unique URL
  raindrop store <slug>                   write pre-fetched MD into raw/ (low-level)
  raindrop fetch-lark <token>             fetch via lark-hirono (low-level)

Top-level:
  doctor                                  environment + adapter health check

Wiki ingest + maintenance live in separate binaries (intentional layering):
  tools/bin/ingest_batch.ts  plan / next / start / mark-done / list
  tools/bin/build-sources-index.ts        rebuild URL→slug index
  tools/bin/build-mention-map.ts          rebuild wiki-link map
  tools/bin/reindex.ts                    refs / tier / Meta indexes
  tools/bin/lint.ts                       wiki-content linter
  tools/bin/find-dupes.ts                 duplicate slug detection`);
  process.exit(2);
}

async function dispatchRaindropFetchSubcommands(sub: string, rest: string[]): Promise<boolean> {
  // Subcommands that delegate to fetch-raw library / cli helpers.
  // Returns true if the subcommand was handled.
  if (sub === "fetch" || sub === "export") {
    // 'fetch' is the canonical name; 'export' is the legacy alias.
    // Both route to the same enriched implementation in hirono/raindrop/export.ts.
    const { main } = await import("../hirono/raindrop/export.ts");
    main(rest);
    return true;
  }
  if (sub === "refetch") {
    const { cmdRefetch } = await import("./fetch-raw.ts");
    const positional = rest.filter(a => !a.startsWith("--"));
    cmdRefetch(positional, rest);
    return true;
  }
  if (sub === "sync") {
    const { cmdSync } = await import("./fetch-raw.ts");
    cmdSync(rest);
    return true;
  }
  if (sub === "verify") {
    const { cmdVerify } = await import("./fetch-raw.ts");
    const positional = rest.filter(a => !a.startsWith("--"));
    cmdVerify(positional);
    return true;
  }
  if (sub === "store") {
    const { cmdStore } = await import("./fetch-raw.ts");
    const positional = rest.filter(a => !a.startsWith("--"));
    cmdStore(positional, rest);
    return true;
  }
  if (sub === "fetch-lark") {
    const { cmdFetchLark } = await import("./fetch-raw.ts");
    const positional = rest.filter(a => !a.startsWith("--"));
    cmdFetchLark(positional, rest);
    return true;
  }
  return false;
}

async function main(): Promise<void> {
  const [family, sub, ...rest] = process.argv.slice(2);

  if (!family || family === "--help" || family === "-h") usage();

  if (family === "raindrop") {
    if (!sub) usage();

    // Existing pure-hirono subcommands (Phase 1 + Feature 1-3).
    if (sub === "check") {
      const { main } = await import("../hirono/raindrop/check.ts");
      main(rest);
      return;
    }
    if (sub === "refresh-cache") {
      const { main } = await import("../hirono/raindrop/refresh-cache.ts");
      await main(rest);
      return;
    }
    if (sub === "fetch-all") {
      const { main } = await import("../hirono/raindrop/fetch-all.ts");
      await main(rest);
      return;
    }
    if (sub === "status") {
      const { main } = await import("../hirono/raindrop/status.ts");
      main(rest);
      return;
    }
    if (sub === "new") {
      const { main } = await import("../hirono/raindrop/new-bookmarks.ts");
      main(rest);
      return;
    }
    if (sub === "history") {
      const { main } = await import("../hirono/raindrop/history.ts");
      main(rest);
      return;
    }
    if (sub === "diff") {
      const { main } = await import("../hirono/raindrop/diff.ts");
      main(rest);
      return;
    }

    // Subcommands that consolidate fetch-raw's CLI under raindrop/.
    if (await dispatchRaindropFetchSubcommands(sub, rest)) return;

    console.error(`unknown raindrop subcommand: ${sub}`);
    console.error(
      `valid: check, refresh-cache, new, fetch, refetch, sync, verify,\n` +
      `       status, history, diff, fetch-all, store, fetch-lark, export`,
    );
    process.exit(2);
  }

  if (family === "doctor") {
    const { main } = await import("../hirono/doctor.ts");
    main([sub, ...rest].filter((a) => a !== undefined));
    return;
  }

  console.error(`unknown subcommand family: ${family}`);
  usage();
}

const isEntryPoint =
  process.argv[1] !== undefined && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) {
  main().catch((err) => {
    console.error(`hirono: ${(err as Error).message}`);
    process.exit(1);
  });
}
