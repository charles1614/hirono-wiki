/**
 * GitHub site converters — pure functions that turn structured data
 * (REST API JSON, raw markdown) into §2-contract markdown.
 *
 * Per the universal pattern (CLAUDE.md §5a): we never go through
 * opencli's web-read for github content. PR/issue/discussion bodies +
 * comments come from the REST API; release notes from the release API;
 * blob/tree/repo-root content from raw.githubusercontent.com. Each
 * source returns clean structured data, so the conversion is purely
 * formatting.
 *
 * All three converters are pure: no I/O, no network. They take
 * already-fetched data and return `{markdown, imagesToDownload}`. The
 * markdown has remote `![](http...)` refs rewritten to deterministic
 * local filenames; the `imagesToDownload` list pairs each remote URL
 * with its allocated local filename so the runtime caller can fetch
 * them. Same convention as the other site-module converters (weixin,
 * xhs, substack, etc.) — no per-converter image-rewriting code path
 * outside the converter.
 */

import { applyCommonMarkdownCleanups } from "../_shared/markdown-cleanups.ts";

// ───────────────────────────── shared types + helper ────────────────

export interface GithubImageDownload {
  remoteUrl: string;
  localFilename: string;
}

export interface GithubConvertResult {
  markdown: string;
  imagesToDownload: GithubImageDownload[];
}

/**
 * Walk markdown for `![alt](http(s)://...)` image refs. For each:
 *   - allocate a deterministic local filename `<prefix>-img-NNN.<ext>`
 *   - rewrite the ref in the markdown to use the local filename
 *   - emit a (remoteUrl, localFilename) pair into `imagesToDownload`
 *
 * Title attributes (`(url "title")`) are preserved. Skips inline-code
 * spans and fenced code blocks (markdown examples there shouldn't be
 * confused for real refs). Idempotent on already-localized refs (those
 * starting with relative paths or `<prefix>-img-`).
 */
