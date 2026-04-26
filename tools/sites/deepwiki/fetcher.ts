/**
 * deepwiki fetcher — opencli browser open + a single eval call that pulls:
 *
 *   - title (document.title, cleaned of " | DeepWiki" suffix)
 *   - .prose outerHTML (the article container — covers both host variants)
 *   - mermaid sources, in document order, capped to the rendered SVG count
 *
 * Wait time is generous (18s) because deepwiki renders mermaid client-side
 * after markdown hydration and we need both phases to settle.
 */

import { spawnSync } from "node:child_process";
import { sleepMs, closeBrowser, browserTimeoutMs } from "../../fetch-raw.ts";

export interface DeepwikiContent {
  /** outerHTML of `.prose` — empty on failure (and `error` will be set). */
  contentHtml: string;
  /** mermaid sources in document order, ready to embed as code blocks. */
  mermaidSources: string[];
  /** Document title with " | DeepWiki" suffix stripped. Empty on failure. */
  title: string;
  /** Final URL after redirects. */
  finalUrl?: string;
  /** Set if any step failed; caller emits a stub. */
  error?: string;
}

export function extractDeepwikiContent(url: string): DeepwikiContent {
  let browserOpened = false;
  try {
    const openRes = spawnSync(
      "opencli",
      ["browser", "open", url],
      { encoding: "utf8", timeout: browserTimeoutMs("open") },
    );
    if (openRes.status !== 0) {
      return {
        contentHtml: "", mermaidSources: [], title: "",
        error: `browser open failed: ${(openRes.stderr || "").slice(0, 200)}`,
      };
    }
    browserOpened = true;
    // Both deepwiki variants render mermaid client-side after their markdown
    // hydration completes. Empirically 18s is the floor that gets every
    // diagram on a page with 9–10 of them; shorter waits gave inconsistent
    // splice counts. We accept the cost — there are 21 deepwiki bookmarks total.
    sleepMs(18_000);

    const evalScript = `(() => {
      const prose = document.querySelector(".prose");
      const rawTitle = (document.title || "").replace(/\\s*\\|\\s*DeepWiki\\s*$/i, "").trim();
      const h1 = prose ? prose.querySelector("h1") : null;
      const title = (h1 ? (h1.textContent || "").trim() : "") || rawTitle;

      // Strategy 1: data-original-text attribute (wiki.litenext.digital)
      const fromAttr = Array.from(document.querySelectorAll(".mermaid[data-original-text]"))
        .map(el => el.getAttribute("data-original-text"))
        .filter(s => typeof s === "string" && s.length > 0);

      // Strategy 2 (fallback): hydration-script extraction (deepwiki.com)
      // The page's Next.js bundle ships the entire wiki's mermaid sources
      // (one chunk per cross-linked page). We cap to the rendered SVG count,
      // taking the first N in document order — they correspond to the SVGs
      // on this page since deepwiki emits them in page order.
      let sources = fromAttr;
      if (sources.length === 0) {
        const renderedSvgs = document.querySelectorAll('svg[id^="mermaid"]');
        if (renderedSvgs.length > 0) {
          const fences = [];
          const re = /\\\`\\\`\\\`mermaid\\\\n([\\s\\S]*?)\\\`\\\`\\\`/g;
          for (const s of document.querySelectorAll("script")) {
            const t = s.textContent || "";
            let m;
            while ((m = re.exec(t)) !== null) fences.push(m[1]);
          }
          const decode = (raw) => {
            try {
              return JSON.parse('"' + raw.replace(/[\\x00-\\x1f]/g, c => '\\\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + '"');
            } catch { return null; }
          };
          const seen = new Set();
          const out = [];
          for (const raw of fences) {
            const decoded = decode(raw);
            if (!decoded) continue;
            const key = decoded.trim();
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(key);
            if (out.length >= renderedSvgs.length) break;
          }
          sources = out;
        }
      }

      return JSON.stringify({
        contentHtml: prose ? prose.outerHTML : "",
        mermaidSources: sources,
        title,
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
        contentHtml: "", mermaidSources: [], title: "",
        error: `browser eval failed: ${(evalRes.stderr || "").slice(0, 200)}`,
      };
    }

    const stdout = evalRes.stdout || "";
    const start = stdout.indexOf("{");
    if (start < 0) {
      return { contentHtml: "", mermaidSources: [], title: "", error: "no JSON object in eval output" };
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
      return { contentHtml: "", mermaidSources: [], title: "", error: "unterminated JSON" };
    }

    try {
      const parsed = JSON.parse(stdout.slice(start, end + 1));
      return {
        contentHtml: parsed.contentHtml || "",
        mermaidSources: Array.isArray(parsed.mermaidSources) ? parsed.mermaidSources : [],
        title: parsed.title || "",
        finalUrl: parsed.finalUrl || undefined,
      };
    } catch (e) {
      return {
        contentHtml: "", mermaidSources: [], title: "",
        error: `JSON parse failed: ${e instanceof Error ? e.message : e}`,
      };
    }
  } catch (e) {
    return {
      contentHtml: "", mermaidSources: [], title: "",
      error: `extractDeepwikiContent threw: ${e instanceof Error ? e.message : e}`,
    };
  } finally {
    if (browserOpened) closeBrowser();
  }
}
