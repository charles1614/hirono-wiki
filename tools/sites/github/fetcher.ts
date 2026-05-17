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
  kind: "pr" | "issue" | "discussion" | "release" | "blob" | "tree" | "repo" | "gist" | "commit" | "compare" | "unknown";
  /** Org or gist owner. Empty string for anonymous gists. */
  org: string;
  /** Repo name. For gists this is the gist id. */
  repo: string;
  /**
   * Issue/PR/discussion number, release tag, branch name, commit SHA,
   * or compare spec (`base...head`, including cross-fork forms like
   * `main...user:repo:branch`).
   */
  ref?: string;
  /** Branch (for blob/tree). */
  branch?: string;
  /** Path within the repo (for blob/tree). */
  path?: string;
}

export function parseGithubUrl(url: string): ParsedGithubUrl | null {
  // gist.github.com/<user>/<id>  or  gist.github.com/<id>  (anonymous)
  // The id is hex (≥20 chars). Owner is optional; if missing we treat as
  // anonymous and pass an empty string. The fetcher only needs the id.
  let m = url.match(/^https?:\/\/gist\.github\.com\/([^/]+)\/([0-9a-f]{20,})/i);
  if (m) return { kind: "gist", org: m[1], repo: m[2] };
  m = url.match(/^https?:\/\/gist\.github\.com\/([0-9a-f]{20,})/i);
  if (m) return { kind: "gist", org: "", repo: m[1] };
  // /pull/<n>
  m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
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
  // /commit/<sha>  (sha may be 7-40 hex chars; allow trailing # anchor)
  m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]{7,40})(?:[/?#]|$)/i);
  if (m) return { kind: "commit", org: m[1], repo: m[2], ref: m[3] };
  // /compare/<spec>  (spec is `<base>...<head>` with optional cross-fork
  //   prefix `<owner>:<repo>:<branch>` on either side)
  m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/compare\/([^/?#]+)/);
  if (m) return { kind: "compare", org: m[1], repo: m[2], ref: m[3] };
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
  /**
   * Set when the blob is a plain-text file that we wrap in a code fence
   * rather than treating as markdown. Drives a different rendering path
   * in the converter (no demote-H1, no frontmatter strip, render the
   * whole body as a single fenced block).
   */
  isPlainText?: boolean;
}

export function fetchRaw(
  org: string,
  repo: string,
  branch: string,
  path: string,
): RawFetchResult | null {
  // Markdown is the primary path. We also accept a few plain-text
  // shapes (`.txt`, `.csv`, `.tsv`, `.log`) that operators occasionally
  // bookmark for reference (dataset listings, scene-name files, etc.).
  // Other extensions still return null — we don't try to convert
  // arbitrary source files to markdown.
  const isMarkdown = /\.(?:md|markdown|mdx)$/i.test(path);
  const isPlainText = !isMarkdown && /\.(?:txt|csv|tsv|log)$/i.test(path);
  if (!isMarkdown && !isPlainText) return null;
  const rawUrl = `https://raw.githubusercontent.com/${org}/${repo}/${branch}/${path}`;
  const res = spawnSync("curl", ["-sfL", "-A", "Mozilla/5.0", rawUrl], {
    encoding: "utf8",
    timeout: 30_000,
  });
  if (res.status === 0 && res.stdout && res.stdout.length >= 200) {
    return { body: res.stdout, resolvedPath: path, branch, isPlainText };
  }
  // 404 or empty response — file may have been moved/renamed in the repo.
  // Try a fuzzy lookup against the tree API: find files whose basename
  // matches when normalized (lower-case, dashes/underscores collapsed,
  // leading-zero variations like `blog9_` vs `blog09_`). Fetch the
  // unique match if exactly one. See P-42 in
  // `00_Meta/site-handling-patterns.md`.
  const moved = findMovedFile(org, repo, branch, path);
  if (moved) {
    const movedRes = spawnSync(
      "curl", ["-sfL", "-A", "Mozilla/5.0",
        `https://raw.githubusercontent.com/${org}/${repo}/${branch}/${moved}`,
      ],
      { encoding: "utf8", timeout: 30_000 },
    );
    if (movedRes.status === 0 && movedRes.stdout && movedRes.stdout.length >= 200) {
      return { body: movedRes.stdout, resolvedPath: moved, branch, isPlainText };
    }
  }
  return null;
}

interface TreeEntry { path: string; type: string; }
interface TreeResponse { tree: TreeEntry[]; truncated: boolean; }

/**
 * Normalize a basename for fuzzy-match: lower-case, drop leading zeros
 * within numeric prefixes (blog09 ≡ blog9), collapse dashes/underscores
 * to a single character, drop the extension. The point is to recognize
 * the SAME file under common rename patterns:
 *
 *   - `blog9_X.md`  →  `blog09_X.md`        (zero-pad for sortability)
 *   - `Foo-Bar.md`  →  `foo_bar.md`         (case + separator change)
 *   - `Some File.md` → `some_file.md`       (whitespace → underscore)
 */
function normalizeBasename(name: string): string {
  let n = name.toLowerCase()
    .replace(/\.(?:md|markdown|mdx)$/i, "")
    .replace(/[-_\s]+/g, "_");
  // Strip leading zeros from numeric runs preceded by a non-digit:
  // `blog09_x` → `blog9_x`. (Both forms normalize to the same string.)
  n = n.replace(/(^|[^0-9])0+(\d)/g, "$1$2");
  return n;
}

/**
 * Search the repo's tree for a file whose normalized basename matches
 * the target's normalized basename. Returns the new path if exactly
 * one match exists, otherwise null. Best-effort: caps tree fetch at
 * 30s and silently fails on errors so the caller falls back to the
 * 404 stub.
 */
function findMovedFile(org: string, repo: string, branch: string, path: string): string | null {
  const targetBase = path.split("/").pop() || path;
  const targetNorm = normalizeBasename(targetBase);
  if (!targetNorm) return null;
  // Constrain the candidate set to files with the same extension family
  // as the target. Markdown targets only fuzzy-match other markdown
  // files; plain-text targets only fuzzy-match other plain-text files.
  // Otherwise a `Foo.md` rename to `Foo.txt` would cross-match and
  // change the rendering path silently.
  const targetIsMarkdown = /\.(?:md|markdown|mdx)$/i.test(path);
  const acceptExt = targetIsMarkdown
    ? /\.(?:md|markdown|mdx)$/i
    : /\.(?:txt|csv|tsv|log)$/i;
  const tree = curlJson<TreeResponse>(
    `https://api.github.com/repos/${org}/${repo}/git/trees/${branch}?recursive=1`,
  );
  if (!tree || !Array.isArray(tree.tree)) return null;
  const matches: string[] = [];
  for (const t of tree.tree) {
    if (t.type !== "blob") continue;
    if (!acceptExt.test(t.path)) continue;
    const base = t.path.split("/").pop() || t.path;
    if (normalizeBasename(base) === targetNorm) matches.push(t.path);
  }
  // Only auto-resolve when there's exactly one strong match. Multiple
  // matches indicates ambiguity (the file was renamed AND duplicated
  // somewhere) — surface a stub instead of guessing.
  return matches.length === 1 ? matches[0] : null;
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

// ──────────────────────────── commit ────────────────────────────────

export interface GithubCommitFile {
  filename: string;
  status: string;          // "added" | "modified" | "removed" | "renamed" | …
  additions: number;
  deletions: number;
  changes: number;
  /** Diff hunks as a string (may be absent for binary files). */
  patch?: string;
  previous_filename?: string;
}

export interface GithubCommitResult {
  sha: string;
  html_url: string;
  commit: {
    author?:    { name?: string; email?: string; date?: string };
    committer?: { name?: string; email?: string; date?: string };
    message: string;
  };
  author?:    { login?: string; html_url?: string };
  committer?: { login?: string; html_url?: string };
  parents: { sha: string; html_url: string }[];
  stats?:  { additions: number; deletions: number; total: number };
  files?:  GithubCommitFile[];
}

export function fetchCommit(org: string, repo: string, sha: string): GithubCommitResult | null {
  return curlJson<GithubCommitResult>(
    `https://api.github.com/repos/${org}/${repo}/commits/${sha}`,
  );
}

// ──────────────────────────── compare ───────────────────────────────

export interface GithubCompareResult {
  url: string;
  html_url: string;
  permalink_url: string;
  status: string;          // "ahead" | "behind" | "diverged" | "identical"
  ahead_by: number;
  behind_by: number;
  total_commits: number;
  base_commit?: { sha: string; html_url: string; commit?: { message?: string } };
  merge_base_commit?: { sha: string; html_url: string };
  commits?: {
    sha: string;
    html_url: string;
    commit: { author?: { name?: string; date?: string }; message: string };
    author?: { login?: string };
  }[];
  files?: GithubCommitFile[];
}

export function fetchCompare(org: string, repo: string, spec: string): GithubCompareResult | null {
  // spec is `<base>...<head>` (or `<base>..<head>`); GitHub's API takes
  // it verbatim in the path. URL-encode each side independently so a
  // cross-fork spec like `main...user:repo:branch` survives.
  const parts = spec.split(/(\.\.\.|\.\.)/);
  if (parts.length === 3) {
    const [base, sep, head] = parts;
    const encoded = `${encodeURIComponent(base)}${sep}${encodeURIComponent(head)}`;
    return curlJson<GithubCompareResult>(
      `https://api.github.com/repos/${org}/${repo}/compare/${encoded}`,
    );
  }
  return null;
}

// ───────────────────────── Gists ─────────────────────────

export interface GistFile {
  filename: string;
  language: string | null;
  /** GitHub guesses a Linguist type; "Markdown" | "Python" | "JSON" | … */
  type?: string;
  size?: number;
  truncated?: boolean;
  content: string;
}

export interface GistFetchResult {
  id: string;
  description: string;
  owner: string;
  /** ISO timestamps from the API. */
  created_at?: string;
  updated_at?: string;
  /** Public/secret. Secret gists are still readable by id without auth. */
  public?: boolean;
  files: GistFile[];
  htmlUrl: string;
}

export function fetchGist(id: string): GistFetchResult | null {
  const apiUrl = `https://api.github.com/gists/${id}`;
  const data = curlJson<{
    id: string;
    description: string | null;
    owner?: { login?: string } | null;
    created_at?: string;
    updated_at?: string;
    public?: boolean;
    html_url?: string;
    files: Record<string, { filename: string; language: string | null; type?: string; size?: number; truncated?: boolean; content?: string }>;
  }>(apiUrl);
  if (!data || !data.files) return null;
  const files: GistFile[] = Object.values(data.files).map((f) => ({
    filename: f.filename,
    language: f.language,
    type: f.type,
    size: f.size,
    truncated: f.truncated,
    content: f.content || "",
  }));
  return {
    id: data.id,
    description: (data.description || "").trim(),
    owner: data.owner?.login || "",
    created_at: data.created_at,
    updated_at: data.updated_at,
    public: data.public,
    files,
    htmlUrl: data.html_url || `https://gist.github.com/${data.owner?.login || ""}/${data.id}`.replace(/\/\//g, "/").replace(":/", "://"),
  };
}
