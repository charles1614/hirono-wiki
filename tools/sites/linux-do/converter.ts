/**
 * linux.do converter — pure function from `LinuxDoTopic` to clean §2 markdown.
 *
 * Layout:
 *
 *   # <Title>
 *
 *   > 原文链接: <canonical-url>
 *   > 主题元信息: 共 N 楼 · X 浏览 · Y 点赞 · 标签 [...]  ←  metadata callout
 *
 *   ---
 *
 *   ## #1 @username · YYYY-MM-DD                                  ← OP
 *   <converted cooked HTML>
 *
 *   ## #N @username · YYYY-MM-DD  (回复 #M)                       ← reply
 *   <converted cooked HTML>
 *
 *   ...
 *
 * Discourse's `cooked` HTML is reasonably clean already (no script/iframe
 * cruft), but it includes:
 *   - `<aside class="onebox">` — link previews. Useful, kept but flattened
 *     to a `> Link preview: <url>` blockquote so they don't visually
 *     dominate the post body.
 *   - `<aside class="quote">` — quoted text from earlier post. Convert to
 *     a `> @user wrote:` blockquote.
 *   - `<div class="lightbox-wrapper">` around images — unwrap, just keep
 *     the inner image ref.
 *   - Emoji `<img class="emoji">` — replace with their `:alt:` shortcode
 *     so they don't pollute the body with avatar refs.
 *   - `<a class="mention">@user</a>` — keep as plain `@user` text (no link).
 */

import { JSDOM } from "jsdom";
import TurndownService from "turndown";
// @ts-expect-error  no types
import { gfm } from "@joplin/turndown-plugin-gfm";

import { applyCommonMarkdownCleanups } from "../_shared/markdown-cleanups.ts";
import type { LinuxDoTopic, LinuxDoPost } from "./fetcher.ts";

export interface LinuxDoImageDownload {
  remoteUrl: string;
  localFilename: string;
}

export interface LinuxDoConvertResult {
  markdown: string;
  imagesToDownload: LinuxDoImageDownload[];
  metadata: {
    title: string;
    topic_id: number;
    posts_count: number;
    posts_included: number;
    views?: number;
    like_count?: number;
    tags?: string[];
  };
  stats: {
    posts: number;
    images: number;
    oneboxes: number;
    quotes: number;
    codeFences: number;
  };
}

