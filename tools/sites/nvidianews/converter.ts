/**
 * nvidianews.nvidia.com converter — pure function from extracted article
 * fields to clean §2 markdown.
 */

import { JSDOM } from "jsdom";
import TurndownService from "turndown";
// @ts-expect-error  no types
import { gfm } from "@joplin/turndown-plugin-gfm";

import { applyCommonMarkdownCleanups } from "../_shared/markdown-cleanups.ts";

export interface NvidianewsImageDownload {
  remoteUrl: string;
  localFilename: string;
}

export interface NvidianewsConvertResult {
  markdown: string;
  imagesToDownload: NvidianewsImageDownload[];
  metadata: {
    title: string;
    subtitle: string;
    date: string;
  };
  stats: {
    images: number;
    paragraphs: number;
    codeFences: number;
  };
}

export interface ConvertOpts {
  title: string;
  subtitle: string;
  date: string;
  bodyHtml: string;
  heroImageUrl: string;
  url: string;
}

export function convertNvidianewsHtml(opts: ConvertOpts): NvidianewsConvertResult {
  const dom = new JSDOM(`<!doctype html><html><body>${opts.bodyHtml || ""}</body></html>`);
  const doc = dom.window.document;
  const root = doc.body;

  // Localize remaining `<img>` refs in the body.
  const imagesToDownload: NvidianewsImageDownload[] = [];
  let imgCounter = 0;
  // Hero image first if present (becomes img-001).
  if (opts.heroImageUrl) {
    imgCounter++;
    const ext = guessExt(opts.heroImageUrl);
    imagesToDownload.push({
      remoteUrl: absUrl(opts.heroImageUrl, opts.url),
      localFilename: `nvidianews-img-${String(imgCounter).padStart(3, "0")}${ext}`,
    });
  }
  for (const img of Array.from(root.querySelectorAll("img"))) {
    const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
    if (!src || src.startsWith("data:")) {
      img.remove();
      continue;
    }
    const abs = absUrl(src, opts.url);
    imgCounter++;
    const ext = guessExt(abs);
    const local = `nvidianews-img-${String(imgCounter).padStart(3, "0")}${ext}`;
    img.setAttribute("src", local);
    imagesToDownload.push({ remoteUrl: abs, localFilename: local });
  }

  // Drop noise IDs/classes.
  for (const el of Array.from(root.querySelectorAll("[id]"))) el.removeAttribute("id");

  const td = makeTurndown();
  let body = td.turndown(root.innerHTML).trim();

  // Bold-colon normalization (consistent with weixin/zhihu/deepwiki/linux-do).
  body = body.replace(/\*\*([^*\n]+?)([:：])\*\*/g, "**$1**$2");
  body = body.replace(/\n{3,}/g, "\n\n");

  const fmLines: string[] = [
    `# ${opts.title || "NVIDIA Newsroom press release"}`,
    "",
  ];
  if (opts.subtitle) {
    fmLines.push(`> ${opts.subtitle}`);
  }
  if (opts.date) fmLines.push(`> 发布时间: ${opts.date}`);
  fmLines.push(`> 原文链接: ${opts.url}`);
  fmLines.push("");
  fmLines.push("---");
  fmLines.push("");
  if (opts.heroImageUrl) {
    fmLines.push(`![${opts.title || "hero"}](nvidianews-img-001${guessExt(opts.heroImageUrl)})`);
    fmLines.push("");
  }

  const markdown = applyCommonMarkdownCleanups(fmLines.join("\n") + body + "\n");
  const features = countFeatures(markdown);

  return {
    markdown,
    imagesToDownload,
    metadata: { title: opts.title, subtitle: opts.subtitle, date: opts.date },
    stats: {
      images: imagesToDownload.length,
      paragraphs: (root.querySelectorAll("p").length),
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
      const m = cls.match(/(?:language|lang)-(\S+)/);
      const lang = m ? m[1] : "";
      const trimmed = text.replace(/\r\n/g, "\n").replace(/^\n+/, "").replace(/\n+$/, "");
      return `\n\n\`\`\`${lang}\n${trimmed}\n\`\`\`\n\n`;
    },
  });
  return td;
}

function absUrl(src: string, base: string): string {
  try { return new URL(src, base).href; }
  catch { return src; }
}

function guessExt(url: string): string {
  try {
    const p = new URL(url, "https://nvidianews.nvidia.com/").pathname.toLowerCase();
    const m = p.match(/\.(png|jpe?g|gif|webp|svg)$/);
    if (m) return "." + (m[1] === "jpeg" ? "jpg" : m[1]);
  } catch { /* fall through */ }
  return ".jpg";
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
