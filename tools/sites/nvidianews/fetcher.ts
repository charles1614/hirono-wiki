/**
 * nvidianews.nvidia.com fetcher — uses opencli's browser session to extract
 * the structured `.article` container directly. Generic web-read picks up
 * the wrong main-content div (a sidebar with cross-links to other press
 * releases), missing the actual press-release body entirely.
 */

import { spawnSync } from "node:child_process";
import { sleepMs, closeBrowser, browserTimeoutMs } from "../_shared/browser-helpers.ts";
import { extractJsonFromEvalStdout } from "../_shared/browser-eval-json.ts";

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
    // 4s — was 2.5s; under concurrent sweep load the .article container
    // wasn't always hydrated in time and the eval would return "not found"
    // even though the URL was reachable.
    sleepMs(4000);

    const evalScript = `(() => {
      // Selector cascade: .article is the current press-release wrapper.
      // Fallbacks (article.press-release, plain article, [role=main]) are
      // there to absorb future layout changes without immediately stubbing.
      // We diagnose all candidates so error_detail captures what was on-page
      // when extraction fails.
      const candidates = [".article", "article.press-release", "article", "[role=main]"];
      let article = null;
      const probe = [];
      for (const sel of candidates) {
        const el = document.querySelector(sel);
        const len = el ? el.textContent.length : 0;
        probe.push({ sel, found: !!el, len });
        if (el && len > 200 && !article) article = el;
      }
      if (!article) return JSON.stringify({ error: "no article container matched", probe, bodyLen: document.body.textContent.length });
      const title = article.querySelector(".article-title, h1.article-title, h1")?.textContent?.trim() || document.querySelector("h1")?.textContent?.trim() || "";
      const subtitle = article.querySelector(".article-subtitle, .subtitle, .deck")?.textContent?.trim() || "";
      const date = article.querySelector(".article-date, .date, time")?.textContent?.trim() || "";
      const hero = article.querySelector(".article-hero img, .hero img, figure img");
      const heroImageUrl = hero ? (hero.getAttribute("src") || "") : "";
      const body = article.querySelector(".article-body, .body, .press-release-body") || article;
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

    const parsed = extractJsonFromEvalStdout(evalRes.stdout || "") as {
      title?: string;
      subtitle?: string;
      date?: string;
      bodyHtml?: string;
      heroImageUrl?: string;
      finalUrl?: string;
      error?: string;
      probe?: Array<{ sel: string; found: boolean; len: number }>;
      bodyLen?: number;
    } | null;
    if (!parsed) {
      return {
        title: "", subtitle: "", date: "", bodyHtml: "", heroImageUrl: "",
        error: "no JSON object in eval output",
      };
    }
    if (parsed.error) {
      // Surface the per-selector probe in the error so error_detail
      // surfaces "what was on the page" when the cascade fails.
      const probeStr = parsed.probe
        ? parsed.probe.map(p => `  ${p.sel}: ${p.found ? `found (${p.len} chars)` : "(not present)"}`).join("\n")
        : "";
      const detail = `${parsed.error}` +
        (probeStr ? `\nselector cascade probe:\n${probeStr}` : "") +
        (typeof parsed.bodyLen === "number" ? `\ntotal body chars: ${parsed.bodyLen}` : "");
      return {
        title: "", subtitle: "", date: "", bodyHtml: "", heroImageUrl: "",
        error: detail,
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
      error: `extractNvidianewsContent threw: ${e instanceof Error ? e.message : e}`,
    };
  } finally {
    if (browserOpened) closeBrowser();
  }
}
