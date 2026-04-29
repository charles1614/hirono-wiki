/**
 * Test hooks for the nvidianews (nvidianews.nvidia.com) site module.
 * See `tools/sites/_shared/test-hooks-types.ts`.
 */

import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";
import { convertNvidianewsHtml, type ConvertOpts } from "./converter.ts";
import { extractNvidianewsContent } from "./fetcher.ts";

function runFromFixture(input: InputDoc): { markdown: string; rest: Record<string, unknown> } {
  if (input.fn !== "convertNvidianewsHtml") {
    throw new Error(`nvidianews test-hooks: unexpected fn ${input.fn}`);
  }
  const [opts] = input.args as [ConvertOpts];
  const r = convertNvidianewsHtml(opts);
  const { markdown, ...rest } = r;
  return { markdown, rest: rest as Record<string, unknown> };
}

function capture(url: string): CaptureResult {
  const x = extractNvidianewsContent(url);
  if (x.error) throw new Error(`nvidianews extraction failed: ${x.error}`);
  if (!x.bodyHtml || x.bodyHtml.length < 200) {
    throw new Error(`nvidianews .article body empty (${x.bodyHtml.length} chars)`);
  }
  const args: [ConvertOpts] = [{
    title: x.title,
    subtitle: x.subtitle,
    date: x.date,
    bodyHtml: x.bodyHtml,
    heroImageUrl: x.heroImageUrl,
    url,
  }];
  const result = convertNvidianewsHtml(args[0]);
  const { markdown, ...rest } = result;
  return {
    input: { fn: "convertNvidianewsHtml", args },
    markdown,
    rest: rest as Record<string, unknown>,
  };
}

export const testHooks: SiteTestHooks = {
  name: "nvidianews",
  converterName: "convertNvidianewsHtml",
  snapshotHosts: ["nvidianews.nvidia.com"],
  runFromFixture,
  capture,
};
