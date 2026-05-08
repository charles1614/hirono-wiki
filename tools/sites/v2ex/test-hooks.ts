/**
 * Test hooks for the v2ex site module.
 * See `tools/sites/_shared/test-hooks-types.ts`.
 */

import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";
import { convertV2exTopic } from "./converter.ts";
import { fetchV2exTopic, type V2exTopic } from "./fetcher.ts";

function runFromFixture(input: InputDoc): { markdown: string; rest: Record<string, unknown> } {
  if (input.fn !== "convertV2exTopic") {
    throw new Error(`v2ex test-hooks: unexpected fn ${input.fn}`);
  }
  const [topic] = input.args as [V2exTopic];
  const r = convertV2exTopic(topic);
  const { markdown, ...rest } = r;
  return { markdown, rest: rest as Record<string, unknown> };
}

function capture(url: string): CaptureResult {
  const topic = fetchV2exTopic(url);
  if (topic.error) throw new Error(`v2ex fetch failed: ${topic.error}`);
  if (topic.posts.length === 0) throw new Error(`v2ex topic has 0 posts`);
  const result = convertV2exTopic(topic);
  const { markdown, ...rest } = result;
  return {
    input: { fn: "convertV2exTopic", args: [topic] },
    markdown,
    rest: rest as Record<string, unknown>,
  };
}

export const testHooks: SiteTestHooks = {
  name: "v2ex",
  converterName: "convertV2exTopic",
  snapshotHosts: ["v2ex.com", "www.v2ex.com"],
  runFromFixture,
  capture,
};
