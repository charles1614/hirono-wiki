/**
 * Shared post-turndown / post-markdown-compose cleanups, applied by
 * each site's converter at the end of its pipeline.
 *
 * Lifted into a shared module so all site modules apply the same set
 * of mechanical fixes. Each function is idempotent and fence-aware
 * (skips inside ``` fenced code blocks).
 */

/**
 * Insert spaces around `**bold**` markers when they're glued to ASCII
 * word characters — CommonMark / GFM intraword-emphasis ambiguity that
 * causes many renderers to fail to delimit the bold span. Handles both
 * sides:
 *
 *   `**GTC—**Powering`       →  `**GTC—** Powering`     (closing+word)
 *   `word**bold**`           →  `word **bold**`         (word+opening)
 *   `**A**B**C**`            →  `**A** B **C**`         (multi-bold gap)
 *
 * Implementation note: a regex like `\*\*X\*\*Y` doesn't track bold
 * pair-balance — when a line has multiple bolds (`**A**B**C**`), the
 * regex engine can match `**...**Y` where the body spans the gap
 * between two bolds, treating a CLOSING `**` as an OPENING. Inserting
 * a space then "fixes" the wrong place and breaks the second bold.
 *
 * This walker tracks bold state explicitly: toggles on each `**`,
 * inserts space at boundaries based on adjacent character class.
 * Skips inside fenced code blocks AND inside inline `code` spans (where
 * `**` is content, not formatting).
 *
 * Restricted to ASCII letters/digits — CJK intraword-emphasis is
 * handled differently by most renderers and inserting visible spaces
 * between Chinese/Japanese chars looks worse than glued bold.
 */
export function addSpaceAroundBolds(md: string): string {
  const isWord = (c: string) => /[A-Za-z0-9]/.test(c);

  // Single-pass walker over the whole document. Tracks `insideBold` state
  // ACROSS line boundaries so multi-line bolds (`**A\nB**`) don't get
  // false-fixed at line edges. Resets state at fence boundaries (where
  // the inside is verbatim code, not markdown).
  let out = "";
  let i = 0;
  let insideBold = false;
  let inFence = false;
  let prevChar = "\n";  // virtual: line starts treat preceding char as newline
  while (i < md.length) {
    // Fenced code block boundary: ``` at start of a line.
    if (md[i] === "`" && md[i + 1] === "`" && md[i + 2] === "`" && (prevChar === "\n" || i === 0)) {
      // Find end of line, copy fence line verbatim.
      const eol = md.indexOf("\n", i);
      const end = eol < 0 ? md.length : eol;
      out += md.slice(i, end);
      prevChar = end > 0 ? md[end - 1] : "\n";
      if (eol < 0) { i = md.length; break; }
      out += "\n";
      i = eol + 1;
      inFence = !inFence;
      // Inside-fence: passes through verbatim until next ``` line.
      if (inFence) {
        const nextFence = md.indexOf("\n```", i - 1);
        if (nextFence < 0) {
          out += md.slice(i);
          return out;
        }
        out += md.slice(i, nextFence + 1);
        i = nextFence + 1;
        prevChar = "\n";
      }
      continue;
    }
    if (inFence) {
      // Should be unreachable due to slice above, but just in case.
      out += md[i];
      prevChar = md[i];
      i++;
      continue;
    }
    // Inline code span (single-line; backtick run with width-matched close).
    if (md[i] === "`") {
      let runLen = 1;
      while (md[i + runLen] === "`") runLen++;
      const opener = md.slice(i, i + runLen);
      // Search for matching closer on the same line.
      const eol = md.indexOf("\n", i + runLen);
      const lineEnd = eol < 0 ? md.length : eol;
      const close = md.indexOf(opener, i + runLen);
      if (close < 0 || close >= lineEnd) {
        // Unmatched — emit one ` and continue.
        out += md[i];
        prevChar = md[i];
        i++;
        continue;
      }
      out += md.slice(i, close + runLen);
      prevChar = "`";
      i = close + runLen;
      continue;
    }
    // Bold marker?
    if (md[i] === "*" && md[i + 1] === "*") {
      const after = md[i + 2] || "";
      if (insideBold) {
        // CLOSING `**` — insert space before next char if it's a word.
        out += "**";
        i += 2;
        if (isWord(after)) { out += " "; }
      } else {
        // OPENING `**` — insert space after prev char if it was a word.
        if (isWord(prevChar)) { out += " "; }
        out += "**";
        i += 2;
      }
      insideBold = !insideBold;
      prevChar = "*";
      continue;
    }
    // Normal char.
    out += md[i];
    prevChar = md[i];
    i++;
  }
  return out;
}

/**
 * Collapse runs of 4+ asterisks (e.g. `****text****`, `**A****B**`) to
 * the single bold marker `**`. These runs come from turndown rendering
 * adjacent or nested `<strong>` siblings as `**A****B**` — the structural
 * rule `no-quad-asterisk-runs` flags them as defects. Fence-aware:
 * skips runs inside ``` fenced code blocks.
 *
 * Idempotent. Safe on already-clean input (no `\*{4,}` runs → no-op).
 *
 * Implementation: line-based walker that tracks fence state. Inside a
 * fence (between matching ``` lines), the line is copied verbatim.
 * Outside, every run of 4+ `*` chars collapses to `**`. The collapse
 * loses no content because turndown's adjacent-strong artifact never
 * has meaningful text between the doubled markers.
 */
export function collapseQuadAsteriskRuns(md: string): string {
  const lines = md.split("\n");
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (trimmed.startsWith("```")) { inFence = !inFence; continue; }
    if (inFence) continue;
    lines[i] = lines[i].replace(/\*{4,}/g, "**");
  }
  return lines.join("\n");
}

/**
 * Bundle of cleanups every converter should apply at the end of its
 * pipeline. The bold-spacing walker handles both sides (close+word and
 * word+open) in one pass with proper state tracking. The quad-asterisk
 * collapser fixes adjacent-strong artifacts.
 */
export function applyCommonMarkdownCleanups(md: string): string {
  return collapseQuadAsteriskRuns(addSpaceAroundBolds(md));
}
