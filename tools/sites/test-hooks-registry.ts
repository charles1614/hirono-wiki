/**
 * Central registry of site-module test hooks.
 *
 * Every site module under `tools/sites/<name>/` exports a `testHooks`
 * declaration via `tools/sites/<name>/test-hooks.ts`. This registry
 * collects them. The test infrastructure
 * (`__tests__/converter-fixtures.test.ts`, `__tests__/capture-fixtures.ts`,
 * `__tests__/coverage-gate.test.ts`, `__tests__/approve.ts`,
 * `__tests__/check-drift.ts`) iterates the registry instead of
 * maintaining parallel switch statements.
 *
 * Adding a new site module to the test infrastructure is a one-file
 * change: write `tools/sites/<name>/test-hooks.ts` and add the import
 * here. The coverage-gate test will then enforce that the new module
 * has fixtures and a snapshot.
 */

import type { SiteTestHooks } from "./_shared/test-hooks-types.ts";

import { testHooks as xhsHooks } from "./xhs/test-hooks.ts";
import { testHooks as githubHooks } from "./github/test-hooks.ts";
import { testHooks as zhihuHooks } from "./zhihu/test-hooks.ts";
import { testHooks as weixinHooks } from "./weixin/test-hooks.ts";
import { testHooks as deepwikiComHooks } from "./deepwiki-com/test-hooks.ts";
import { testHooks as deepwikiLitenextHooks } from "./deepwiki-litenext/test-hooks.ts";
import { testHooks as linuxDoHooks } from "./linux-do/test-hooks.ts";
import { testHooks as nvidianewsHooks } from "./nvidianews/test-hooks.ts";
import { testHooks as epochAiHooks } from "./epoch-ai/test-hooks.ts";
import { testHooks as raschkaGalleryHooks } from "./sebastianraschka-gallery/test-hooks.ts";
import { testHooks as substackHooks } from "./substack/test-hooks.ts";
import { testHooks as arxivHooks } from "./arxiv/test-hooks.ts";
import { testHooks as intuitionlabsHooks } from "./intuitionlabs/test-hooks.ts";
import { testHooks as sspaiHooks } from "./sspai/test-hooks.ts";
import { testHooks as aleksagordicHooks } from "./aleksagordic/test-hooks.ts";
import { testHooks as blogGoogleHooks } from "./blog-google/test-hooks.ts";
import { testHooks as zeroOneMeHooks } from "./01-me/test-hooks.ts";
import { testHooks as blogCsdnHooks } from "./blog-csdn/test-hooks.ts";
import { testHooks as developerNvidiaHooks } from "./developer-nvidia/test-hooks.ts";
import { testHooks as docsNvidiaHooks } from "./docs-nvidia/test-hooks.ts";
import { testHooks as lmsysHooks } from "./lmsys/test-hooks.ts";
import { testHooks as sohuHooks } from "./sohu/test-hooks.ts";
import { testHooks as huggingfaceHooks } from "./huggingface/test-hooks.ts";
import { testHooks as qwenlmGithubIoHooks } from "./qwenlm-github-io/test-hooks.ts";
import { testHooks as anthropicHooks } from "./anthropic/test-hooks.ts";
import { testHooks as readthedocsHooks } from "./readthedocs/test-hooks.ts";
import { testHooks as feishuHooks } from "./feishu/test-hooks.ts";
import { testHooks as redditHooks } from "./reddit/test-hooks.ts";
import { testHooks as sebastianraschkaBlogHooks } from "./sebastianraschka-blog/test-hooks.ts";
import { testHooks as xTwitterHooks } from "./x-twitter/test-hooks.ts";
import { testHooks as qwenAiHooks } from "./qwen-ai/test-hooks.ts";
import { testHooks as v2exHooks } from "./v2ex/test-hooks.ts";
import { testHooks as defaultHooks } from "./_default/test-hooks.ts";

export const TEST_HOOKS: readonly SiteTestHooks[] = [
  xhsHooks,
  githubHooks,
  zhihuHooks,
  weixinHooks,
  deepwikiComHooks,
  deepwikiLitenextHooks,
  linuxDoHooks,
  nvidianewsHooks,
  epochAiHooks,
  raschkaGalleryHooks,
  substackHooks,
  arxivHooks,
  intuitionlabsHooks,
  sspaiHooks,
  aleksagordicHooks,
  blogGoogleHooks,
  zeroOneMeHooks,
  blogCsdnHooks,
  developerNvidiaHooks,
  docsNvidiaHooks,
  lmsysHooks,
  sohuHooks,
  huggingfaceHooks,
  qwenlmGithubIoHooks,
  anthropicHooks,
  readthedocsHooks,
  feishuHooks,
  redditHooks,
  sebastianraschkaBlogHooks,
  xTwitterHooks,
  qwenAiHooks,
  v2exHooks,
  defaultHooks,
];

/**
 * Find the hooks for a site by module name (e.g. "substack", "xhs").
 * Returns `null` if no module matches.
 */
export function findHooksByName(name: string): SiteTestHooks | null {
  return TEST_HOOKS.find((h) => h.name === name) ?? null;
}

/**
 * Find the hooks that own a given converter `fn` value (the value stored
 * in `input.json:fn`). Used by `runConverter()` to dispatch fixture replays.
 *
 * Note: `github` covers three converter functions (`convertGithubPrIssue`,
 * `convertGithubRelease`, `convertGithubRaw`); its `runFromFixture`
 * branches on `input.fn`. The lookup here matches the `converterName`
 * declared in the site's test-hooks.ts as a primary identifier, but
 * github's hooks accept all three. We do a special case: when no exact
 * match is found, try github's hooks if the fn name starts with
 * `convertGithub`.
 */
export function findHooksByConverterFn(fn: string): SiteTestHooks | null {
  for (const h of TEST_HOOKS) {
    if (h.converterName === fn) return h;
  }
  if (fn.startsWith("convertGithub")) {
    return findHooksByName("github");
  }
  // qwen-ai owns two converters: `convertQwenAi` (single article) and
  // `convertQwenResearchListing` (the /research listing page). Its
  // `converterName` is the primary one; route the listing variant to
  // the same hooks.
  if (fn === "convertQwenResearchListing") {
    return findHooksByName("qwen-ai");
  }
  return null;
}
