/**
 * epoch.ai fetcher — extracts the page's prose context via opencli's
 * browser session AND downloads the underlying CSV dataset via curl.
 *
 * epoch.ai pages render the actual data as a JS-driven Tableau-style
 * interactive viz (35+ `.graph-table` divs, 91+ inline SVGs, 1+ canvas).
 * The generic web-fetch path captures only UI control labels because
 * the data lives in JS state. The page DOES, however, link to a CSV
 * download for every dataset — that's the source of truth we use here.
 */

import { execSync, spawnSync } from "node:child_process";
import { sleepMs, closeBrowser, browserTimeoutMs } from "../../fetch-raw.ts";
import { extractJsonFromEvalStdout } from "../_shared/browser-eval-json.ts";

export interface EpochAiContent {
  /** outerHTML of the .description / intro container (everything ABOVE the viz). */
  introHtml: string;
  title: string;
  /** Resolved CSV URL (e.g., https://epoch.ai/data/ml_hardware.csv). Empty on failure. */
  csvUrl: string;
  /** Raw CSV text content. Empty on download failure. */
  csvText: string;
  finalUrl?: string;
  error?: string;
}

export function extractEpochAiContent(url: string): EpochAiContent {
  let browserOpened = false;
  try {
    const openRes = spawnSync(
      "opencli", ["browser", "open", url],
      { encoding: "utf8", timeout: browserTimeoutMs("open") },
    );
    if (openRes.status !== 0) {
      return {
        introHtml: "", title: "", csvUrl: "", csvText: "",
        error: `browser open failed: ${(openRes.stderr || "").slice(0, 200)}`,
      };
    }
    browserOpened = true;
    sleepMs(6000);

    const evalScript = `(() => {
      const title = (document.title || '').replace(/\\s*\\|\\s*Epoch AI\\s*$/i, '').trim();
      // epoch.ai pages put title + description in <section class="header-col"> with
      // children: <div class="_top_*"> (date + h1) and <div class="_bottom_*">
      // (description prose). Target this container directly so we get the
      // dataset description and NOT the site-wide topic-list sidebar.
      let intro = '';
      const headerSection = document.querySelector('section[class*="header-col"], section.header-col');
      if (headerSection) {
        intro = headerSection.outerHTML;
      } else {
        // Fallback: find the first <h1>'s parent's parent <section>.
        const h1 = document.querySelector('h1');
        if (h1) {
          const sec = h1.closest('section');
          if (sec) intro = sec.outerHTML;
        }
      }
      // Find the CSV download link.
      const links = Array.from(document.querySelectorAll('a[href$=".csv"]'));
      const csvUrl = links.length > 0 ? new URL(links[0].getAttribute('href') || '', window.location.href).href : '';
      return JSON.stringify({
        introHtml: intro,
        title,
        csvUrl,
        finalUrl: window.location.href,
      });
    })()`;

    const evalRes = spawnSync(
      "opencli", ["browser", "eval", evalScript],
      { encoding: "utf8", timeout: browserTimeoutMs("eval"), maxBuffer: 32 * 1024 * 1024 },
    );
    if (evalRes.status !== 0) {
      return {
        introHtml: "", title: "", csvUrl: "", csvText: "",
        error: `browser eval failed: ${(evalRes.stderr || "").slice(0, 200)}`,
      };
    }

    const parsed = extractJsonFromEvalStdout(evalRes.stdout || "") as {
      introHtml?: string;
      title?: string;
      csvUrl?: string;
      finalUrl?: string;
    } | null;
    if (!parsed) {
      return {
        introHtml: "", title: "", csvUrl: "", csvText: "",
        error: "no JSON object in eval output",
      };
    }

    let csvText = "";
    if (parsed.csvUrl) {
      try {
        csvText = execSync(
          `curl -fsSL --max-time 30 -A "Mozilla/5.0" ${JSON.stringify(parsed.csvUrl)}`,
          { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
        );
      } catch { /* CSV unavailable; continue with intro only */ }
    }

    return {
      introHtml: parsed.introHtml || "",
      title: parsed.title || "",
      csvUrl: parsed.csvUrl || "",
      csvText,
      finalUrl: parsed.finalUrl,
    };
  } catch (e) {
    return {
      introHtml: "", title: "", csvUrl: "", csvText: "",
      error: `extractEpochAiContent threw: ${e instanceof Error ? e.message : e}`,
    };
  } finally {
    if (browserOpened) {
      try { closeBrowser(); } catch { /* best-effort */ }
    }
  }
}
