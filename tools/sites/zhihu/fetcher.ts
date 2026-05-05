/**
 * Zhihu fetcher — opencli browser open + eval to extract `.Post-RichTextContainer`
 * outerHTML and metadata in one session.
 *
 * No dependence on opencli's lossy MD output (`zhihu download`); we go to
 * the raw HTML and convert ourselves.
 */

import { spawnSync } from "node:child_process";
import { sleepMs, closeBrowser, browserTimeoutMs } from "../_shared/browser-helpers.ts";

export interface ZhihuFullContent {
  contentHtml: string;
  title: string;
  author: string;
  date: string;
  finalUrl?: string;
  error?: string;
}

export function extractZhihuArticleContent(url: string): ZhihuFullContent {
  let browserOpened = false;
  try {
    const openRes = spawnSync(
      "opencli",
      ["browser", "open", url],
      { encoding: "utf8", timeout: browserTimeoutMs("open") },
    );
    if (openRes.status !== 0) {
      return {
        contentHtml: "", title: "", author: "", date: "",
        error: `browser open failed: ${(openRes.stderr || "").slice(0, 200)}`,
      };
    }
    browserOpened = true;
    sleepMs(3500);

    const evalScript = `(() => {
      const body = document.querySelector(".Post-RichTextContainer");
      const title = document.querySelector("h1, .Post-Title");
      const author = document.querySelector(".AuthorInfo-name");
      const date = document.querySelector(".ContentItem-time");
      return JSON.stringify({
        contentHtml: body ? body.outerHTML : "",
        title: title ? (title.textContent || "").trim() : "",
        author: author ? (author.textContent || "").trim() : "",
        date: date ? (date.textContent || "").trim() : "",
        finalUrl: window.location.href,
      });
    })()`;

    const evalRes = spawnSync("opencli", ["browser", "eval", evalScript], {
      encoding: "utf8",
      timeout: browserTimeoutMs("eval"),
      maxBuffer: 32 * 1024 * 1024,
    });
    if (evalRes.status !== 0) {
      return {
        contentHtml: "", title: "", author: "", date: "",
        error: `browser eval failed: ${(evalRes.stderr || "").slice(0, 200)}`,
      };
    }

    const stdout = evalRes.stdout || "";
    const start = stdout.indexOf("{");
    if (start < 0) {
      return { contentHtml: "", title: "", author: "", date: "", error: "no JSON object in eval output" };
    }
    let depth = 0, end = -1, inStr = false, esc = false;
    for (let i = start; i < stdout.length; i++) {
      const c = stdout[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === "\"") { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) {
      return { contentHtml: "", title: "", author: "", date: "", error: "unterminated JSON" };
    }

    try {
      const parsed = JSON.parse(stdout.slice(start, end + 1));
      return {
        contentHtml: parsed.contentHtml || "",
        title: parsed.title || "",
        author: parsed.author || "",
        date: parsed.date || "",
        finalUrl: parsed.finalUrl || undefined,
      };
    } catch (e) {
      return {
        contentHtml: "", title: "", author: "", date: "",
        error: `JSON parse failed: ${e instanceof Error ? e.message : e}`,
      };
    }
  } catch (e) {
    return {
      contentHtml: "", title: "", author: "", date: "",
      error: `extractZhihuArticleContent threw: ${e instanceof Error ? e.message : e}`,
    };
  } finally {
    if (browserOpened) closeBrowser();
  }
}
