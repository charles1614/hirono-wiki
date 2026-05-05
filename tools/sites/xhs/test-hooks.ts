/**
 * Test hooks for the xhs (xiaohongshu.com + xhslink.com) site module.
 * See `tools/sites/_shared/test-hooks-types.ts`.
 */

import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";
import { convertXhsHtml } from "./converter.ts";
import { extractXhsFullContent } from "./browser-extract.ts";

function runFromFixture(input: InputDoc): { markdown: string; rest: Record<string, unknown> } {
  if (input.fn !== "convertXhsHtml") {
    throw new Error(`xhs test-hooks: unexpected fn ${input.fn}`);
  }
  const [descText, metadata, originUrl, imageUrls, noteId] = input.args as [
    string, unknown, string, string[], string,
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = convertXhsHtml(descText, metadata as any, originUrl, imageUrls, noteId);
  const { markdown, ...rest } = r;
  return { markdown, rest: rest as Record<string, unknown> };
}

function capture(url: string): CaptureResult {
  const xhsFull = extractXhsFullContent(url);
  if (xhsFull.error) throw new Error(`xhs extraction failed: ${xhsFull.error}`);
  if (!xhsFull.descText.trim()) {
    throw new Error(`xhs descText empty (image-only post or auth failure)`);
  }
  const noteIdMatch = (xhsFull.finalUrl || url).match(
    /\/(?:discovery\/item|explore|search_result)\/([a-f0-9]+)/i,
  );
  const noteId = noteIdMatch ? noteIdMatch[1] : "xhs";
  // Canonical pattern: pass remote URLs + noteId; converter allocates
  // filenames internally and emits `imagesToDownload`.
  const args: [string, Record<string, unknown>, string, string[], string] = [
    xhsFull.descText,
    {
      title: xhsFull.title,
      author: xhsFull.author,
      likes: xhsFull.likes,
      collects: xhsFull.collects,
      comments: xhsFull.comments,
    },
    url,
    xhsFull.imageUrls,
    noteId,
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = convertXhsHtml(args[0], args[1] as any, args[2], args[3], args[4]);
  const { markdown, ...rest } = result;
  return {
    input: { fn: "convertXhsHtml", args },
    markdown,
    rest: rest as Record<string, unknown>,
  };
}

export const testHooks: SiteTestHooks = {
  name: "xhs",
  converterName: "convertXhsHtml",
  snapshotHosts: ["xiaohongshu.com", "xhslink.com"],
  runFromFixture,
  capture,
};