export function localizeMarkdownImages(
  md: string,
  prefix: string,
): { markdown: string; imagesToDownload: GithubImageDownload[] } {
  const imagesToDownload: GithubImageDownload[] = [];
  let imgCounter = 0;
  const seen = new Map<string, string>();  // remoteUrl → localFilename (de-dup)

  const lines = md.split("\n");
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^```/.test(lines[i].trim())) { inFence = !inFence; continue; }
    if (inFence) continue;
    // Replace `![alt](url[ "title"])` where url is http(s)://...
    lines[i] = lines[i].replace(
      /(!\[[^\]]*\]\()(https?:\/\/[^)\s]+)((?:\s+"[^"]*")?\))/g,
      (_full, pre: string, url: string, post: string) => {
        let local = seen.get(url);
        if (!local) {
          imgCounter++;
          const ext = guessImageExt(url);
          local = `${prefix}-img-${String(imgCounter).padStart(3, "0")}${ext}`;
          seen.set(url, local);
          imagesToDownload.push({ remoteUrl: url, localFilename: local });
        }
        return `${pre}${local}${post}`;
      },
    );
  }
  return { markdown: applyCommonMarkdownCleanups(lines.join("\n")), imagesToDownload };
}

function guessImageExt(url: string): string {
  try {
    const p = new URL(url).pathname.toLowerCase();
    const m = p.match(/\.(png|jpe?g|gif|webp|svg)(?:$|[?#])/);
    if (m) return "." + (m[1] === "jpeg" ? "jpg" : m[1]);
  } catch { /* fall through */ }
  // GitHub user-attachments serve images without an extension in the URL —
  // they're typically PNG. Default to `.png` and let the downloader honor
  // whatever the server's Content-Type says (the file extension is just
  // a hint anyway).
  return ".png";
}

// ───────────────────────────── PR / issue / discussion ──────────────

export interface GithubUser {
  login: string;
}

export interface GithubLabel {
  name: string;
}

export interface GithubBranchRef {
  ref?: string;
}

export interface GithubPrIssueDiscussion {
  user?: GithubUser;
  body?: string;
  created_at?: string;
  author_association?: string;
  title?: string;
  number?: number;
  html_url?: string;
  /** open | closed */
  state?: string;
  /** issue-only: completed | not_planned | reopened */
  state_reason?: string;
  /** Always emitted as ISO; null while open. */
  closed_at?: string | null;
  /** PR-only. */
  draft?: boolean;
  merged?: boolean;
  merged_at?: string | null;
  merged_by?: GithubUser | null;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  head?: GithubBranchRef;
  base?: GithubBranchRef;
  /** Both issue + PR have these. */
  labels?: GithubLabel[];
  assignees?: GithubUser[];
}

export interface GithubComment {
  user?: GithubUser;
  body?: string;
  created_at?: string;
  author_association?: string;
  /** Only set on discussion replies; pointer to the parent comment id. */
  parent_id?: number;
}

/** PR review summary (state + optional body) — from `/pulls/<n>/reviews`. */
export interface PrReview {
  user?: GithubUser;
  body?: string;
  state?: string;            // APPROVED | CHANGES_REQUESTED | COMMENTED | DISMISSED
  submitted_at?: string;
  author_association?: string;
}

/** PR inline review comment (tied to a file/line) — from `/pulls/<n>/comments`. */
export interface PrReviewComment {
  user?: GithubUser;
  body?: string;
  path?: string;
  created_at?: string;
  author_association?: string;
}

export interface PrIssueConvertInput {
  /** "pull" | "issues" | "discussions" */
  kind: "pull" | "issues" | "discussions";
  org: string;
  repo: string;
  /** The issue / PR / discussion number. */
  number: number;
  /** Original github.com URL (used in §2 frontmatter). */
  originUrl: string;
  /** REST-API issue/PR/discussion object. */
  main: GithubPrIssueDiscussion;
  /** Comments thread (issues + PR share `/issues/<n>/comments`; discussions use their own). */
  comments: GithubComment[];
  /** PR-only: review summaries from `/pulls/<n>/reviews`. */
  reviews?: PrReview[];
  /** PR-only: inline review comments from `/pulls/<n>/comments`. */
  reviewComments?: PrReviewComment[];
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function formatRole(role?: string): string {
  if (!role || role === "NONE") return "";
  return ` · ${role.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`;
}

/** Title shape: `<TitleField> · <kind>#NNN · org/repo` */
function buildTitle(input: PrIssueConvertInput): string {
  const t = (input.main.title || "").trim();
  const kindLabel = input.kind === "pull" ? "Pull Request" : input.kind === "issues" ? "Issue" : "Discussion";
  return `${t} · ${kindLabel} #${input.number} · ${input.org}/${input.repo}`;
}

/**
 * Build the `> Metadata: …` blockquote lines that go under `> 原文链接:`.
 * Captures status (open/closed/merged), labels, assignees, branches, and
 * diff stats — context that's prominent on the GitHub page itself but
 * absent from the body. Each line is one independent fact so a reader
 * can scan them.
 */
function buildMetadataLines(input: PrIssueConvertInput): string[] {
  const m = input.main;
  const lines: string[] = [];

  // Status line — most important fact. PRs distinguish merged vs just-closed.
  if (input.kind === "pull") {
    if (m.merged) {
      const by = m.merged_by?.login ? ` by ${m.merged_by.login}` : "";
      const when = m.merged_at ? ` on ${formatDate(m.merged_at)}` : "";
      lines.push(`> Status: **merged**${by}${when}`);
    } else if (m.draft) {
      lines.push(`> Status: **draft**`);
    } else if (m.state === "closed") {
      const when = m.closed_at ? ` on ${formatDate(m.closed_at)}` : "";
      lines.push(`> Status: **closed** (not merged)${when}`);
    } else if (m.state === "open") {
      lines.push(`> Status: **open**`);
    }
  } else if (input.kind === "issues") {
    if (m.state === "closed") {
      const reason = m.state_reason ? ` (${m.state_reason.replace(/_/g, " ")})` : "";
      const when = m.closed_at ? ` on ${formatDate(m.closed_at)}` : "";
      lines.push(`> Status: **closed**${reason}${when}`);
    } else if (m.state === "open") {
      lines.push(`> Status: **open**`);
    }
  }

  // Labels — categorical context.
  const labels = (m.labels || []).map((l) => l.name).filter(Boolean);
  if (labels.length > 0) {
    lines.push(`> Labels: ${labels.map((n) => `\`${n}\``).join(", ")}`);
  }

  // Assignees / merged_by ownership.
  const assignees = (m.assignees || []).map((u) => u.login).filter(Boolean);
  if (assignees.length > 0) {
    lines.push(`> Assignees: ${assignees.map((n) => `[${n}](https://github.com/${n})`).join(", ")}`);
  }

  // PR-only: branches and diff stats.
  if (input.kind === "pull") {
    const head = m.head?.ref;
    const base = m.base?.ref;
    if (head && base) lines.push(`> Branches: \`${head}\` → \`${base}\``);
    if (typeof m.additions === "number" && typeof m.deletions === "number" && typeof m.changed_files === "number") {
      lines.push(`> Diff: +${m.additions} / -${m.deletions} across ${m.changed_files} file${m.changed_files === 1 ? "" : "s"}`);
    }
  }

  return lines;
}

