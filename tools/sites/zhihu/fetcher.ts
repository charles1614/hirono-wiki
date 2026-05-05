/**
 * Zhihu fetchers — opencli browser open + eval to extract content +
 * metadata in one session.
 *
 * Two URL shapes:
 *   - zhuanlan.zhihu.com/p/<id>           — long-form article;
 *     extracted via `extractZhihuArticleContent`. Body is
 *     `.Post-RichTextContainer`.
 *   - www.zhihu.com/question/<qid>/answer/<aid> — single answer in a
 *     question; extracted via `extractZhihuAnswerContent`. Body is
 *     the matching answer card's `.RichText`. The page often renders
 *     the targeted answer expanded by default; we still scope to
 *     the answer-id when possible to handle multi-answer scrolls.
 *
 * Both go through `convertZhihuArticleHtml` for the body conversion
 * (same RichText shape; differs only in metadata callout).
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

/**
 * Extract the body of a single zhihu answer (`/question/<qid>/answer/<aid>`).
 *
 * Strategy:
 *   1. Open the URL — the targeted answer renders expanded by default.
 *   2. Scope to that specific answer card via `data-zop-itemid`/
 *      `data-za-extra-module` attributes (both encode the answer id).
 *      Fallback: first `.AnswerItem` or `.AnswerCard` on the page,
 *      then any `.RichText` ancestor.
 *   3. Pull `.QuestionHeader-title` for the question text and use it
 *      as the §2 title (more informative than just "Untitled answer").
 */
export function extractZhihuAnswerContent(url: string): ZhihuFullContent {
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
      const title = document.querySelector('.QuestionHeader-title, h1.QuestionHeader-title, h1');
      const aidMatch = window.location.pathname.match(/\\/answer\\/(\\d+)/);
      const aid = aidMatch ? aidMatch[1] : null;

      // Try answer-id-scoped lookup first
      let card = null;
      if (aid) {
        card = document.querySelector(\`[data-zop-itemid$="\${aid}"]\`)
            || document.querySelector(\`[data-za-extra-module*="\${aid}"]\`);
        if (card && !card.matches('.AnswerItem, .AnswerCard, [data-zop-itemid]')) {
          card = card.closest('.AnswerItem, .AnswerCard, [data-zop-itemid]');
        }
      }
      // Fallback: first answer card on page
      if (!card) card = document.querySelector('.AnswerItem, .AnswerCard');

      // Body: .RichContent-inner .RichText is the canonical answer body
      let body = null;
      if (card) {
        body = card.querySelector('.RichContent-inner .RichText, .RichContent .RichText, .RichText');
      }
      // Final fallback: any RichText on the page
      if (!body) body = document.querySelector('.RichText.Post-RichText, .RichText');

      const author = card ? card.querySelector('.AuthorInfo-name') : document.querySelector('.AuthorInfo-name');
      const date = card ? card.querySelector('.ContentItem-time') : document.querySelector('.ContentItem-time');

      return JSON.stringify({
        contentHtml: body ? body.outerHTML : '',
        title: title ? (title.textContent || '').trim() : '',
        author: author ? (author.textContent || '').trim() : '',
        date: date ? (date.textContent || '').trim() : '',
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
      error: `extractZhihuAnswerContent threw: ${e instanceof Error ? e.message : e}`,
    };
  } finally {
    if (browserOpened) closeBrowser();
  }
}
