/**
 * v2ex converter — pure function from `V2exTopic` to clean §2 markdown.
 *
 * Layout:
 *
 *   # <Title>
 *
 *   > 原文链接: <canonical-url>
 *   > 主题元信息: 共 N 楼 · X 浏览
 *
 *   ---
 *
 *   ## #1 @<op-username> · <date>                                 ← OP
 *   <converted body>
 *
 *   ## #N @<username> · <date>  [(OP comment)]                    ← reply
 *   <converted body>
 *
 *   ...
 *
 * v2ex's reply HTML is small and clean. The few quirks worth handling:
 *
 *   - `<a href="/member/<user>">@<user></a>` reply mentions: rendered
 *     as `@<user>` plain text (don't keep the relative-URL link — it
 *     resolves to a member profile, not a post anchor).
 *   - `<img class="embedded_image" src="https://imgur.com/...">`: keep
 *     as image refs (image localization runs on the converted markdown).
 *   - Trailing `<br>` chrome inside reply bodies: turndown handles fine.
 */

import { JSDOM } from "jsdom";
import TurndownService from "turndown";
// @ts-expect-error  no types
import { gfm } from "@joplin/turndown-plugin-gfm";

import { applyCommonMarkdownCleanups } from "../_shared/markdown-cleanups.ts";
import type { V2exTopic, V2exPost } from "./fetcher.ts";

export interface V2exImageDownload {
  remoteUrl: string;
  localFilename: string;
}

export interface V2exConvertResult {
  markdown: string;
  imagesToDownload: V2exImageDownload[];
  metadata: {
    title: string;
    topic_id: string;
    posts_included: number;
    views?: number;
  };
  stats: {
    bodyChars: number;
    posts: number;
  };
}

function makeTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    fence: "```",
  });
  td.use(gfm);

  // Strip member-profile links — keep just the username text. v2ex's
  // reply HTML often surrounds the username with a literal `@` outside
  // the `<a>` element (e.g. `@<a href="/member/foo">foo</a>`), so
  // emitting the bare username preserves the natural `@username`
  // shape without producing the `@@username` double-prefix.
  td.addRule("v2ex-mention", {
    filter: (node) => {
      if (node.nodeName !== "A") return false;
      const href = (node as Element).getAttribute?.("href") ?? "";
      return /^\/member\/[\w-]+/.test(href);
    },
    replacement: (content) => content.trim(),
  });

  return td;
}

/** Format a v2ex post-header "title" timestamp into a short date. */
function shortDate(raw: string): string {
  if (!raw) return "";
  // Format the fetcher captures: "2023-10-06 14:15:08 +08:00" (full ISO-ish)
  // OR Oct 6, 2023 (display string, fallback). Strip the time + tz when full.
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : raw;
}

function convertPostBody(post: V2exPost, td: TurndownService): { md: string; images: V2exImageDownload[] } {
  const dom = new JSDOM(`<div id="root">${post.contentHtml}</div>`);
  const root = dom.window.document.getElementById("root")!;

  // Collect images BEFORE turndown (for localization). Use a per-post
  // counter to keep filenames stable + collision-free.
  const images: V2exImageDownload[] = [];
  let imgIdx = 0;
  for (const img of root.querySelectorAll("img")) {
    let src = img.getAttribute("src") || "";
    if (!src || !/^https?:\/\//i.test(src)) continue;
    // v2ex users routinely embed Imgur via the web-URL form
    // (`imgur.com/<id>.png`), which returns an HTML page rather than
    // the image bytes. Rewrite to `i.imgur.com/<id>.png` (the CDN URL)
    // before download. Non-Imgur srcs pass through unchanged.
    src = src.replace(/^https?:\/\/(?:www\.)?imgur\.com\//i, "https://i.imgur.com/");
    imgIdx++;
    const ext = (src.match(/\.([a-z0-9]+)(?:[?#]|$)/i)?.[1] ?? "jpg").toLowerCase();
    const local = `v2ex-${post.no.toString().padStart(3, "0")}-${imgIdx.toString().padStart(2, "0")}.${ext.length <= 4 ? ext : "jpg"}`;
    images.push({ remoteUrl: src, localFilename: local });
    img.setAttribute("src", local);
    img.removeAttribute("loading");
    img.removeAttribute("referrerpolicy");
    img.removeAttribute("rel");
  }

  let md = td.turndown(root.innerHTML).trim();
  md = applyCommonMarkdownCleanups(md);
  return { md, images };
}

export function convertV2exTopic(topic: V2exTopic): V2exConvertResult {
  const td = makeTurndown();
  const allImages: V2exImageDownload[] = [];

  const lines: string[] = [];
  lines.push(`# ${topic.title || "(untitled)"}`);
  lines.push("");
  lines.push(`> 原文链接: ${topic.url}`);
  const metaParts: string[] = [];
  metaParts.push(`共 ${topic.posts.length} 楼`);
  if (topic.views) metaParts.push(`${topic.views} 浏览`);
  lines.push(`> 主题元信息: ${metaParts.join(" · ")}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const post of topic.posts) {
    const date = shortDate(post.date);
    const userPart = post.username ? `@${post.username}` : "@anonymous";
    let header = `## #${post.no} ${userPart}`;
    if (date) header += ` · ${date}`;
    if (!post.isOp && post.badgeOp) header += "  (OP comment)";
    lines.push(header);
    lines.push("");

    const { md, images } = convertPostBody(post, td);
    allImages.push(...images);
    lines.push(md);
    lines.push("");
  }

  const markdown = lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  return {
    markdown,
    imagesToDownload: allImages,
    metadata: {
      title: topic.title,
      topic_id: topic.topicId,
      posts_included: topic.posts.length,
      views: topic.views,
    },
    stats: {
      bodyChars: markdown.length,
      posts: topic.posts.length,
    },
  };
}
