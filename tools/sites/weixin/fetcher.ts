/**
 * WeChat fetcher — opencli browser open + eval to extract `#js_content`
 * outerHTML and metadata in one session.
 *
 * Per the universal pattern (CLAUDE.md §5a): opencli is used for browser
 * session + auth only; conversion is owned by us in `converter.ts`.
 */

import { spawnSync } from "node:child_process";
import { sleepMs, closeBrowser, browserTimeoutMs, openBrowserWithRetry } from "../_shared/browser-helpers.ts";
import { makeError as makeFetchError } from "../../fetch-raw.ts";

export interface WeixinFullContent {
  contentHtml: string;
  title: string;
  author: string;
  publishTime: string;
  error?: string;
}

/**
 * Open the URL in opencli's browser and pull `#js_content` outerHTML
 * + page metadata in a single eval. Throws a structured error if any
 * step fails — there's no fallback path; weixin gives us nothing useful
 * without browser+auth.
 */
export function extractWeixinFullContent(url: string): WeixinFullContent {
  let browserOpened = false;
  try {
    const openRes = openBrowserWithRetry(url);
    if (openRes.status !== 0) {
      throw makeFetchError(
        "browser-open-failed",
        "L3",
        `opencli browser open failed for weixin URL: ${(openRes.stderr || "").slice(0, 200)}`,
      );
    }
    browserOpened = true;
    sleepMs(3500);

    // One eval call returns both the article HTML and metadata so we
    // don't pay for two round trips.
    const evalScript = `(() => {
      const root = document.querySelector("#js_content");
      const html = root ? root.outerHTML : "";
      const titleEl = document.querySelector("#activity-name");
      const authorEl = document.querySelector("#js_name") || document.querySelector("#profileBt #js_name");
      const timeEl = document.querySelector("#publish_time") || document.querySelector("em#publish_time");
      // Detect WeChat's "account migrated / recycled" landing page. The
      // body text reliably carries the phrase 该公众号已迁移; the original
      // article is reachable only via a manual button click. We surface
      // this as a soft stub instead of an L3 auth-loss halt.
      const bodyText = (document.body && document.body.innerText) ? document.body.innerText.slice(0, 2000) : "";
      const migrated = /该公众号已迁移/.test(bodyText) || /原账号已回收/.test(bodyText);
      return JSON.stringify({
        html,
        title: titleEl ? (titleEl.textContent || "").trim().replace(/\\s+/g, " ") : "",
        author: authorEl ? (authorEl.textContent || "").trim() : "",
        publishTime: timeEl ? (timeEl.textContent || "").trim() : "",
        migrated,
      });
    })()`;
    const evalRes = spawnSync("opencli", ["browser", "eval", evalScript], {
      encoding: "utf8",
      timeout: browserTimeoutMs("eval"),
      maxBuffer: 32 * 1024 * 1024,
    });
    if (evalRes.status !== 0) {
      throw makeFetchError(
        "browser-eval-failed",
        "L3",
        `opencli browser eval failed for weixin URL: ${(evalRes.stderr || "").slice(0, 200)}`,
      );
    }
    // opencli prints the eval result + a trailing version-notice block.
    // Locate the inner JSON object by scanning brace depth (string-aware).
    const stdout = evalRes.stdout || "";
    const jsonStart = stdout.indexOf("{");
    if (jsonStart < 0) {
      throw makeFetchError("browser-eval-empty", "L3", "weixin eval returned no JSON object");
    }
    let depth = 0;
    let jsonEnd = -1;
    let inStr = false;
    let escape = false;
    for (let i = jsonStart; i < stdout.length; i++) {
      const c = stdout[i];
      if (escape) { escape = false; continue; }
      if (c === "\\") { escape = true; continue; }
      if (c === "\"") { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { jsonEnd = i; break; } }
    }
    if (jsonEnd < 0) {
      throw makeFetchError("browser-eval-malformed", "L3", "weixin eval JSON object not terminated");
    }
    const payload = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1)) as {
      html: string;
      title: string;
      author: string;
      publishTime: string;
      migrated?: boolean;
    };
    if (payload.migrated) {
      // Account-migrated landing page. Original article is gone unless
      // the operator clicks the manual redirect button — out of scope
      // for an automated fetcher. Signal a soft stub via L2.
      throw makeFetchError(
        "weixin-account-migrated",
        "L2",
        "weixin official account migrated/recycled — original article reachable only via manual redirect button",
      );
    }
    if (!payload.html || payload.html.length < 200) {
      throw makeFetchError(
        "weixin-empty-content",
        "L3",
        `weixin #js_content missing or too small (${payload.html?.length ?? 0} chars) — login expired or wrong page?`,
      );
    }
    return {
      contentHtml: payload.html,
      title: payload.title,
      author: payload.author,
      publishTime: payload.publishTime,
    };
  } finally {
    if (browserOpened) closeBrowser();
  }
}
