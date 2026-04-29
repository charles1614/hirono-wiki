/**
 * Test hooks for the deepwiki-litenext site module.
 * See `tools/sites/_shared/test-hooks-types.ts`.
 */

import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";
import { convertDeepwikiLitenextHtml } from "./converter.ts";
import { extractDeepwikiLitenextContent } from "./fetcher.ts";

function runFromFixture(input: InputDoc): { markdown: string; rest: Record<string, unknown> } {
  if (input.fn !== "convertDeepwikiLitenextHtml") {
    throw new Error(`deepwiki-litenext test-hooks: unexpected fn ${input.fn}`);
  }
  const [contentHtml, mermaidSources, opts] = input.args as [
    string, string[], { title: string; url: string },
  ];
  const r = convertDeepwikiLitenextHtml(contentHtml, mermaidSources, opts);
  const { markdown, ...rest } = r;
  return { markdown, rest: rest as Record<string, unknown> };
}

function capture(url: string): CaptureResult {
  const x = extractDeepwikiLitenextContent(url);
  if (x.error) throw new Error(`deepwiki-litenext extraction failed: ${x.error}`);
  if (!x.contentHtml || x.contentHtml.length < 200) {
    throw new Error(`deepwiki-litenext .prose container empty (${x.contentHtml.length} chars)`);
  }
  const args: [string, string[], { title: string; url: string }] = [
    x.contentHtml,
    x.mermaidSources,
    { title: x.title, url },
  ];
  const result = convertDeepwikiLitenextHtml(args[0], args[1], args[2]);
  const { markdown, ...rest } = result;
  return {
    input: { fn: "convertDeepwikiLitenextHtml", args },
    markdown,
    rest: rest as Record<string, unknown>,
  };
}

export const testHooks: SiteTestHooks = {
  name: "deepwiki-litenext",
  converterName: "convertDeepwikiLitenextHtml",
  snapshotHosts: ["wiki.litenext.digital"],
  runFromFixture,
  capture,
};
