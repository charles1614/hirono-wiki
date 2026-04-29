/**
 * github.com site module.
 *
 * Per the universal pattern (CLAUDE.md §5a): NO opencli, NO web-read.
 * Internal dispatch by URL pattern picks one of three structured sources:
 *   - REST API for /pull, /issues, /discussions
 *   - Release API for /releases/tag/<v>
 *   - raw.githubusercontent.com for /blob/<branch>/<path>, /tree/<branch>,
 *     and the repo root (which we treat as README.md)
 *
 * Reference implementation alongside `tools/sites/weixin/` and `tools/sites/xhs/`.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { Site } from "../_shared/types.ts";
import {
  parseGithubUrl,
  fetchPrIssue,
  fetchRelease,
  fetchRaw,
  fetchTreeReadme,
  fetchRepoReadme,
} from "./fetcher.ts";
import {
  convertGithubPrIssue,
  convertGithubRelease,
  convertGithubRaw,
  type GithubImageDownload,
} from "./converter.ts";
import { downloadImage } from "../../fetch-raw.ts";

/**
 * Iterate the converter's `imagesToDownload` list, fetch each via curl,
 * and return the local filenames that landed on disk. Mirrors the
 * pattern used by other site modules (zhihu, substack, weixin) — the
 * converter pre-allocates filenames; the runtime fetches the bytes.
 */
function downloadAll(
  imagesToDownload: GithubImageDownload[],
  slugDir: string,
): { images: string[]; failed: number } {
  const images: string[] = [];
  let failed = 0;
  for (const dl of imagesToDownload) {
    const dest = join(slugDir, dl.localFilename);
    const bytes = downloadImage(dl.remoteUrl, dest);
    if (bytes > 0) images.push(dl.localFilename);
    else failed++;
  }
  return { images, failed };
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

export const site: Site = {
  name: "github",
  match: (url) => hostOf(url) === "github.com",
  fetch: (url, opts) => {
    mkdirSync(opts.slugDir, { recursive: true });

    const parsed = parseGithubUrl(url);
    if (!parsed) {
      return stubResult(url, "github URL parse failed");
    }
    const { kind, org, repo } = parsed;

    // ── PR / issue / discussion ──────────────────────────────────────
    if (kind === "pr" || kind === "issue" || kind === "discussion") {
      const result = fetchPrIssue(org, repo, parsed.ref!, kind);
      if (!result) {
        return stubResult(url, `github ${kind} REST API fetch failed (rate limit? auth?)`);
      }
      const conv = convertGithubPrIssue({
        kind: kind === "pr" ? "pull" : kind === "issue" ? "issues" : "discussions",
        org,
        repo,
        number: parseInt(parsed.ref!, 10),
        originUrl: url,
        main: result.main,
        comments: result.comments,
        reviews: result.reviews,
        reviewComments: result.reviewComments,
      });

      const { images, failed } = downloadAll(conv.imagesToDownload, opts.slugDir);

      return {
        markdown: conv.markdown,
        images,
        title: `${result.main.title || ""} · ${kind}#${parsed.ref}`,
        metadata: {
          source: "github-api",
          kind,
          org, repo,
          number: parsed.ref,
          comment_count: result.comments.length,
        },
        flags: failed > 0 ? ["github-image-download-partial"] : [],
        notes: [
          `github: ${kind} #${parsed.ref} via REST API (${result.comments.length} comment(s)` +
          `${images.length > 0 ? `, ${images.length}/${conv.imagesToDownload.length} image(s) downloaded` : ""}` +
          `${failed > 0 ? ` (${failed} failed)` : ""}` + `)`,
        ],
      };
    }

    // ── Release ──────────────────────────────────────────────────────
    if (kind === "release") {
      const release = fetchRelease(org, repo, parsed.ref!);
      if (!release || !release.body) {
        return stubResult(url, `github release ${parsed.ref} fetch failed or empty body`);
      }
      const conv = convertGithubRelease({
        org, repo,
        tag: parsed.ref!,
        originUrl: url,
        release,
      });

      const { images, failed } = downloadAll(conv.imagesToDownload, opts.slugDir);

      return {
        markdown: conv.markdown,
        images,
        title: `${org}/${repo}: ${release.name || release.tag_name || parsed.ref}`,
        metadata: {
          source: "github-api-release",
          org, repo,
          tag: parsed.ref,
          published_at: release.published_at,
          author: release.author?.login,
        },
        flags: failed > 0 ? ["github-image-download-partial"] : [],
        notes: [
          `github: release ${parsed.ref} via REST API (${(release.body || "").length} body chars` +
          `${images.length > 0 ? `, ${images.length}/${conv.imagesToDownload.length} image(s) downloaded` : ""}` +
          `${failed > 0 ? ` (${failed} failed)` : ""}` + `)`,
        ],
      };
    }

    // ── Raw markdown blob (blob / tree / repo-root) ──────────────────
    let raw = null;
    let branch = "HEAD";
    let path = "README.md";
    if (kind === "blob") {
      raw = fetchRaw(org, repo, parsed.branch!, parsed.path!);
      branch = parsed.branch!;
      path = parsed.path!;
    } else if (kind === "tree") {
      raw = fetchTreeReadme(org, repo, parsed.branch!, parsed.path || "");
      branch = parsed.branch!;
      path = (parsed.path ? `${parsed.path}/` : "") + "README.md";
    } else if (kind === "repo") {
      raw = fetchRepoReadme(org, repo);
    }
    if (!raw) {
      return stubResult(url, `github raw fetch failed for ${kind} (path may not be markdown, or 404)`);
    }
    const conv = convertGithubRaw({
      org, repo,
      branch: raw.branch,
      path: raw.resolvedPath,
      originUrl: url,
      body: raw.body,
    });

    const { images, failed } = downloadAll(conv.imagesToDownload, opts.slugDir);

    return {
      markdown: conv.markdown,
      images,
      title: `${org}/${repo}: ${raw.resolvedPath}`,
      metadata: {
        source: "github-raw",
        org, repo,
        branch: raw.branch,
        path: raw.resolvedPath,
        kind,
      },
      flags: failed > 0 ? ["github-image-download-partial"] : [],
      notes: [
        `github: raw ${kind} (${raw.resolvedPath}) via raw.githubusercontent.com (${raw.body.length} chars` +
        `${images.length > 0 ? `, ${images.length}/${conv.imagesToDownload.length} image(s) downloaded` : ""}` +
        `${failed > 0 ? ` (${failed} failed)` : ""}` + `)`,
      ],
    };
  },
};

/** Build a §2-contract stub when fetching fails (auth/rate-limit/404). */
function stubResult(url: string, reason: string) {
  return {
    markdown:
      `# GitHub: ${url}\n\n` +
      `> 原文链接: ${url}\n\n` +
      `---\n\n` +
      `*This entry is a metadata stub. ${reason}*\n`,
    images: [],
    metadata: { source: "github-stub", reason },
    flags: ["intentional-stub", "github-fetch-failed"],
    notes: [`github: stub emitted — ${reason}`],
  };
}