/**
 * Demote markdown headings by `levels`, fence-aware.
 *
 * GitHub PR/issue/discussion bodies often use `## Summary / ## Motivation`
 * etc. as top-level outline. When we inject a `## <speaker>` heading
 * above the body, those body H2s outrank the speaker — outline is broken.
 * Demote body headings one level deeper so speakers stay the top of
 * each comment block. Caps at H6 to avoid invalid `#######`.
 */
function demoteHeadings(md: string, levels: number): string {
  if (levels <= 0) return md;
  const out: string[] = [];
  let inFence = false;
  for (const line of md.split("\n")) {
    if (/^```/.test(line.trim())) { inFence = !inFence; out.push(line); continue; }
    if (inFence) { out.push(line); continue; }
    const m = line.match(/^(#{1,6})(\s+.+)$/);
    if (m) {
      const newLevel = Math.min(6, m[1].length + levels);
      out.push("#".repeat(newLevel) + m[2]);
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

/**
 * Convert HTML `<img ... src="X" ... alt="Y" .../>` tags to markdown
 * `![alt](src)`. GitHub PR/issue bodies frequently include HTML img tags
 * for size attributes. We normalize to markdown form so the converter's
 * downstream `localizeMarkdownImages` pass sees a uniform `![](url)` shape;
 * width/height attrs don't render in plain markdown viewers anyway.
 */
function normalizeHtmlImages(md: string): string {
  return md.replace(
    /<img\s+([^>]*?)\s*\/?>/gi,
    (_full, attrs: string) => {
      const srcM = attrs.match(/\bsrc\s*=\s*"([^"]*)"/i);
      const altM = attrs.match(/\balt\s*=\s*"([^"]*)"/i);
      const src = srcM ? srcM[1] : "";
      const alt = altM ? altM[1] : "";
      if (!src) return _full; // nothing to do
      return `![${alt}](${src})`;
    },
  );
}

export function convertGithubPrIssue(input: PrIssueConvertInput): GithubConvertResult {
  const metaLines = buildMetadataLines(input);
  const fm: string[] = [
    `# ${buildTitle(input)}`,
    "",
    `> 原文链接: ${input.originUrl}`,
    ...metaLines,
    "",
    "---",
    "",
  ];

  const blocks: string[] = [];

  const renderBody = (body: string): string => {
    let b = body.trim();
    b = normalizeHtmlImages(b);
    // Demote body's top-level headings one level so they don't outrank
    // the speaker `##` heading we just emitted above.
    b = demoteHeadings(b, 1);
    return b;
  };

  /**
   * Push a speaker block. After the first speaker, prepend `---` so the
   * boundary between speakers is visually obvious — without an HR, runs
   * of consecutive same-author blocks (e.g. multiple inline review
   * comments by the same reviewer) blur together.
   */
  const pushSpeaker = (header: string, meta: string, body: string) => {
    if (blocks.length > 0) {
      blocks.push("---");
      blocks.push("");
    }
    blocks.push(`## ${header}`);
    blocks.push("");
    blocks.push(`> ${meta}`);
    blocks.push("");
    blocks.push(body.trim());
    blocks.push("");
  };

  // OP body — verb depends on kind.
  const opVerb = input.kind === "discussions" ? "opened this discussion" : "opened this";
  if (input.main.body && input.main.body.trim().length > 0) {
    pushSpeaker(
      input.main.user?.login || "OP",
      `${opVerb} on ${formatDate(input.main.created_at)}${formatRole(input.main.author_association)}`,
      renderBody(input.main.body),
    );
  }

  // PR review summaries (state + optional body) — distinct from inline review comments.
  // SKIP reviews with empty body entirely; an "(no review summary text)" placeholder
  // is just noise. Empty APPROVED reviews are common and uninformative.
  for (const r of input.reviews || []) {
    if (!r.body || r.body.trim().length === 0) continue;
    const stateLabel = (r.state || "REVIEWED").toLowerCase().replace(/_/g, " ");
    pushSpeaker(
      r.user?.login || "reviewer",
      `reviewed (${stateLabel}) on ${formatDate(r.submitted_at)}${formatRole(r.author_association)}`,
      renderBody(r.body),
    );
  }

  // PR inline review comments (file:line). Each becomes its own speaker block
  // with the file path in the metadata line.
  for (const ic of input.reviewComments || []) {
    if (!ic.body || ic.body.trim().length === 0) continue;
    const path = ic.path ? ` · file \`${ic.path}\`` : "";
    pushSpeaker(
      ic.user?.login || "unknown",
      `review-commented on ${formatDate(ic.created_at)}${formatRole(ic.author_association)}${path}`,
      renderBody(ic.body),
    );
  }

  // Each conversation comment. Discussion replies get a distinct verb so threading is visible.
  for (const c of input.comments) {
    if (!c.body || c.body.trim().length === 0) continue;
    const verb = (input.kind === "discussions" && c.parent_id) ? "replied" : "commented";
    pushSpeaker(
      c.user?.login || "unknown",
      `${verb} on ${formatDate(c.created_at)}${formatRole(c.author_association)}`,
      renderBody(c.body),
    );
  }

  const markdown = [...fm, ...blocks].join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  return localizeMarkdownImages(markdown, "github");
}

// ──────────────────────────────── release ───────────────────────────

export interface GithubRelease {
  name?: string;
  body?: string;
  tag_name?: string;
  published_at?: string;
  author?: GithubUser;
  html_url?: string;
}

export interface ReleaseConvertInput {
  org: string;
  repo: string;
  tag: string;
  originUrl: string;
  release: GithubRelease;
}

export function convertGithubRelease(input: ReleaseConvertInput): GithubConvertResult {
  const r = input.release;
  const title = r.name || r.tag_name || input.tag;
  const author = r.author?.login;
  const published = r.published_at ? formatDate(r.published_at) : null;

  const metaBits: string[] = [];
  if (author) metaBits.push(`Released by [${author}](https://github.com/${author})`);
  if (published) metaBits.push(published);
  if (r.tag_name) metaBits.push(`tag \`${r.tag_name}\``);

  const fm: string[] = [
    `# ${input.org}/${input.repo}: ${title}`,
    "",
    `> 原文链接: ${input.originUrl}`,
    ...(metaBits.length > 0 ? [`> ${metaBits.join(" · ")}`] : []),
    "",
    "---",
    "",
    "",
  ];

  let body = (r.body || "").trim() + "\n";
  // Resolve relative image paths against the repo's raw-content base for the released tag.
  const tagRef = r.tag_name || input.tag;
  body = body.replace(
    /(!\[[^\]]*\]\()([^)\s][^)\s]*)(\))/g,
    (_m, pre, imgPath, post) => {
      if (/^https?:\/\//i.test(imgPath)) return _m;
      const path = imgPath.startsWith("/") ? imgPath.slice(1) : imgPath;
      return `${pre}https://raw.githubusercontent.com/${input.org}/${input.repo}/${tagRef}/${path}${post}`;
    },
  );

  const markdown = fm.join("\n") + body;
  return localizeMarkdownImages(markdown, "github");
}

