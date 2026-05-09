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
import { makeStub } from "../_shared/stub.ts";
import {
  parseGithubUrl,
  fetchPrIssue,
  fetchRelease,
  fetchRaw,
  fetchTreeReadme,
  fetchRepoReadme,
  fetchGist,
  fetchCommit,
  fetchCompare,
} from "./fetcher.ts";
import {
  convertGithubPrIssue,
  convertGithubRelease,
  convertGithubRaw,
  convertGithubGist,
  convertGithubCommit,
  convertGithubCompare,
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
  match: (url) => {
    const h = hostOf(url);
    return h === "github.com" || h === "gist.github.com";
  },
  fetch: (url, opts) => {
    mkdirSync(opts.slugDir, { recursive: true });

    const parsed = parseGithubUrl(url);
    if (!parsed) {
      return stubResult(url, "github URL parse failed");
    }
    const { kind, org, repo } = parsed;

    // ── Gist ──────────────────────────────────────────────────────────
    if (kind === "gist") {
      const gist = fetchGist(repo); // `repo` carries the gist id
      if (!gist) {
        return stubResult(url, `github gist API fetch failed for ${repo} (rate limit? auth? 404?)`);
      }
      const conv = convertGithubGist({
        id: gist.id,
        description: gist.description,
        owner: gist.owner,
        created_at: gist.created_at,
        updated_at: gist.updated_at,
        files: gist.files.map((f) => ({
          filename: f.filename,
          language: f.language,
          type: f.type,
          content: f.content,
        })),
        originUrl: url,
      });
      const { images, failed } = downloadAll(conv.imagesToDownload, opts.slugDir);
      return {
        markdown: conv.markdown,
        images,
        title: gist.description || `gist:${gist.id.slice(0, 8)}`,
        metadata: {
          source: "github-gist",
          gist_id: gist.id,
          owner: gist.owner,
          file_count: gist.files.length,
          public: gist.public,
          updated_at: gist.updated_at,
        },
        flags: failed > 0 ? ["github-image-download-partial"] : [],
        notes: [
          `github: gist ${gist.id.slice(0, 8)} via REST API ` +
          `(${gist.files.length} file(s), ${gist.files.reduce((a, f) => a + f.content.length, 0)} chars` +
          `${images.length > 0 ? `, ${images.length}/${conv.imagesToDownload.length} image(s) downloaded` : ""}` +
          `${failed > 0 ? ` (${failed} failed)` : ""}` + `)`,
        ],
      };
    }

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

    // ── Commit ───────────────────────────────────────────────────────
    if (kind === "commit") {
      const commit = fetchCommit(org, repo, parsed.ref!);
      if (!commit || !commit.sha) {
        return stubResult(url, `github commit ${parsed.ref} fetch failed (404 or rate-limit)`);
      }
      const conv = convertGithubCommit({
        org, repo, sha: commit.sha,
        originUrl: url, commit,
      });
      const { images, failed } = downloadAll(conv.imagesToDownload, opts.slugDir);
      const subject = (commit.commit.message || "").split("\n")[0].trim();
      return {
        markdown: conv.markdown,
        images,
        title: `${org}/${repo}: ${subject || `commit ${commit.sha.slice(0, 7)}`}`,
        metadata: {
          source: "github-api-commit",
          org, repo,
          sha: commit.sha,
          author: commit.author?.login || commit.commit.author?.name,
          authored_at: commit.commit.author?.date,
        },
        flags: ["structured-summary", ...(failed > 0 ? ["github-image-download-partial"] : [])],
        notes: [
          `github: commit ${commit.sha.slice(0, 7)} via REST API ` +
          `(${commit.files?.length ?? 0} file(s), +${commit.stats?.additions ?? 0}/-${commit.stats?.deletions ?? 0})`,
        ],
      };
    }

    // ── Compare ──────────────────────────────────────────────────────
    if (kind === "compare") {
      const cmp = fetchCompare(org, repo, parsed.ref!);
      if (!cmp || !cmp.status) {
        return stubResult(
          url,
          `github compare ${parsed.ref} fetch failed (404, malformed spec, or rate-limit)`,
        );
      }
      const conv = convertGithubCompare({
        org, repo, spec: parsed.ref!,
        originUrl: url, compare: cmp,
      });
      const { images, failed } = downloadAll(conv.imagesToDownload, opts.slugDir);
      return {
        markdown: conv.markdown,
        images,
        title: `${org}/${repo}: compare ${parsed.ref}`,
        metadata: {
          source: "github-api-compare",
          org, repo,
          spec: parsed.ref,
          status: cmp.status,
          ahead_by: cmp.ahead_by,
          behind_by: cmp.behind_by,
          total_commits: cmp.total_commits,
        },
        flags: ["structured-summary", ...(failed > 0 ? ["github-image-download-partial"] : [])],
        notes: [
          `github: compare ${parsed.ref} via REST API ` +
          `(status=${cmp.status}, ${cmp.total_commits} commit(s), ${cmp.files?.length ?? 0} file(s))`,
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
function stubResult(url: string, reason: string, errorDetail?: string) {
  return makeStub({
    url, module: "github", kind: "fetch-failed",
    title: "GitHub (fetch failed)",
    summary: reason,
    advice:
      "Possible causes: rate limit (60/hr unauth, 5000/hr with GITHUB_TOKEN), " +
      "404 on a renamed/deleted repo, or a private repo your token can't see. " +
      "Set GITHUB_TOKEN if it isn't already and retry.",
    errorDetail,
  });
}
