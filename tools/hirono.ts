#!/usr/bin/env node
/**
 * hirono — CLI for this wiki's raw-source + maintenance tooling.
 *
 * Per Karpathy's gist ("accumulate skills as the project grows"), hirono
 * is the single entry point for all raw-source operations. Phase 1 ships
 * the raindrop family + doctor; later phases add wiki/ingest/batch/etc.
 *
 * Subcommands (Phase 1):
 *
 *   hirono raindrop check [--input <path>] [--json] [--quiet]
 *       Scan the cached Raindrop corpus for duplicate URLs + hostname
 *       coverage gaps. Exit 1 on findings worth acting on.
 *
 *   hirono raindrop export <id|url|slug> [--slug <slug>] [--force] [--no-images]
 *       Fetch one source into raw/<slug>/, running the post-processor
 *       pipeline for UI-chrome strip / relative-URL resolution / SVG
 *       cleanup. Subsumes fetch-raw.ts fetch-url + refetch.
 *
 *   hirono doctor [--fix] [--verbose]
 *       Health-check: opencli extension, wiki-custom symlink, adapter
 *       file validity, raw/ quality state. --fix creates the symlink.
 *
 * All subcommands use a fresh argv slice; see tools/hirono/ for the
 * actual implementations.
 */

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const THIS_FILE = fileURLToPath(import.meta.url);

function usage(): never {
  console.error(`usage: hirono <subcommand> [options]

subcommands:
  raindrop check              enumerate corpus; report duplicates + coverage
  raindrop export <id|url|slug>  fetch single source → raw/<slug>/
  raindrop refresh-cache      pull all bookmarks from Raindrop API → cache
  doctor                      environment + adapter health check

For subcommand-specific help: hirono <subcommand> --help`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [family, sub, ...rest] = process.argv.slice(2);

  if (!family || family === "--help" || family === "-h") usage();

  if (family === "raindrop") {
    if (!sub) usage();
    if (sub === "check") {
      const { main } = await import("./hirono/raindrop/check.ts");
      main(rest);
      return;
    }
    if (sub === "export") {
      const { main } = await import("./hirono/raindrop/export.ts");
      main(rest);
      return;
    }
    if (sub === "refresh-cache") {
      const { main } = await import("./hirono/raindrop/refresh-cache.ts");
      await main(rest);
      return;
    }
    console.error(`unknown raindrop subcommand: ${sub}`);
    console.error(`valid: check, export, refresh-cache`);
    process.exit(2);
  }

  if (family === "doctor") {
    const { main } = await import("./hirono/doctor.ts");
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
