/**
 * qwen.ai — Alibaba's Qwen chat / product surface. Pure JavaScript SPA
 * shell: every URL returns the same ~88 KB chrome with `<title>Qwen</title>`,
 * empty `<body>`, and four `<script>` tags that hydrate content
 * client-side. Plain curl (and even opencli's web-read on cold cache)
 * gets nothing usable.
 *
 * The real Qwen research blog is at qwenlm.github.io (already migrated
 * to `tools/sites/qwenlm-github-io/`, server-rendered Hugo). qwen.ai
 * URLs are typically marketing pages or chat-product entrypoints that
 * have no extractable content.
 *
 * This module emits a stub for every qwen.ai URL pointing the operator
 * at the qwenlm.github.io blog as the canonical Qwen content source.
 */

import { mkdirSync } from "node:fs";

import type { Site, FetchOpts, Result } from "../_shared/types.ts";
import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";

interface QwenStubArgs {
  url: string;
}

interface QwenStubResult {
  markdown: string;
  metadata: { source: string };
  flags: string[];
  notes: string[];
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); }
  catch { return ""; }
}

function makeQwenStub(opts: QwenStubArgs): QwenStubResult {
  const markdown = [
    `# Qwen page`,
    ``,
    `> 原文链接: ${opts.url}`,
    `> Status: SPA shell — qwen.ai is a JavaScript-only single-page app.`,
    `> The real Qwen research blog is at https://qwenlm.github.io/blog/`,
    ``,
    `---`,
    ``,
    `*This entry is a metadata stub. qwen.ai serves an empty SPA shell to`,
    `unauthenticated HTTP fetches; content is hydrated client-side. For`,
    `Qwen research posts, use the qwenlm.github.io URL (Hugo,`,
    `server-rendered, captured by tools/sites/qwenlm-github-io/).*`,
    ``,
  ].join("\n");
  return {
    markdown,
    metadata: { source: "qwen-ai-spa-stub" },
    flags: ["intentional-stub", "qwen-ai-spa"],
    notes: ["qwen.ai: SPA shell — emitted stub redirecting to qwenlm.github.io"],
  };
}

export const site: Site = {
  name: "qwen-ai",
  match: (url: string) => hostOf(url) === "qwen.ai",
  fetch: (url: string, opts: FetchOpts): Result => {
    mkdirSync(opts.slugDir, { recursive: true });
    const r = makeQwenStub({ url });
    return {
      markdown: r.markdown,
      images: [],
      metadata: r.metadata,
      flags: r.flags,
      notes: r.notes,
    };
  },
};

export const testHooks: SiteTestHooks = {
  name: "qwen-ai",
  converterName: "convertQwenAiStub",
  snapshotHosts: ["qwen.ai"],
  runFromFixture(input: InputDoc) {
    if (input.fn !== "convertQwenAiStub") {
      throw new Error(`qwen-ai test-hooks: unexpected fn ${input.fn}`);
    }
    const [opts] = input.args as [QwenStubArgs];
    const r = makeQwenStub(opts);
    return {
      markdown: r.markdown,
      rest: { metadata: r.metadata, flags: r.flags, notes: r.notes } as Record<string, unknown>,
    };
  },
  capture(url: string): CaptureResult {
    const args: [QwenStubArgs] = [{ url }];
    const r = makeQwenStub({ url });
    return {
      input: { fn: "convertQwenAiStub", args },
      markdown: r.markdown,
      rest: { metadata: r.metadata, flags: r.flags, notes: r.notes } as Record<string, unknown>,
    };
  },
};
