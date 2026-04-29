import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";
import { convertSspai, type SspaiConvertOpts } from "./converter.ts";
import { fetchSspai } from "./fetcher.ts";

function runFromFixture(input: InputDoc): { markdown: string; rest: Record<string, unknown> } {
  if (input.fn !== "convertSspai") {
    throw new Error(`sspai test-hooks: unexpected fn ${input.fn}`);
  }
  const [opts] = input.args as [SspaiConvertOpts];
  const r = convertSspai(opts);
  const { markdown, ...rest } = r;
  return { markdown, rest: rest as Record<string, unknown> };
}

function capture(url: string): CaptureResult {
  const r = fetchSspai(url);
  if (r.error) throw new Error(`sspai fetch failed: ${r.error}`);
  if (!r.html || r.html.length < 1000) {
    throw new Error(`sspai HTML empty/short (${r.html.length} chars)`);
  }
  const args: [SspaiConvertOpts] = [{ html: r.html, url }];
  const result = convertSspai(args[0]);
  const { markdown, ...rest } = result;
  return {
    input: { fn: "convertSspai", args },
    markdown,
    rest: rest as Record<string, unknown>,
  };
}

export const testHooks: SiteTestHooks = {
  name: "sspai",
  converterName: "convertSspai",
  snapshotHosts: ["sspai.com"],
  runFromFixture,
  capture,
};
