/**
 * v2ex.com — Chinese tech-discussion forum. NOT a Discourse instance
 * (despite superficial similarity to linux-do); v2ex runs its own
 * stack and the Discourse `<topic>.json` API doesn't exist (returns
 * 404). Plain curl with a real Chrome UA + Accept-Language gets
 * un-walled HTML.
 *
 * Page shape (`/t/<topic-id>`):
 *
 *   <h1>Title</h1>
 *   <div class="header"> ... <small class="gray">
 *     <a href="/member/<author>">author</a> · <span title="<ISO>">date</span> · <views> views
 *   </small> </div>
 *   <div class="cell">
 *     <div class="topic_content">
 *       <div class="markdown_body"> OP body </div>
 *     </div>
 *   </div>
 *   <div id="r_<reply-id>" class="cell">
 *     <table>
 *       <img class="avatar" alt="<username>">
 *       <strong><a href="/member/<username>" class="dark">username</a></strong>
 *       <div class="badges"> [<div class="badge op">OP</div>] </div>
 *       <span class="ago" title="<ISO>">date</span>
 *       <div class="reply_content"> body </div>
 *     </table>
 *   </div>
 *   ... more <div id="r_*">
 */

import { spawnSync } from "node:child_process";
import { JSDOM } from "jsdom";

const FETCH_TIMEOUT_MS = 30_000;

export interface V2exPost {
  /** 1 for OP, 2..N for replies. */
  no: number;
  username: string;
  /** ISO timestamp from the `title=` attribute. */
  date: string;
  /** True for #1 (the OP). */
  isOp: boolean;
  /** True if v2ex marks the post with the OP badge (poster commenting on their own thread). */
  badgeOp?: boolean;
  /** Inner HTML of the post body — `topic_content > markdown_body` for OP, `reply_content` for replies. */
  contentHtml: string;
}

export interface V2exTopic {
  url: string;
  topicId: string;
  title: string;
  /** Topic-level author (the OP poster's username). */
  opAuthor?: string;
  /** Topic creation date (ISO from the header `<span title>`). */
  opDate?: string;
  /** Topic view count (from the header — "<N> views"). */
  views?: number;
  posts: V2exPost[];
  /** Set when the fetch failed; posts will be empty in that case. */
  error?: string;
}

export function fetchV2exTopic(url: string): V2exTopic {
  const m = url.match(/\/t\/(\d+)/);
  const topicId = m ? m[1] : "";
  const empty: V2exTopic = { url, topicId, title: "", posts: [] };

  // Plain curl with a realistic Chrome UA. v2ex 403s on the bare
  // `curl/X.Y` UA but accepts the standard browser fingerprint.
  const r = spawnSync("curl", [
    "-sfL",
    "--max-time", String(Math.floor(FETCH_TIMEOUT_MS / 1000)),
    "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "-H", "Accept-Language: en-US,en;q=0.9,zh-CN;q=0.8",
    url,
  ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (r.status !== 0) {
    return { ...empty, error: `curl failed: ${(r.stderr || "").slice(0, 200)}` };
  }
  const html = r.stdout || "";
  if (html.length < 1000) {
    return { ...empty, error: `response too small (${html.length} bytes) — page probably gated or 404` };
  }

  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Title — strip the " - V2EX" / " - V2EX/<sub>" suffix.
  const rawTitle = (doc.querySelector("h1")?.textContent || doc.querySelector("title")?.textContent || "").trim();
  const title = rawTitle.replace(/\s*[-–]\s*V2EX(?:\/.*)?$/i, "").trim();

  // Topic header: `.header > small.gray` contains author + date + views.
  let opAuthor: string | undefined;
  let opDate: string | undefined;
  let views: number | undefined;
  const header = doc.querySelector(".header small.gray, .header .small.gray, .header .gray");
  if (header) {
    const a = header.querySelector('a[href^="/member/"]');
    opAuthor = a?.textContent?.trim() || undefined;
    const dateEl = header.querySelector("span[title]");
    opDate = dateEl?.getAttribute("title") || dateEl?.textContent?.trim() || undefined;
    const text = header.textContent || "";
    const vm = text.match(/(\d[\d,]*)\s*views?/i);
    if (vm) views = parseInt(vm[1].replace(/,/g, ""), 10);
  }

  // OP body: `.topic_content .markdown_body`. Some old topics are plain
  // text without a markdown_body wrapper — fall back to topic_content's
  // own innerHTML in that case.
  const opEl =
    doc.querySelector(".topic_content .markdown_body") ||
    doc.querySelector(".topic_content");
  const opHtml = opEl ? opEl.innerHTML.trim() : "";

  const posts: V2exPost[] = [];
  if (opHtml) {
    posts.push({
      no: 1,
      username: opAuthor ?? "",
      date: opDate ?? "",
      isOp: true,
      contentHtml: opHtml,
    });
  }

  // Replies: every `<div id="r_<id>" class="cell">` is one reply.
  for (const replyEl of doc.querySelectorAll('div[id^="r_"].cell')) {
    const noTxt = replyEl.querySelector("span.no")?.textContent?.trim() || "";
    const no = parseInt(noTxt, 10);
    if (!Number.isFinite(no)) continue;
    // The OP-badge marks replies BY the topic creator (so we can label
    // those `(OP comment)` in the converter). Distinct from `isOp`
    // which is reserved for post #1.
    const badgeOp = !!replyEl.querySelector(".badges .badge.op");
    const userA = replyEl.querySelector('strong a[href^="/member/"]');
    const username = userA?.textContent?.trim() || "";
    const dateEl = replyEl.querySelector("span.ago[title]");
    const date = dateEl?.getAttribute("title") || dateEl?.textContent?.trim() || "";
    const bodyEl = replyEl.querySelector(".reply_content");
    const contentHtml = bodyEl ? bodyEl.innerHTML.trim() : "";
    if (!contentHtml) continue;
    posts.push({ no: no + 1, username, date, isOp: false, badgeOp, contentHtml });
  }

  if (posts.length === 0) {
    return { ...empty, title, error: "no posts extracted (selectors miss / page is malformed)" };
  }

  return { url, topicId, title, opAuthor, opDate, views, posts };
}
