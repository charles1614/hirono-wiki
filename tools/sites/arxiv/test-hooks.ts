/**
 * Test hooks for the arxiv site module.
 * See `tools/sites/_shared/test-hooks-types.ts`.
 */

import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";
import { convertArxiv, type ArxivConvertOpts } from "./converter.ts";
import { fetchArxiv } from "./fetcher.ts";

function runFromFixture(input: InputDoc): { markdown: string; rest: Record<string, unknown> } {
  if (input.fn !== "convertArxiv") {
    throw new Error(`arxiv test-hooks: unexpected fn ${input.fn}`);
  }
  const [opts] = input.args as [ArxivConvertOpts];
  const r = convertArxiv(opts);
  const { markdown, ...rest } = r;
  return { markdown, rest: rest as Record<string, unknown> };
}

function capture(url: string): CaptureResult {
  const r = fetchArxiv(url);
  if (r.error) throw new Error(`arxiv fetch failed: ${r.error}`);
  if (!r.html || r.html.length < 1000) {
    throw new Error(`arxiv HTML empty/short (${r.html.length} chars)`);
  }
  const args: [ArxivConvertOpts] = [{ html: r.html, url }];
  const result = convertArxiv(args[0]);
  const { markdown, ...rest } = result;
  return {
    input: { fn: "convertArxiv", args },
    markdown,
    rest: rest as Record<string, unknown>,
  };
}

export const testHooks: SiteTestHooks = {
  name: "arxiv",
  converterName: "convertArxiv",
  snapshotHosts: ["arxiv.org"],
  runFromFixture,
  capture,
};
