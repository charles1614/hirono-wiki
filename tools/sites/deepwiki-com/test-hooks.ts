/**
 * Test hooks for the deepwiki-com site module.
 * See `tools/sites/_shared/test-hooks-types.ts`.
 */

import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";
import { convertDeepwikiComHtml } from "./converter.ts";
import { extractDeepwikiComContent } from "./fetcher.ts";

function runFromFixture(input: InputDoc): { markdown: string; rest: Record<string, unknown> } {
  if (input.fn !== "convertDeepwikiComHtml") {
    throw new Error(`deepwiki-com test-hooks: unexpected fn ${input.fn}`);
  }
  const [contentHtml, mermaidSources, opts] = input.args as [
    string, string[], { title: string; url: string },
  ];
  const r = convertDeepwikiComHtml(contentHtml, mermaidSources, opts);
  const { markdown, ...rest } = r;
  return { markdown, rest: rest as Record<string, unknown> };
}

function capture(url: string): CaptureResult {
  const x = extractDeepwikiComContent(url);
  if (x.error) throw new Error(`deepwiki-com extraction failed: ${x.error}`);
  if (!x.contentHtml || x.contentHtml.length < 200) {
    throw new Error(`deepwiki-com .prose container empty (${x.contentHtml.length} chars)`);
  }
  const args: [string, string[], { title: string; url: string }] = [
    x.contentHtml,
    x.mermaidSources,
    { title: x.title, url },
  ];
  const result = convertDeepwikiComHtml(args[0], args[1], args[2]);
  const { markdown, ...rest } = result;
  return {
    input: { fn: "convertDeepwikiComHtml", args },
    markdown,
    rest: rest as Record<string, unknown>,
  };
}

export const testHooks: SiteTestHooks = {
  name: "deepwiki-com",
  converterName: "convertDeepwikiComHtml",
  snapshotHosts: ["deepwiki.com"],
  runFromFixture,
  capture,
};
