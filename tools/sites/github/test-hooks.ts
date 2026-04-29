/**
 * Test hooks for the github site module.
 *
 * github routes one URL prefix to one of three converters depending on
 * URL kind: `/pull|issues|discussions/N` → `convertGithubPrIssue`,
 * `/releases/tag/V` → `convertGithubRelease`, repo / `/blob/` /
 * `/tree/` → `convertGithubRaw`. Each shape has its own input.json
 * format. The `runFromFixture` dispatcher branches on `input.fn`;
 * `capture` branches on URL kind.
 *
 * See `tools/sites/_shared/test-hooks-types.ts`.
 */

import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";
import {
  convertGithubPrIssue,
  convertGithubRelease,
  convertGithubRaw,
} from "./converter.ts";
import {
  parseGithubUrl,
  fetchPrIssue,
  fetchRelease,
  fetchRaw,
  fetchTreeReadme,
  fetchRepoReadme,
} from "./fetcher.ts";

function runFromFixture(input: InputDoc): { markdown: string; rest: Record<string, unknown> } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arg0 = input.args[0] as any;
  if (input.fn === "convertGithubPrIssue") {
    const r = convertGithubPrIssue(arg0);
    return { markdown: r.markdown, rest: { imagesToDownload: r.imagesToDownload } };
  }
  if (input.fn === "convertGithubRelease") {
    const r = convertGithubRelease(arg0);
    return { markdown: r.markdown, rest: { imagesToDownload: r.imagesToDownload } };
  }
  if (input.fn === "convertGithubRaw") {
    const r = convertGithubRaw(arg0);
    return { markdown: r.markdown, rest: { imagesToDownload: r.imagesToDownload } };
  }
  throw new Error(`github test-hooks: unexpected fn ${input.fn}`);
}

function capture(url: string): CaptureResult {
  const parsed = parseGithubUrl(url);
  if (!parsed) throw new Error(`could not parse github URL: ${url}`);

  if (parsed.kind === "pr" || parsed.kind === "issue" || parsed.kind === "discussion") {
    const result = fetchPrIssue(parsed.org, parsed.repo, parsed.ref!, parsed.kind);
    if (!result) throw new Error(`github ${parsed.kind} REST API fetch failed`);
    const convInput = {
      kind: parsed.kind === "pr" ? "pull" : parsed.kind === "issue" ? "issues" : "discussions",
      org: parsed.org,
      repo: parsed.repo,
      number: parseInt(parsed.ref!, 10),
      originUrl: url,
      main: result.main,
      comments: result.comments,
      reviews: result.reviews,
      reviewComments: result.reviewComments,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = convertGithubPrIssue(convInput as any);
    return {
      input: { fn: "convertGithubPrIssue", args: [convInput] },
      markdown: r.markdown,
      rest: { imagesToDownload: r.imagesToDownload },
    };
  }
  if (parsed.kind === "release") {
    const release = fetchRelease(parsed.org, parsed.repo, parsed.ref!);
    if (!release) throw new Error(`github release fetch failed`);
    const convInput = { org: parsed.org, repo: parsed.repo, tag: parsed.ref!, originUrl: url, release };
    const r = convertGithubRelease(convInput);
    return {
      input: { fn: "convertGithubRelease", args: [convInput] },
      markdown: r.markdown,
      rest: { imagesToDownload: r.imagesToDownload },
    };
  }
  if (parsed.kind === "blob" || parsed.kind === "tree" || parsed.kind === "repo") {
    let raw = null;
    if (parsed.kind === "blob") raw = fetchRaw(parsed.org, parsed.repo, parsed.branch!, parsed.path!);
    else if (parsed.kind === "tree") raw = fetchTreeReadme(parsed.org, parsed.repo, parsed.branch!, parsed.path || "");
    else raw = fetchRepoReadme(parsed.org, parsed.repo);
    if (!raw) throw new Error(`github raw fetch failed`);
    const convInput = {
      org: parsed.org,
      repo: parsed.repo,
      branch: raw.branch,
      path: raw.resolvedPath,
      originUrl: url,
      body: raw.body,
    };
    const r = convertGithubRaw(convInput);
    return {
      input: { fn: "convertGithubRaw", args: [convInput] },
      markdown: r.markdown,
      rest: { imagesToDownload: r.imagesToDownload },
    };
  }
  throw new Error(`unsupported github URL kind: ${parsed.kind}`);
}

export const testHooks: SiteTestHooks = {
  name: "github",
  converterName: "convertGithubPrIssue",  // primary; runFromFixture dispatches all 3
  snapshotHosts: ["github.com"],
  runFromFixture,
  capture,
};