// ───────────────────────────── raw markdown blob ────────────────────

export interface RawConvertInput {
  org: string;
  repo: string;
  branch: string;
  /** File path within the repo (e.g. "README.md", "docs/foo.md"). */
  path: string;
  originUrl: string;
  /** Raw markdown body fetched from raw.githubusercontent.com. */
  body: string;
}

export function convertGithubRaw(input: RawConvertInput): GithubConvertResult {
  let body = input.body;

  // Strip a leading YAML frontmatter block (`---\n...\n---\n`) from the
  // file. Many .md files (skill docs, jekyll posts, MDX) start with a YAML
  // header carrying name/description/tags. Leaving it under our own §2
  // separator confuses readers — it looks like two `---` blocks. We promote
  // the YAML's `name`/`title` field to the title (if no body H1 exists)
  // and otherwise just drop the block.
  const yamlMatch = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  let yamlPromotedTitle: string | null = null;
  if (yamlMatch) {
    const fmBody = yamlMatch[1];
    const titleM = fmBody.match(/^(?:title|name)\s*:\s*["']?(.+?)["']?\s*$/m);
    if (titleM) yamlPromotedTitle = titleM[1].trim();
    body = body.slice(yamlMatch[0].length);
  }

  // Strip GitHub-flavored `<div align="...">` wrappers — valid HTML inside
  // markdown but render as raw tags in plain readers. Keep inner content.
  body = body.replace(/^<div\s+[^>]*>\s*\n?/gim, "");
  body = body.replace(/^<\/div>\s*\n?/gim, "");

  // Resolve relative image paths to GitHub's raw-content host so the
  // downstream `localizeMarkdownImages` pass can allocate local
  // filenames + queue the fetch.
  const pathDir = input.path.includes("/") ? input.path.slice(0, input.path.lastIndexOf("/")) : "";
  const resolveBase = `https://raw.githubusercontent.com/${input.org}/${input.repo}/${input.branch}/${pathDir ? pathDir + "/" : ""}`;
  const repoBase = `https://raw.githubusercontent.com/${input.org}/${input.repo}/${input.branch}/`;
  body = body.replace(
    /(!\[[^\]]*\]\()([^)\s][^)\s]*)(\))/g,
    (m, pre, imgPath, post) => {
      if (/^https?:\/\//i.test(imgPath)) return m;
      if (imgPath.startsWith("/")) return `${pre}${repoBase.replace(/\/$/, "")}${imgPath}${post}`;
      return `${pre}${resolveBase}${imgPath}${post}`;
    },
  );

  // Trim any leading whitespace/blank lines (the YAML strip can leave a
  // leading "\n" before the body's H1).
  body = body.replace(/^\s+/, "");

  // Extract title — prefer body H1, then YAML-promoted name/title, then path.
  const h1Match = body.match(/^#\s+(.+?)\s*$/m);
  const titleFromH1 = h1Match ? h1Match[1].trim() : null;
  const titlePart = titleFromH1 || yamlPromotedTitle || input.path;
  const title = `${input.org}/${input.repo}: ${titlePart}`;

  // Strip the body's leading H1 if present — we emit our own.
  if (titleFromH1 && h1Match) {
    body = body.replace(/^#\s+.+?\s*\n+/, "");
  }

  const fm: string[] = [
    `# ${title}`,
    "",
    `> 原文链接: ${input.originUrl}`,
    "",
    "---",
    "",
    "",
  ];

  const markdown = (fm.join("\n") + body.trim() + "\n").replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "\n");
  return localizeMarkdownImages(markdown, "github");
}

// ───────────────────────── Gist ─────────────────────────

export interface GistFileInput {
  filename: string;
  language: string | null;
  type?: string;
  content: string;
}

export interface GistConvertInput {
  id: string;
  description: string;
  owner: string;
  created_at?: string;
  updated_at?: string;
  files: GistFileInput[];
  originUrl: string;
}

/**
 * Markdown extension list — files with one of these extensions are
 * embedded as-is (post-image-resolution) rather than wrapped in a code
 * fence.
 */
const MD_EXTS = new Set(["md", "markdown", "mdown", "mkd", "mdx"]);

/** Map a `<code class="language-X">` style hint into a fence info-string. */
function fenceLangFor(file: GistFileInput): string {
  // GitHub's `language` is human-friendly ("Python", "JavaScript", "Go");
  // markdown fences expect lowercase short names (`python`, `javascript`,
  // `go`). Lower-case + strip the obvious " (long form)" suffix.
  if (file.language) return file.language.toLowerCase().replace(/\s.*$/, "").replace(/[^a-z0-9+-]/g, "");
  // Fall back to the filename extension.
  const ext = file.filename.includes(".") ? file.filename.split(".").pop()!.toLowerCase() : "";
  return ext;
}

export function convertGithubGist(input: GistConvertInput): GithubConvertResult {
  // Title: gist description, else first filename, else "Gist <short-id>".
  const titlePart = input.description
    || input.files[0]?.filename
    || `Gist ${input.id.slice(0, 8)}`;
  const title = input.owner
    ? `${input.owner}/gist: ${titlePart}`
    : `gist: ${titlePart}`;

  const fm: string[] = [
    `# ${title}`,
    "",
    `> 原文链接: ${input.originUrl}`,
  ];
  if (input.owner) fm.push(`> 作者: [@${input.owner}](https://github.com/${input.owner})`);
  if (input.updated_at) fm.push(`> 更新于: ${input.updated_at.slice(0, 10)}`);
  if (input.description && titlePart !== input.description) {
    // Title fell back to a filename — surface description as a callout.
    fm.push(`> ${input.description}`);
  }
  fm.push("", "---", "", "");

  const sections: string[] = [];
  for (const file of input.files) {
    const ext = file.filename.includes(".") ? file.filename.split(".").pop()!.toLowerCase() : "";
    const isMarkdown = MD_EXTS.has(ext) || file.type === "text/markdown" || (file.language || "").toLowerCase() === "markdown";

    sections.push(`## \`${file.filename}\``);
    sections.push("");
    if (isMarkdown) {
      // Demote any in-file H1 by one level so the §2 frontmatter H1 stays
      // unique. Strip a leading H1 entirely if it duplicates the filename.
      let content = file.content;
      // Demote h1..h5 by one level.
      content = content.replace(/^(#{1,5})\s+/gm, "#$1 ");
      sections.push(content.trimEnd());
    } else {
      const lang = fenceLangFor(file);
      // Use a 4-backtick fence in case the file content contains 3-backticks.
      sections.push("````" + lang);
      sections.push(file.content.trimEnd());
      sections.push("````");
    }
    sections.push("");
  }

  let markdown = fm.join("\n") + sections.join("\n");
  markdown = markdown.replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "\n");
  return localizeMarkdownImages(markdown, "github");
}
