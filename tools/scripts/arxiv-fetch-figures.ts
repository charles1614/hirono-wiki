#!/usr/bin/env node
/**
 * Standalone CLI wrapper around `fetchArxivHtmlFigures()`.
 *
 * The library lives at `tools/sites/arxiv/fetch-figures.ts` and is
 * auto-invoked by the arxiv site module on every `/pdf/<id>` fetch.
 * This script is only needed for manual re-runs (regenerating figures
 * for a slug that was fetched before the auto-wiring landed, or
 * debugging the HTML extraction in isolation).
 *
 * Usage:
 *   npx tsx tools/scripts/arxiv-fetch-figures.ts <arxiv-id> [out-dir]
 *
 * Examples:
 *   npx tsx tools/scripts/arxiv-fetch-figures.ts 2506.05508v1 /tmp/btb-figs
 *   npx tsx tools/scripts/arxiv-fetch-figures.ts 2503.01840v3
 *     → writes to ./<id>-figures/
 */

import { fetchArxivHtmlFigures } from "../sites/arxiv/fetch-figures.ts";

const arxivId = process.argv[2];
const outDir = process.argv[3] ?? `./${arxivId}-figures`;

if (!arxivId) {
  console.error("usage: arxiv-fetch-figures.ts <arxiv-id-with-version> [out-dir]");
  console.error("example: arxiv-fetch-figures.ts 2506.05508v1 /tmp/btb-figs");
  process.exit(2);
}

const result = fetchArxivHtmlFigures({ arxivId, outDir, verbose: true });

if (!result.ok) {
  console.error(`[arxiv-figures] not available: ${result.reason}`);
  process.exit(1);
}

console.error(`[arxiv-figures] wrote ${result.figuresWritten} figures + index to ${outDir}`);
