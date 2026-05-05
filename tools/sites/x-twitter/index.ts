/**
 * x.com / twitter.com — auth-gated micropost host.
 *
 * Twitter/X requires authentication to render tweet content
 * consistently — unauthenticated curl reliably returns the
 * "Sign in to X" / "Don't miss what's happening" shell. The legacy
 * `xMetadataStub` post-processor had two paths:
 *
 *   1. auth-gated (≪800 chars or known login-wall hints) → emit stub
 *   2. visible-content (rare, depends on opencli's pre-login skim) →
 *      run a substantial chrome-stripping pipeline (avatar drops, view-
 *      count drops, byline collapsing, photo unwraps, separator
 *      insertion between tweets) — see `sweep-results/x.com/sample.md`.
 *
 * Path 2 is fragile (X actively breaks scrapers) and rarely-exercised
 * — the corpus has ≤5 x.com bookmarks. Under the unified architecture
 * we collapse to stub-only behaviour: every x.com / twitter.com URL
 * deterministically produces a metadata stub. Content recovery
 * requires an authenticated client (X Premium API or similar) which
 * is out of scope.
 *
 * The legacy visible-content cleanup logic is preserved in git history
 * (commit 6153403^ or earlier) for reference if/when authenticated
 * fetching becomes practical.
 */

import { mkdirSync } from "node:fs";

import type { Site, FetchOpts, Result } from "../_shared/types.ts";
import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";

interface XStubArgs {
  url: string;
}

interface XStubResult {
  markdown: string;
  metadata: { source: string };
  flags: string[];
  notes: string[];
}

const HOSTS = new Set(["x.com", "twitter.com", "www.x.com", "www.twitter.com"]);

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); }
  catch { return ""; }
}

function makeXStub(opts: XStubArgs): XStubResult {
  const markdown = [
    `# Tweet / X post`,
    ``,
    `> 原文链接: ${opts.url}`,
    `> Status: auth-gated — Twitter/X requires login to fetch tweet content.`,
    `> The full tweet is available at the original URL above.`,
    ``,
    `---`,
    ``,
    `*This entry is a metadata stub. Content could not be extracted without`,
    `authentication. To capture tweet text, open the URL in an authenticated`,
    `browser session.*`,
    ``,
  ].join("\n");
  return {
    markdown,
    metadata: { source: "x-twitter-stub" },
    flags: ["intentional-stub", "x-twitter-auth-gated"],
    notes: ["x.com: auth-gated — emitted metadata stub"],
  };
}

export const site: Site = {
  name: "x-twitter",
  match: (url: string) => HOSTS.has(hostOf(url)),
  fetch: (url: string, opts: FetchOpts): Result => {
    mkdirSync(opts.slugDir, { recursive: true });
    const r = makeXStub({ url });
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
  name: "x-twitter",
  converterName: "convertXTwitterStub",
  snapshotHosts: ["x.com", "twitter.com"],
  runFromFixture(input: InputDoc) {
    if (input.fn !== "convertXTwitterStub") {
      throw new Error(`x-twitter test-hooks: unexpected fn ${input.fn}`);
    }
    const [opts] = input.args as [XStubArgs];
    const r = makeXStub(opts);
    return {
      markdown: r.markdown,
      rest: { metadata: r.metadata, flags: r.flags, notes: r.notes } as Record<string, unknown>,
    };
  },
  capture(url: string): CaptureResult {
    const args: [XStubArgs] = [{ url }];
    const r = makeXStub({ url });
    return {
      input: { fn: "convertXTwitterStub", args },
      markdown: r.markdown,
      rest: { metadata: r.metadata, flags: r.flags, notes: r.notes } as Record<string, unknown>,
    };
  },
};
