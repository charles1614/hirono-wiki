/**
 * *.feishu.cn — Feishu (Lark) wiki and document hosts. Effectively all
 * wiki content is auth-gated; an unauthenticated curl returns a login
 * shell, and the legacy post-processor was just a fancy login-wall
 * detector with a couple of public-page chrome patches.
 *
 * This module makes that explicit: emit `intentional-stub` for any URL
 * on a `*.feishu.cn` host, pointing the operator at `lark-hirono fetch`
 * (which uses authenticated API calls to retrieve real content).
 *
 * The stub is generated WITHOUT fetching — there's no useful content
 * to recover via curl, so we don't waste a request. This makes the
 * fixture deterministic from URL alone.
 */

import { mkdirSync } from "node:fs";

import type { Site, FetchOpts, Result } from "../_shared/types.ts";
import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";

interface FeishuStubArgs {
  url: string;
}

interface FeishuStubResult {
  markdown: string;
  metadata: { source: string };
  flags: string[];
  notes: string[];
}

const HOST_PATTERN = /\.feishu\.cn$/i;

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); }
  catch { return ""; }
}

function makeFeishuStub(opts: FeishuStubArgs): FeishuStubResult {
  const markdown = [
    `# Feishu Wiki Page`,
    ``,
    `> 原文链接: ${opts.url}`,
    `> Status: auth-gated — this is a private Feishu wiki page.`,
    `> Fetch with: \`lark-hirono fetch --doc <node-token>\``,
    ``,
    `---`,
    ``,
    `*This entry is a metadata stub. Feishu wiki content is auth-gated;`,
    `the unauthenticated HTTP path returns a login shell. Use lark-hirono`,
    `(authenticated API client) to retrieve the real content. The node`,
    `token is the last path segment of the wiki URL.*`,
    ``,
  ].join("\n");
  return {
    markdown,
    metadata: { source: "feishu-stub" },
    flags: ["intentional-stub", "feishu-auth-gated"],
    notes: ["feishu: auth-gated — emitted stub with lark-hirono fetch instructions"],
  };
}

export const site: Site = {
  name: "feishu",
  match: (url: string) => HOST_PATTERN.test(hostOf(url)),
  fetch: (url: string, opts: FetchOpts): Result => {
    mkdirSync(opts.slugDir, { recursive: true });
    const r = makeFeishuStub({ url });
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
  name: "feishu",
  converterName: "convertFeishuStub",
  snapshotHosts: ["swfvqxo30ma.feishu.cn"],
  runFromFixture(input: InputDoc) {
    if (input.fn !== "convertFeishuStub") {
      throw new Error(`feishu test-hooks: unexpected fn ${input.fn}`);
    }
    const [opts] = input.args as [FeishuStubArgs];
    const r = makeFeishuStub(opts);
    return {
      markdown: r.markdown,
      rest: { metadata: r.metadata, flags: r.flags, notes: r.notes } as Record<string, unknown>,
    };
  },
  capture(url: string): CaptureResult {
    const args: [FeishuStubArgs] = [{ url }];
    const r = makeFeishuStub({ url });
    return {
      input: { fn: "convertFeishuStub", args },
      markdown: r.markdown,
      rest: { metadata: r.metadata, flags: r.flags, notes: r.notes } as Record<string, unknown>,
    };
  },
};
