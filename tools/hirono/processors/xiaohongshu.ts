/**
 * xiaohongshu.com / xhslink.com post-processor: convert opencli's
 * `xiaohongshu note -f md` table-format output into clean §2 markdown.
 *
 * Active on the LEGACY FALLBACK PATH only — when the Layer-4 raw-HTML
 * extractor (`extractXhsFullContent` in fetch-raw.ts +
 * `convertXhsHtml` in `tools/hirono/xhs/raw-html-converter.ts`) cannot
 * recover the body text (image-only posts, expired session, captcha).
 * On the Layer-4 path the input markdown has no `| field | value |`
 * table, so this processor's `if (!sawTable) return md` early-return
 * makes it a no-op there.
 *
 * Migrated from `tools/hirono/shared/post-process.ts` (Track C
 * structural cleanup) — establishes the per-host file pattern so the
 * other ~10 site-specific processors still in shared/ can move out
 * one-by-one. See CLAUDE.md §5d.
 */

import type { PostProcessor } from "../shared/post-process.ts";

export const xhsReformatNoteTable: PostProcessor = {
  name: "xhs-reformat-note-table",
  match: (_u, h) => /(?:^|\.)xiaohongshu\.com$/i.test(h) || h === "xhslink.com",
  transform: (md, originUrl) => {
    const lines = md.split("\n");
    const kv = new Map<string, string>();
    let sawTable = false;
    for (const line of lines) {
      const m = line.match(/^\|\s*(\w+)\s*\|\s*(.+?)\s*\|\s*$/);
      if (!m) continue;
      const k = m[1];
      const v = m[2];
      if (k === "field" || k === "---") continue;
      sawTable = true;
      kv.set(k, v);
    }
    if (!sawTable) return { md, newAbsoluteImageUrls: [], notes: [] };

    const imagesIdx = md.indexOf("## Images");
    const imagesSection = imagesIdx >= 0 ? md.slice(imagesIdx) : "";

    const reformatContent = (raw: string): string => {
      if (!raw.trim()) return "";
      const breakers = [
        /\s(📌)/g,
        /\s(👉)/g,
        /\s(1️⃣|2️⃣|3️⃣|4️⃣|5️⃣|6️⃣|7️⃣|8️⃣|9️⃣|🔟)/g,
        /\s(✅|❌|⚠️|🔥)/g,
      ];
      let out = raw;
      for (const re of breakers) out = out.replace(re, "\n\n$1");
      out = out.replace(/ {2,}/g, "\n\n");
      return out.split("\n").map((l) => l.trim()).filter((l, i, a) =>
        l !== "" || (a[i - 1] !== undefined && a[i - 1] !== "")
      ).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    };

    const result: string[] = [];
    const title = kv.get("title") || "(Xiaohongshu note)";
    result.push(`# ${title}`);
    result.push("");
    // §2 contract: blockquote frontmatter (`> 原文链接:` + optional metadata).
    result.push(`> 原文链接: ${originUrl}`);
    if (kv.get("author")) result.push(`> 作者: ${kv.get("author")}`);
    const stats: string[] = [];
    if (kv.get("likes")) stats.push(`${kv.get("likes")} likes`);
    if (kv.get("collects")) stats.push(`${kv.get("collects")} collects`);
    if (kv.get("comments")) stats.push(`${kv.get("comments")} comments`);
    if (stats.length) result.push(`> 互动: ${stats.join(" · ")}`);
    result.push("", "---", "");

    const contentRaw = kv.get("content") || "";
    const contentReformatted = reformatContent(contentRaw);
    if (contentReformatted) {
      result.push(contentReformatted);
      result.push("");
    } else {
      result.push(`*[Text content unavailable — this may be an image-only post.]*`);
      result.push("");
    }

    if (kv.get("tags")) result.push(`**标签 / Tags:** ${kv.get("tags")}`);

    if (imagesSection) {
      result.push("");
      result.push(imagesSection.trimEnd());
    }

    const final = result.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
    return {
      md: final,
      newAbsoluteImageUrls: [],
      notes: [`xhs: reformatted ${kv.size}-field table to prose layout`],
    };
  },
};
