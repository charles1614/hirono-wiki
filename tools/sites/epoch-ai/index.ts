/**
 * epoch.ai — interactive ML hardware/training-runs/etc. data viz.
 *
 * Generic web-fetch produces only UI control labels because the data
 * lives in JS state. This module fetches the underlying CSV directly
 * (every dataset has a Download CSV link) and embeds the top N rows
 * as a markdown table alongside the page's prose intro.
 */

import { mkdirSync } from "node:fs";

import type { Site } from "../_shared/types.ts";
import { makeStub } from "../_shared/stub.ts";
import { extractEpochAiContent } from "./fetcher.ts";
import { convertEpochAiContent } from "./converter.ts";
import { hostOf } from "../../shared/url-helpers.ts";

export const site: Site = {
  name: "epoch-ai",
  match: (url) => hostOf(url) === "epoch.ai",
  fetch: (url, opts) => {
    mkdirSync(opts.slugDir, { recursive: true });

    const x = extractEpochAiContent(url);
    if (x.error) {
      return stubResult(url, `epoch.ai extraction failed: ${x.error.slice(0, 160)}`);
    }
    if (!x.introHtml && !x.csvText) {
      return stubResult(url, "epoch.ai page produced no intro and no CSV");
    }

    const conv = convertEpochAiContent({
      introHtml: x.introHtml,
      csvUrl: x.csvUrl,
      csvText: x.csvText,
      url,
    });

    const titleLine = x.title || `epoch.ai dataset: ${url}`;
    const markdown =
      `# ${titleLine}\n\n` +
      `> 原文链接: ${url}\n\n` +
      `---\n\n` +
      conv.body;

    const flags: string[] = [];
    if (!x.csvText) flags.push("epoch-ai-csv-unavailable");

    const notes: string[] = [
      `epoch-ai: intro ${conv.stats.introChars} chars, ` +
      `CSV ${conv.stats.csvRows} rows × ${conv.stats.csvCols} cols ` +
      `(top ${conv.stats.embeddedRows} embedded as markdown table)`,
    ];

    return {
      markdown,
      title: titleLine,
      images: [],
      metadata: {
        source: "epoch-ai-csv",
        title: titleLine,
        csv_url: x.csvUrl,
        rows: conv.stats.csvRows,
        cols: conv.stats.csvCols,
        embedded_rows: conv.stats.embeddedRows,
      },
      flags,
      notes,
    };
  },
};

function stubResult(url: string, reason: string, errorDetail?: string) {
  return makeStub({
    url, module: "epoch-ai", kind: "fetch-failed",
    title: "epoch.ai page (fetch failed)",
    summary: reason,
    errorDetail,
  });
}
