/**
 * Test hooks for the epoch-ai site module.
 * See `tools/sites/_shared/test-hooks-types.ts`.
 */

import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";
import { convertEpochAiContent } from "./converter.ts";
import { extractEpochAiContent } from "./fetcher.ts";

function runFromFixture(input: InputDoc): { markdown: string; rest: Record<string, unknown> } {
  if (input.fn !== "convertEpochAiContent") {
    throw new Error(`epoch-ai test-hooks: unexpected fn ${input.fn}`);
  }
  const [opts] = input.args as [
    { introHtml: string; csvUrl: string; csvText: string; url: string; maxRows?: number },
  ];
  const r = convertEpochAiContent(opts);
  // Note: convertEpochAiContent returns `body`, not `markdown` — map to standardized shape.
  const { body, ...rest } = r;
  return { markdown: body, rest: rest as Record<string, unknown> };
}

function capture(url: string): CaptureResult {
  const x = extractEpochAiContent(url);
  if (x.error) throw new Error(`epoch-ai extraction failed: ${x.error}`);
  if (!x.csvText) throw new Error(`epoch-ai produced no CSV (CSV unavailable?)`);
  const args: [{ introHtml: string; csvUrl: string; csvText: string; url: string }] = [
    { introHtml: x.introHtml, csvUrl: x.csvUrl, csvText: x.csvText, url },
  ];
  const result = convertEpochAiContent(args[0]);
  const { body, ...rest } = result;
  return {
    input: { fn: "convertEpochAiContent", args },
    markdown: body,
    rest: rest as Record<string, unknown>,
  };
}

export const testHooks: SiteTestHooks = {
  name: "epoch-ai",
  converterName: "convertEpochAiContent",
  snapshotHosts: ["epoch.ai"],
  runFromFixture,
  capture,
};
