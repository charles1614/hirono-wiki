/**
 * Test hooks for the linux-do site module.
 * See `tools/sites/_shared/test-hooks-types.ts`.
 */

import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";
import { convertLinuxDoTopic } from "./converter.ts";
import { fetchLinuxDoTopic, type LinuxDoTopic } from "./fetcher.ts";

function runFromFixture(input: InputDoc): { markdown: string; rest: Record<string, unknown> } {
  if (input.fn !== "convertLinuxDoTopic") {
    throw new Error(`linux-do test-hooks: unexpected fn ${input.fn}`);
  }
  const [topic] = input.args as [LinuxDoTopic];
  const r = convertLinuxDoTopic(topic);
  const { markdown, ...rest } = r;
  return { markdown, rest: rest as Record<string, unknown> };
}

function capture(url: string): CaptureResult {
  const topic = fetchLinuxDoTopic(url);
  if (topic.error) throw new Error(`linux-do fetch failed: ${topic.error}`);
  if (topic.posts.length === 0) throw new Error(`linux-do topic has 0 posts`);
  const result = convertLinuxDoTopic(topic);
  const { markdown, ...rest } = result;
  return {
    input: { fn: "convertLinuxDoTopic", args: [topic] },
    markdown,
    rest: rest as Record<string, unknown>,
  };
}

export const testHooks: SiteTestHooks = {
  name: "linux-do",
  converterName: "convertLinuxDoTopic",
  snapshotHosts: ["linux.do"],
  runFromFixture,
  capture,
};
