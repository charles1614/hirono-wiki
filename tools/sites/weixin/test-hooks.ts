/**
 * Test hooks for the weixin (mp.weixin.qq.com) site module.
 * See `tools/sites/_shared/test-hooks-types.ts`.
 */

import { spawnSync } from "node:child_process";

import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";
import { convertWeixinHtml } from "./converter.ts";
import { extractJsonFromEvalStdout } from "../_shared/browser-eval-json.ts";
import { sleepMs, closeBrowser, browserTimeoutMs } from "../_shared/browser-helpers.ts";

function runFromFixture(input: InputDoc): { markdown: string; rest: Record<string, unknown> } {
  if (input.fn !== "convertWeixinHtml") {
    throw new Error(`weixin test-hooks: unexpected fn ${input.fn}`);
  }
  const [contentHtml, metadata, originUrl] = input.args as [string, unknown, string];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = convertWeixinHtml(contentHtml, metadata as any, originUrl);
  const { markdown, ...rest } = r;
  return { markdown, rest: rest as Record<string, unknown> };
}

function capture(url: string): CaptureResult {
  let browserOpened = false;
  try {
    const openRes = spawnSync("opencli", ["browser", "open", url], {
      encoding: "utf8",
      timeout: browserTimeoutMs("open"),
    });
    if (openRes.status !== 0) throw new Error(`browser open failed: ${openRes.stderr?.slice(0, 200)}`);
    browserOpened = true;
    sleepMs(3500);

    const evalScript = `(() => {
      const root = document.querySelector("#js_content");
      const html = root ? root.outerHTML : "";
      const titleEl = document.querySelector("#activity-name");
      const authorEl = document.querySelector("#js_name") || document.querySelector("#profileBt #js_name");
      const timeEl = document.querySelector("#publish_time") || document.querySelector("em#publish_time");
      return JSON.stringify({
        html,
        title: titleEl ? (titleEl.textContent || "").trim().replace(/\\s+/g, " ") : "",
        author: authorEl ? (authorEl.textContent || "").trim() : "",
        publishTime: timeEl ? (timeEl.textContent || "").trim() : "",
      });
    })()`;
    const evalRes = spawnSync("opencli", ["browser", "eval", evalScript], {
      encoding: "utf8",
      timeout: browserTimeoutMs("eval"),
      maxBuffer: 32 * 1024 * 1024,
    });
    if (evalRes.status !== 0) throw new Error(`browser eval failed: ${evalRes.stderr?.slice(0, 200)}`);
    const payload = extractJsonFromEvalStdout(evalRes.stdout || "") as {
      html?: string; title?: string; author?: string; publishTime?: string;
    } | null;
    if (!payload) throw new Error("no JSON in eval output");

    const args: [string, { title: string; author: string; publishTime: string }, string] = [
      payload.html ?? "",
      {
        title: payload.title ?? "",
        author: payload.author ?? "",
        publishTime: payload.publishTime ?? "",
      },
      url,
    ];
    const result = convertWeixinHtml(args[0], args[1], args[2]);
    const { markdown, ...rest } = result;
    return {
      input: { fn: "convertWeixinHtml", args },
      markdown,
      rest: rest as Record<string, unknown>,
    };
  } finally {
    if (browserOpened) closeBrowser();
  }
}

export const testHooks: SiteTestHooks = {
  name: "weixin",
  converterName: "convertWeixinHtml",
  snapshotHosts: ["mp.weixin.qq.com"],
  runFromFixture,
  capture,
};
