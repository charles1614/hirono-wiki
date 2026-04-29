/**
 * Test hooks for the zhihu (zhuanlan.zhihu.com) site module.
 * See `tools/sites/_shared/test-hooks-types.ts`.
 */

import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";
import { convertZhihuArticleHtml } from "./converter.ts";
import { extractZhihuArticleContent } from "./fetcher.ts";

function runFromFixture(input: InputDoc): { markdown: string; rest: Record<string, unknown> } {
  if (input.fn !== "convertZhihuArticleHtml") {
    throw new Error(`zhihu test-hooks: unexpected fn ${input.fn}`);
  }
  const [contentHtml, rawMetadata, originUrl] = input.args as [string, unknown, string];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = convertZhihuArticleHtml(contentHtml, rawMetadata as any, originUrl);
  const { markdown, ...rest } = r;
  return { markdown, rest: rest as Record<string, unknown> };
}

function capture(url: string): CaptureResult {
  const z = extractZhihuArticleContent(url);
  if (z.error) throw new Error(`zhihu extraction failed: ${z.error}`);
  if (!z.contentHtml || z.contentHtml.length < 200) {
    throw new Error(`zhihu .Post-RichTextContainer empty (${z.contentHtml.length} chars) — login expired?`);
  }
  const args: [string, { title: string; author: string; date: string }, string] = [
    z.contentHtml,
    { title: z.title, author: z.author, date: z.date },
    url,
  ];
  const result = convertZhihuArticleHtml(args[0], args[1], args[2]);
  const { markdown, ...rest } = result;
  return {
    input: { fn: "convertZhihuArticleHtml", args },
    markdown,
    rest: rest as Record<string, unknown>,
  };
}

export const testHooks: SiteTestHooks = {
  name: "zhihu",
  converterName: "convertZhihuArticleHtml",
  snapshotHosts: ["zhuanlan.zhihu.com"],
  runFromFixture,
  capture,
};
