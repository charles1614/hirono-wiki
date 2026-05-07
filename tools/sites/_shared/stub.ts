/**
 * Shared stub-emission helper.
 *
 * Every site module produces stub results in the same shape: a §2-
 * contract markdown body with a clear status line, optional advice,
 * an `## Error detail` section carrying the raw upstream trace
 * (curl stderr, lark-cli JSON error, browser-eval signedIn=false,
 * etc.), and a uniform `Result` with `error_detail` populated.
 *
 * Per-site stub functions delegate to `makeStub` so the shape is
 * consistent across every host module — operators reading any
 * stub know exactly where to look for the diagnostic.
 *
 * Length cap on `errorDetail`: 2000 chars. Long lark-cli traces
 * and big curl response bodies are truncated with a marker so
 * source.json doesn't bloat.
 */

import type { Result } from "./types.ts";

export interface MakeStubArgs {
  /** Origin URL of the bookmark we tried to fetch. */
  url: string;
  /**
   * Module identifier — e.g. `"feishu"`, `"_default"`, `"qwen-ai"`.
   * Used in `flags[]` (`{module}-{kind}`) and `metadata.source`.
   */
  module: string;
  /**
   * Specific stub kind — e.g. `"auth-gated"`, `"deleted"`,
   * `"fetch-failed"`, `"empty"`. Combined with `module` to produce
   * the typed flag.
   */
  kind: string;
  /**
   * Page title for the stub's H1. e.g. `"Feishu wiki page (no read access)"`.
   * If omitted, derived as `"<module> stub: <kind>"`.
   */
  title?: string;
  /**
   * One-line, human-readable status — appears as `> Status:` callout in
   * the markdown AND as the inline summary in `hirono raindrop status`.
   * Should be concise (≤120 chars). Don't include the URL.
   */
  summary: string;
  /**
   * Operator-actionable advice rendered as italic prose after the
   * status callout. Optional; defaults to a generic "open in browser"
   * line when omitted.
   */
  advice?: string;
  /**
   * Raw upstream error trace — surfaced verbatim in source.json
   * (capped at 2KB) AND as a fenced `## Error detail` section in
   * the stub markdown. Pass curl stderr, lark-cli error JSON,
   * browser-eval result, or any other diagnostic that helps the
   * operator understand WHY the fetch produced a stub.
   *
   * Omit when there's nothing more to say beyond `summary`.
   */
  errorDetail?: string;
}

const MAX_ERROR_DETAIL = 2000;
const TRUNCATION_MARKER = "\n... [truncated, see source.json for full trace]";

/** Trim a free-form error string to ≤2KB. Preserves leading content. */
export function clampErrorDetail(detail: string): string {
  if (detail.length <= MAX_ERROR_DETAIL) return detail;
  const room = MAX_ERROR_DETAIL - TRUNCATION_MARKER.length;
  return detail.slice(0, room) + TRUNCATION_MARKER;
}

/**
 * Compose a structured `error_detail` for source.json. Format:
 *
 *   <summary>\n\n<raw upstream trace>
 *
 * The summary line is always present so consumers (status CLI, etc.)
 * can render a one-line preview without parsing the full trace.
 */
function composeErrorDetail(summary: string, detail?: string): string {
  if (!detail || !detail.trim()) return summary;
  const merged = `${summary}\n\n${detail.trim()}`;
  return clampErrorDetail(merged);
}

const DEFAULT_ADVICE = "Open the URL in a browser to inspect the source manually.";

export function makeStub(args: MakeStubArgs): Result {
  const title = args.title ?? `${args.module} stub: ${args.kind}`;
  const flag = `${args.module}-${args.kind}`;
  const advice = args.advice ?? DEFAULT_ADVICE;

  const lines: string[] = [
    `# ${title}`,
    ``,
    `> 原文链接: ${args.url}`,
    `> Status: ${args.summary}`,
    ``,
    `---`,
    ``,
    `*${advice}*`,
  ];
  if (args.errorDetail && args.errorDetail.trim()) {
    lines.push(``, `## Error detail`, ``, `\`\`\``, clampErrorDetail(args.errorDetail.trim()), `\`\`\``);
  }
  lines.push(``);

  const error_detail = composeErrorDetail(args.summary, args.errorDetail);

  return {
    markdown: lines.join("\n"),
    images: [],
    metadata: {
      source: `${args.module}-stub`,
      kind: args.kind,
      summary: args.summary,
    },
    flags: ["intentional-stub", flag],
    notes: [`${args.module}: stub emitted — ${args.kind}: ${args.summary}`],
    error_detail,
  };
}