export function convertLinuxDoTopic(topic: LinuxDoTopic): LinuxDoConvertResult {
  const td = makeTurndown();

  const imagesToDownload: LinuxDoImageDownload[] = [];
  let imgCounter = 0;
  let oneboxes = 0;
  let quotes = 0;

  const renderPost = (p: LinuxDoPost): string => {
    const dom = new JSDOM(`<!doctype html><html><body>${p.cooked}</body></html>`);
    const doc = dom.window.document;

    // Flatten oneboxes (link previews) to a single blockquote line.
    for (const aside of Array.from(doc.querySelectorAll("aside.onebox"))) {
      const link = aside.querySelector("a[href]");
      const href = link?.getAttribute("href") || aside.getAttribute("data-onebox-src") || "";
      const title = aside.querySelector("h3, h4, .source a, header a")?.textContent?.trim() || href;
      const replacement = doc.createElement("blockquote");
      const p = doc.createElement("p");
      p.textContent = `🔗 ${title}${href && href !== title ? ` — ${href}` : ""}`;
      replacement.appendChild(p);
      aside.replaceWith(replacement);
      oneboxes++;
    }

    // Convert <aside class="quote"> → blockquote with `> @user wrote:` lead-in.
    for (const aside of Array.from(doc.querySelectorAll("aside.quote"))) {
      const cited = aside.querySelector(".title a, .title")?.textContent?.trim() || "";
      const inner = aside.querySelector("blockquote") || aside;
      const userMatch = cited.match(/@?([\w._-]+)/);
      const lead = userMatch ? `@${userMatch[1]} 引用：` : "引用：";
      const repl = doc.createElement("blockquote");
      const leadP = doc.createElement("p");
      leadP.innerHTML = `<em>${lead}</em>`;
      repl.appendChild(leadP);
      // Preserve the inner content
      while (inner.firstChild) repl.appendChild(inner.firstChild);
      aside.replaceWith(repl);
      quotes++;
    }

    // Unwrap lightbox wrappers.
    for (const wrap of Array.from(doc.querySelectorAll(".lightbox-wrapper"))) {
      const img = wrap.querySelector("img");
      if (img) wrap.replaceWith(img);
      else wrap.remove();
    }

    // Replace emoji <img class="emoji"> with their `:alt:` shortcode.
    for (const e of Array.from(doc.querySelectorAll("img.emoji"))) {
      const alt = (e.getAttribute("title") || e.getAttribute("alt") || "").replace(/^:|:$/g, "");
      e.replaceWith(doc.createTextNode(alt ? `:${alt}:` : ""));
    }

    // Localize remaining images.
    for (const img of Array.from(doc.querySelectorAll("img"))) {
      const src = img.getAttribute("src") || "";
      if (!src || src.startsWith("data:")) {
        img.remove();
        continue;
      }
      let abs: string;
      try {
        abs = new URL(src, "https://linux.do/").href;
      } catch {
        img.remove();
        continue;
      }
      imgCounter++;
      const ext = guessExt(abs);
      const local = `linuxdo-img-${String(imgCounter).padStart(3, "0")}${ext}`;
      img.setAttribute("src", local);
      imagesToDownload.push({ remoteUrl: abs, localFilename: local });
    }

    // Mention links → plain @user text.
    for (const m of Array.from(doc.querySelectorAll("a.mention"))) {
      m.replaceWith(doc.createTextNode(m.textContent || ""));
    }

    // Discourse decorates every heading with an empty `<a class="anchor">`
    // for in-page deep-linking. They render as ugly `[](#anchor)` in
    // markdown — strip them before turndown sees them.
    for (const a of Array.from(doc.querySelectorAll("a.anchor"))) {
      a.remove();
    }
    // Discourse also wraps post-edit-time markers, blame popups, and
    // similar widgets in spans we don't need.
    for (const sel of [".post-info-display", ".badge-notification", ".loading-container"]) {
      for (const el of Array.from(doc.querySelectorAll(sel))) el.remove();
    }

    return td.turndown(doc.body.innerHTML).trim();
  };

  // Compose body
  const lines: string[] = [];
  lines.push(`# ${topic.title || topic.fancy_title || `linux.do topic ${topic.id}`}`);
  lines.push("");
  lines.push(`> 原文链接: ${topic.canonicalUrl}`);
  const meta: string[] = [];
  meta.push(`共 ${topic.posts_count} 楼`);
  if (typeof topic.views === "number") meta.push(`${topic.views} 浏览`);
  if (typeof topic.like_count === "number") meta.push(`${topic.like_count} 点赞`);
  if (topic.tags && topic.tags.length > 0) meta.push(`标签 ${topic.tags.map((t) => t.name).join(", ")}`);
  if (meta.length > 0) lines.push(`> 主题元信息: ${meta.join(" · ")}`);
  if (topic.posts.length < topic.posts_count) {
    lines.push(`> *只归档了前 ${topic.posts.length}/${topic.posts_count} 楼。*`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const p of topic.posts) {
    const date = (p.created_at || "").slice(0, 10);
    const reply = p.reply_to_post_number ? ` (回复 #${p.reply_to_post_number})` : "";
    const head = `## #${p.post_number} @${p.username}${p.name && p.name !== p.username ? ` (${p.name})` : ""} · ${date}${reply}`;
    lines.push(head);
    lines.push("");
    lines.push(renderPost(p));
    lines.push("");
  }

  let markdown = lines.join("\n");
  markdown = markdown.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").replace(/\n+$/, "\n");

  // Bold-colon normalization (consistent with weixin/zhihu/deepwiki).
  markdown = markdown.replace(/\*\*([^*\n]+?)([:：])\*\*/g, "**$1**$2");

  // Emoji-shortcode escape repair. Discourse posts use `:emoji_name:`
  // shortcodes for custom forum emoji (e.g. `:high_voltage:`,
  // `:glowing_star:`, `:bili_057:`). Turndown over-escapes:
  //   - `\_` inside the shortcode (because `_` looks like emphasis to it)
  //   - `\!\[:name:\]` when the shortcode appears in a context turndown
  //     mistakes for image syntax
  // Both are fence-aware passes — leave inside code blocks alone.
  {
    const lines2 = markdown.split("\n");
    let inFence = false;
    for (let i = 0; i < lines2.length; i++) {
      if (/^```/.test(lines2[i].trim())) { inFence = !inFence; continue; }
      if (inFence) continue;
      // Pass A FIRST: unescape `\_` inside `:emoji_name:` shortcodes.
      // Looped until stable (a shortcode may have multiple `\_`). Run
      // before Pass B so the inner shortcode is normalized when we look
      // for `\!\[:name:\]` patterns.
      let prev: string;
      do {
        prev = lines2[i];
        lines2[i] = prev.replace(/(:[a-z][\w]*?)\\_([\w]*:)/g, "$1_$2");
      } while (lines2[i] !== prev);
      // Pass B: unwrap `!\[:name:\]` → `:name:` (turndown emitted image-
      // syntax escapes around a shortcode that's just text — only `[`
      // and `]` are escaped, the `!` is not). Runs AFTER Pass A so the
      // inner shortcode is already normalized.
      lines2[i] = lines2[i].replace(/!\\\[:([a-z][\w]*):\\\]/g, ":$1:");
    }
    markdown = lines2.join("\n");
  }

  // Shared post-turndown cleanups (insert space after closing `**` etc.).
  markdown = applyCommonMarkdownCleanups(markdown);

  const features = countFeatures(markdown);

  return {
    markdown,
    imagesToDownload,
    metadata: {
      title: topic.title,
      topic_id: topic.id,
      posts_count: topic.posts_count,
      posts_included: topic.posts.length,
      views: topic.views,
      like_count: topic.like_count,
      tags: topic.tags?.map((t) => t.name),
    },
    stats: {
      posts: topic.posts.length,
      images: imagesToDownload.length,
      oneboxes,
      quotes,
      codeFences: features.codeFences,
    },
  };
}

function makeTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    fence: "```",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });
  td.use(gfm);

  td.addRule("fenced-code", {
    filter: (node) => node.nodeName === "PRE",
    replacement: (_content, node) => {
      const pre = node as Element;
      const code = pre.querySelector("code");
      const text = (code ? code.textContent : pre.textContent) || "";
      const cls = code ? code.getAttribute("class") || "" : "";
      const wrap = pre.getAttribute("data-code-wrap") || "";
      const m = cls.match(/(?:language|lang)-(\S+)/);
      const lang = m ? m[1] : (wrap || "");
      const trimmed = text.replace(/\r\n/g, "\n").replace(/^\n+/, "").replace(/\n+$/, "");
      return `\n\n\`\`\`${lang}\n${trimmed}\n\`\`\`\n\n`;
    },
  });

  return td;
}

function guessExt(url: string): string {
  try {
    const p = new URL(url).pathname.toLowerCase();
    const m = p.match(/\.(png|jpe?g|gif|webp|svg)$/);
    if (m) return "." + (m[1] === "jpeg" ? "jpg" : m[1]);
  } catch { /* fall through */ }
  return ".png";
}

function countFeatures(md: string): { codeFences: number } {
  let fences = 0;
  let inFence = false;
  for (const line of md.split("\n")) {
    if (/^```/.test(line.trim())) {
      fences++;
      inFence = !inFence;
    }
  }
  return { codeFences: Math.floor(fences / 2) };
}
