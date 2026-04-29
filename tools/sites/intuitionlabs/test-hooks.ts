import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";
import { convertIntuitionlabs, type IntuitionlabsConvertOpts } from "./converter.ts";
import { fetchIntuitionlabs } from "./fetcher.ts";

function runFromFixture(input: InputDoc): { markdown: string; rest: Record<string, unknown> } {
  if (input.fn !== "convertIntuitionlabs") {
    throw new Error(`intuitionlabs test-hooks: unexpected fn ${input.fn}`);
  }
  const [opts] = input.args as [IntuitionlabsConvertOpts];
  const r = convertIntuitionlabs(opts);
  const { markdown, ...rest } = r;
  return { markdown, rest: rest as Record<string, unknown> };
}

function capture(url: string): CaptureResult {
  const r = fetchIntuitionlabs(url);
  if (r.error) throw new Error(`intuitionlabs fetch failed: ${r.error}`);
  if (!r.html || r.html.length < 1000) {
    throw new Error(`intuitionlabs HTML empty/short (${r.html.length} chars)`);
  }
  const args: [IntuitionlabsConvertOpts] = [{ html: r.html, url }];
  const result = convertIntuitionlabs(args[0]);
  const { markdown, ...rest } = result;
  return {
    input: { fn: "convertIntuitionlabs", args },
    markdown,
    rest: rest as Record<string, unknown>,
  };
}

export const testHooks: SiteTestHooks = {
  name: "intuitionlabs",
  converterName: "convertIntuitionlabs",
  snapshotHosts: ["intuitionlabs.ai"],
  runFromFixture,
  capture,
};
