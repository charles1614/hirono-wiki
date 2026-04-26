/**
 * nvidianews.nvidia.com fetcher — uses opencli's browser session to extract
 * the structured `.article` container directly. Generic web-read picks up
 * the wrong main-content div (a sidebar with cross-links to other press
 * releases), missing the actual press-release body entirely.
 */

import { spawnSync } from "node:child_process";
import { sleepMs, closeBrowser, browserTimeoutMs } from "../../fetch-raw.ts";

export interface NvidianewsContent {
  title: string;
  subtitle: string;
  date: string;
  bodyHtml: string;
  /** Hero image absolute URL (or empty if none). */
  heroImageUrl: string;
  finalUrl?: string;
  error?: string;
}

export function extractNvidianewsContent(url: string): NvidianewsContent {
  let browserOpened = false;
  try {
    const openRes = spawnSync(
      "opencli",
      ["browser", "open", url],
      { encoding: "utf8", timeout: browserTimeoutMs("open") },
    );
    if (openRes.status !== 0) {
      return {
        title: "", subtitle: "", date: "", bodyHtml: "", heroImageUrl: "",
        error: `browser open failed: ${(openRes.stderr || "").slice(0, 200)}`,
      };
    }
    browserOpened = true;
    sleepMs(2500);

    const evalScript = `(() => {
      const article = document.querySelector(".article");
      if (!article) return JSON.stringify({ error: ".article container not found" });
      const title = article.querySelector(".article-title, h1.article-title, h1")?.textContent?.trim() || "";
      const subtitle = article.querySelector(".article-subtitle")?.textContent?.trim() || "";
      const date = article.querySelector(".article-date")?.textContent?.trim() || "";
      const hero = article.querySelector(".article-hero img");
      const heroImageUrl = hero ? (hero.getAttribute("src") || "") : "";
      const body = article.querySelector(".article-body");
      const bodyHtml = body ? body.innerHTML : "";
      return JSON.stringify({ title, subtitle, date, bodyHtml, heroImageUrl, finalUrl: window.location.href });
    })()`;

    const evalRes = spawnSync("opencli", ["browser", "eval", evalScript], {
      encoding: "utf8",
      timeout: browserTimeoutMs("eval"),
      maxBuffer: 32 * 1024 * 1024,
    });
    if (evalRes.status !== 0) {
      return {
        title: "", subtitle: "", date: "", bodyHtml: "", heroImageUrl: "",
        error: `browser eval failed: ${(evalRes.stderr || "").slice(0, 200)}`,
      };
    }

    const stdout = evalRes.stdout || "";
    const start = stdout.indexOf("{");
    if (start < 0) {
      return {
        title: "", subtitle: "", date: "", bodyHtml: "", heroImageUrl: "",
        error: "no JSON object in eval output",
      };
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
      return {
        title: "", subtitle: "", date: "", bodyHtml: "", heroImageUrl: "",
        error: "unterminated JSON",
      };
    }

    try {
      const parsed = JSON.parse(stdout.slice(start, end + 1));
      if (parsed.error) {
        return {
          title: "", subtitle: "", date: "", bodyHtml: "", heroImageUrl: "",
          error: parsed.error,
        };
      }
      return {
        title: parsed.title || "",
        subtitle: parsed.subtitle || "",
        date: parsed.date || "",
        bodyHtml: parsed.bodyHtml || "",
        heroImageUrl: parsed.heroImageUrl || "",
        finalUrl: parsed.finalUrl || undefined,
      };
    } catch (e) {
      return {
        title: "", subtitle: "", date: "", bodyHtml: "", heroImageUrl: "",
        error: `JSON parse failed: ${e instanceof Error ? e.message : e}`,
      };
    }
  } catch (e) {
    return {
      title: "", subtitle: "", date: "", bodyHtml: "", heroImageUrl: "",
      error: `extractNvidianewsContent threw: ${e instanceof Error ? e.message : e}`,
    };
  } finally {
    if (browserOpened) closeBrowser();
  }
}
