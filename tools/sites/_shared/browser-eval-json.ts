/**
 * Shared parser for `opencli browser eval` stdout.
 *
 * `opencli browser eval <script>` writes the script's return value to stdout,
 * sometimes prefixed and/or suffixed with banner text (update-available
 * notices, page-load logs). Eval scripts that return non-trivial data
 * `JSON.stringify` their result so the structured value can be recovered
 * from the noise. This helper finds the first `{`-rooted JSON object in the
 * stream and returns it parsed, or `null` if no valid object can be found.
 *
 * The walker tracks string state so braces inside string values don't
 * mis-balance the depth count (HTML attribute values like `style="..."`
 * frequently contain `{` / `}`).
 *
 * Used by every site fetcher that calls `opencli browser eval`. Previously
 * each fetcher had its own copy of this 15-line parser; this is the canonical
 * implementation.
 */

export function extractJsonFromEvalStdout(stdout: string): unknown | null {
  const start = stdout.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let end = -1;
  let inStr = false;
  let esc = false;
  for (let i = start; i < stdout.length; i++) {
    const c = stdout[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === "\"") { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) return null;
  try {
    return JSON.parse(stdout.slice(start, end + 1));
  } catch {
    return null;
  }
}
