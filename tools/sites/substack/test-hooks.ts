/**
 * Test hooks for the substack site module — covers the Substack engine
 * across its CNAMEs (substack.com + magazine.sebastianraschka.com +
 * newsletter.semianalysis.com).
 * See `tools/sites/_shared/test-hooks-types.ts`.
 */

import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";
import { convertSubstack, type SubstackConvertOpts } from "./converter.ts";
import { fetchSubstack } from "./fetcher.ts";

function runFromFixture(input: InputDoc): { markdown: string; rest: Record<string, unknown> } {
  if (input.fn !== "convertSubstack") {
    throw new Error(`substack test-hooks: unexpected fn ${input.fn}`);
  }
  const [opts] = input.args as [SubstackConvertOpts];
  const r = convertSubstack(opts);
  const { markdown, ...rest } = r;
  return { markdown, rest: rest as Record<string, unknown> };
}

function capture(url: string): CaptureResult {
  const r = fetchSubstack(url);
  if (r.error) throw new Error(`substack fetch failed: ${r.error}`);
  if (!r.html || r.html.length < 1000) {
    throw new Error(`substack HTML empty/short (${r.html.length} chars)`);
  }
  const args: [SubstackConvertOpts] = [{ html: r.html, url }];
  const result = convertSubstack(args[0]);
  const { markdown, ...rest } = result;
  return {
    input: { fn: "convertSubstack", args },
    markdown,
    rest: rest as Record<string, unknown>,
  };
}

export const testHooks: SiteTestHooks = {
  name: "substack",
  converterName: "convertSubstack",
  snapshotHosts: ["magazine.sebastianraschka.com", "newsletter.semianalysis.com"],
  runFromFixture,
  capture,
};
