/**
 * GitHub site fetchers — curl-based REST API + raw.githubusercontent.com.
 *
 * Per the universal pattern (CLAUDE.md §5a): no opencli, no web-read.
 * We go directly to the cleanest available source per URL shape:
 *   - PR / issue / discussion → REST API (issue or PR object + comments)
 *   - release tag → release API
 *   - blob / tree / repo-root → raw.githubusercontent.com
 *
 * Rate limits: 60/hour anonymous; 5000/hour with `GITHUB_TOKEN` env var
 * (highly recommended for bulk runs).
 */

import { spawnSync } from "node:child_process";
import type { GithubPrIssueDiscussion, GithubComment, GithubRelease, PrReview, PrReviewComment } from "./converter.ts";

function curlHeaders(): string[] {
  const h = [
    "-H", "Accept: application/vnd.github+json",
    "-H", "User-Agent: hirono-wiki",
    "-H", "X-GitHub-Api-Version: 2022-11-28",
  ];
  if (process.env.GITHUB_TOKEN) {
    h.push("-H", `Authorization: Bearer ${process.env.GITHUB_TOKEN}`);
  }
  return h;
}

function curlJson<T>(apiUrl: string): T | null {
  const res = spawnSync("curl", ["-sfL", ...curlHeaders(), apiUrl], {
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 50_000_000,
  });
  if (res.status !== 0 || !res.stdout) return null;
  try { return JSON.parse(res.stdout) as T; } catch { return null; }
}

export interface ParsedGithubUrl {
  kind: "pr" | "issue" | "discussion" | "release" | "blob" | "tree" | "repo" | "unknown";
  org: string;
  repo: string;
  /** Issue/PR/discussion number, or release tag, or branch name. */
  ref?: string;
  /** Branch (for blob/tree). */
  branch?: string;
  /** Path within the repo (for blob/tree). */
  path?: string;
}

export function parseGithubUrl(url: string): ParsedGithubUrl | null {
  // /pull/<n>
  let m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (m) return { kind: "pr", org: m[1], repo: m[2], ref: m[3] };
  // /issues/<n>
  m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  if (m) return { kind: "issue", org: m[1], repo: m[2], ref: m[3] };
  // /discussions/<n>
  m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/discussions\/(\d+)/);
  if (m) return { kind: "discussion", org: m[1], repo: m[2], ref: m[3] };
  // /releases/tag/<v>
  m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/tag\/([^/?#]+)/);
  if (m) return { kind: "release", org: m[1], repo: m[2], ref: m[3] };
  // /blob/<branch>/<path>
  m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+?)(?:[?#]|$)/);
  if (m) return { kind: "blob", org: m[1], repo: m[2], branch: m[3], path: m[4] };
  // /tree/<branch>[/<path>]
  m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)(?:\/(.+?))?(?:[?#]|$)/);
  if (m) return { kind: "tree", org: m[1], repo: m[2], branch: m[3], path: m[4] || "" };
  // Repo root
  m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)\/?(?:[?#]|$)/);
  if (m) {
    // Exclude paths we already handled (defensive — shouldn't reach here for those).
    if (/\/(?:pull|issues|discussions|releases|blob|tree|actions|wiki|commits?|blame|graphs|pulse|compare|network)\//.test(url) ||
        /\/(?:pull|issues|discussions|releases|actions|wiki|pulse)\/?$/.test(url)) {
      return { kind: "unknown", org: m[1], repo: m[2] };
    }
    return { kind: "repo", org: m[1], repo: m[2] };
  }
  return null;
}

// ───────────────────────── PR / issue / discussion ──────────────────

export interface PrIssueFetchResult {
  main: GithubPrIssueDiscussion;
  comments: GithubComment[];
  /** PR-only: review summaries from `/pulls/<n>/reviews`. */
  reviews?: PrReview[];
  /** PR-only: inline review comments from `/pulls/<n>/comments`. */
  reviewComments?: PrReviewComment[];
}

export function fetchPrIssue(
  org: string,
  repo: string,
  num: string,
  kind: "pr" | "issue" | "discussion",
): PrIssueFetchResult | null {
  const apiKind = kind === "pr" ? "pulls" : kind === "issue" ? "issues" : "discussions";
  const main = curlJson<GithubPrIssueDiscussion>(
    `https://api.github.com/repos/${org}/${repo}/${apiKind}/${num}`,
  );
  if (!main) return null;
  const commentsPath = kind === "discussion"
    ? `discussions/${num}/comments`
    : `issues/${num}/comments`;
  const comments = curlJson<GithubComment[]>(
    `https://api.github.com/repos/${org}/${repo}/${commentsPath}`,
  ) || [];
  // For PRs only: also fetch the review summaries + inline review comments.
  // These endpoints don't exist for issues / discussions.
  let reviews: PrReview[] | undefined;
  let reviewComments: PrReviewComment[] | undefined;
  if (kind === "pr") {
    reviews = curlJson<PrReview[]>(
      `https://api.github.com/repos/${org}/${repo}/pulls/${num}/reviews`,
    ) || [];
    reviewComments = curlJson<PrReviewComment[]>(
      `https://api.github.com/repos/${org}/${repo}/pulls/${num}/comments`,
    ) || [];
  }
  return { main, comments, reviews, reviewComments };
}

// ──────────────────────────────── release ───────────────────────────

export function fetchRelease(org: string, repo: string, tag: string): GithubRelease | null {
  return curlJson<GithubRelease>(
    `https://api.github.com/repos/${org}/${repo}/releases/tags/${encodeURIComponent(tag)}`,
  );
}

// ───────────────────────────── raw markdown blob ────────────────────

export interface RawFetchResult {
  body: string;
  resolvedPath: string;
  branch: string;
}

export function fetchRaw(
  org: string,
  repo: string,
  branch: string,
  path: string,
): RawFetchResult | null {
  // Only meaningful for markdown-ish files.
  if (!/\.(?:md|markdown|mdx)$/i.test(path)) return null;
  const rawUrl = `https://raw.githubusercontent.com/${org}/${repo}/${branch}/${path}`;
  const res = spawnSync("curl", ["-sfL", "-A", "Mozilla/5.0", rawUrl], {
    encoding: "utf8",
    timeout: 30_000,
  });
  if (res.status !== 0 || !res.stdout || res.stdout.length < 200) return null;
  return { body: res.stdout, resolvedPath: path, branch };
}

/** For /tree/<branch>[/<path>] URLs: fetch README at that path. */
export function fetchTreeReadme(org: string, repo: string, branch: string, subpath: string): RawFetchResult | null {
  const path = (subpath ? `${subpath}/` : "") + "README.md";
  return fetchRaw(org, repo, branch, path);
}

/** For repo-root URLs: fetch README from the default branch (HEAD). */
export function fetchRepoReadme(org: string, repo: string): RawFetchResult | null {
  return fetchRaw(org, repo, "HEAD", "README.md");
}
