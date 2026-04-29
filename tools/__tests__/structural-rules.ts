/**
 * Structural rules — defect detectors that run on rendered markdown.
 *
 * These rules layer ON TOP of byte-equal fixture tests and structural
 * snapshot invariants. They catch defects that survive into ground
 * truth — i.e. cases where the operator captured a fixture without
 * eye-reading carefully, and the saved expected.md has visible defects
 * that byte-equal can't surface (it just says "matches the saved bytes").
 *
 * Each rule has a name, a check function, and a "how to fix" hint.
 * `validateStructure()` runs all rules over the markdown and returns
 * an array of human-readable violation messages. Empty array = no defects.
 *
 * Used by:
 *   - converter-fixtures.test.ts — assert against saved expected.md
 *   - per-host-snapshot.test.ts — assert against saved snapshot .md
 *   - approve.ts — refuse to write artifacts if any rule violates
 */

export interface StructuralRule {
  name: string;
  /** Returns array of violation lines (empty = no defects). */
  check: (md: string) => string[];
  /** Short hint shown alongside violations. */
  hint: string;
}

/**
 * Strip fenced code blocks for rules that should NOT match content
 * inside fences. Returns markdown with fenced regions replaced by blanks.
 */
function stripFences(md: string): string {
  const out: string[] = [];
  let inFence = false;
  for (const line of md.split("\n")) {
    if (/^```/.test(line.trim())) { inFence = !inFence; out.push(""); continue; }
    out.push(inFence ? "" : line);
  }
  return out.join("\n");
}

/**
 * Strip inline `code` spans on a line, replacing each with a non-asterisk
 * placeholder. Using empty string would be wrong: `**\`code\`**` would
 * collapse into `****`, false-positive on the no-quad-asterisk-runs rule.
 * The placeholder keeps adjacent emphasis markers from merging.
 */
function stripInlineCode(line: string): string {
  return line.replace(/`[^`\n]+`/g, "⁣"); // U+2063 INVISIBLE SEPARATOR
}

const RULES: StructuralRule[] = [
  {
    name: "no-multi-line-link-wrappers",
    hint: "A `[\\n\\n![alt](url)\\n\\n](other-url)` pattern survived. Click-to-enlarge / quoted-card unwrap is missing for this site. Walk lines: lone `[` then image/text then `](url)`.",
    check: (md) => {
      const lines = md.split("\n");
      const violations: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() !== "[") continue;
        // Look ahead up to 5 non-blank lines for `](url)` closing.
        let j = i + 1;
        let nonBlank = 0;
        while (j < lines.length && j < i + 8) {
          const t = lines[j].trim();
          if (t !== "") {
            nonBlank++;
            if (/^\]\(.+\)\s*$/.test(t)) {
              violations.push(`line ${i + 1}: lone \`[\` opening multi-line wrapper, closing at line ${j + 1}`);
              break;
            }
            if (nonBlank > 6) break;
          }
          j++;
        }
      }
      return violations;
    },
  },
  {
    name: "no-over-escaped-emoji-shortcodes",
    hint: "Turndown over-escaped underscores in `:emoji_name:` shortcodes. Add a converter pass to unescape `\\_` inside `:[a-z][\\w]*:` shortcodes (fence-aware).",
    check: (md) => {
      const stripped = stripFences(md);
      const violations: string[] = [];
      const re = /:[a-z][a-z\d]*\\_[a-z\d_]*:/g;
      const lines = stripped.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const noCode = stripInlineCode(lines[i]);
        let m;
        while ((m = re.exec(noCode)) !== null) {
          violations.push(`line ${i + 1}: over-escaped emoji shortcode \`${m[0]}\``);
        }
        re.lastIndex = 0;
      }
      return violations;
    },
  },
  {
    name: "no-over-escaped-image-syntax",
    hint: "Turndown over-escaped a `![...](...)` image-syntax-shaped expression in plain prose. Common when emoji shortcodes like `:star:` are wrapped in `[]`. Unescape `\\!\\[X\\]` patterns where X is an emoji shortcode.",
    check: (md) => {
      const stripped = stripFences(md);
      const violations: string[] = [];
      const lines = stripped.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const noCode = stripInlineCode(lines[i]);
        if (/\\!\\\[/.test(noCode)) {
          violations.push(`line ${i + 1}: over-escaped image-shaped syntax \`\\!\\[\``);
        }
      }
      return violations;
    },
  },
  {
    name: "no-empty-headings",
    hint: "A `## ` heading with no text. Usually an H1-demotion artifact when the original page had a whitespace-only first child. Strip empty headings post-turndown.",
    check: (md) => {
      const lines = md.split("\n");
      const violations: string[] = [];
      let inFence = false;
      for (let i = 0; i < lines.length; i++) {
        if (/^```/.test(lines[i].trim())) { inFence = !inFence; continue; }
        if (inFence) continue;
        if (/^#{1,6}\s*$/.test(lines[i])) {
          violations.push(`line ${i + 1}: empty heading \`${lines[i]}\``);
        }
      }
      return violations;
    },
  },
  {
    name: "no-tripled-newlines",
    hint: "Three or more consecutive newlines. Usually means a removal didn't collapse surrounding whitespace. Run `md.replace(/\\n{3,}/g, '\\n\\n')` at the end of the converter.",
    check: (md) => {
      // Find runs of 3+ \n. Allow `\n\n\n` at file boundaries (rare but valid).
      const matches = [...md.matchAll(/\n{3,}/g)];
      if (matches.length === 0) return [];
      // Get line numbers (count \n before match.index)
      return matches.map((m) => {
        const before = md.slice(0, m.index);
        const lineNo = (before.match(/\n/g) || []).length + 1;
        return `line ${lineNo}: ${m[0].length} consecutive newlines`;
      });
    },
  },
  {
    name: "no-bold-glued-to-word",
    hint: "A `**bold**` marker is glued to an ASCII word character without space (e.g. `**GTC—**Powering`). CommonMark intraword-emphasis ambiguity — many renderers fail to delimit the bold span. Apply `applyCommonMarkdownCleanups` from `tools/sites/_shared/markdown-cleanups.ts` at the end of the converter.",
    check: (md) => {
      // Cross-line state walker mirroring the converter's `addSpaceAroundBolds`.
      // Tracks `insideBold` across `\n` so multi-line bolds (`**A\nB**`) don't
      // false-positive at line edges, and resets at fence boundaries.
      const violations: string[] = [];
      const isWord = (c: string) => /[A-Za-z0-9]/.test(c);
      let i = 0;
      let insideBold = false;
      let inFence = false;
      let prevChar = "\n";
      let lineNo = 1;
      while (i < md.length) {
        // Fenced code boundary detection.
        if (md[i] === "`" && md[i + 1] === "`" && md[i + 2] === "`" && (prevChar === "\n" || i === 0)) {
          const eol = md.indexOf("\n", i);
          if (eol < 0) break;
          inFence = !inFence;
          i = eol + 1;
          lineNo++;
          prevChar = "\n";
          continue;
        }
        if (inFence) {
          if (md[i] === "\n") lineNo++;
          prevChar = md[i];
          i++;
          continue;
        }
        // Inline code span — skip content (no bold detection inside).
        if (md[i] === "`") {
          let runLen = 1;
          while (md[i + runLen] === "`") runLen++;
          const opener = md.slice(i, i + runLen);
          const eol = md.indexOf("\n", i + runLen);
          const lineEnd = eol < 0 ? md.length : eol;
          const close = md.indexOf(opener, i + runLen);
          if (close < 0 || close >= lineEnd) {
            prevChar = "`";
            i++;
            continue;
          }
          prevChar = "`";
          i = close + runLen;
          continue;
        }
        if (md[i] === "*" && md[i + 1] === "*") {
          const after = md[i + 2] || "";
          if (insideBold) {
            if (isWord(after)) {
              const ctx = md.slice(Math.max(0, i - 25), Math.min(md.length, i + 25));
              violations.push(`line ${lineNo}: \`${ctx.replace(/\n/g, "\\n")}\` (closing \`**\` glued to '${after}')`);
            }
          } else {
            if (isWord(prevChar)) {
              const ctx = md.slice(Math.max(0, i - 25), Math.min(md.length, i + 25));
              violations.push(`line ${lineNo}: \`${ctx.replace(/\n/g, "\\n")}\` (opening \`**\` glued to prev '${prevChar}')`);
            }
          }
          insideBold = !insideBold;
          prevChar = "*";
          i += 2;
          continue;
        }
        if (md[i] === "\n") lineNo++;
        prevChar = md[i];
        i++;
      }
      return violations;
    },
  },
  {
    name: "no-quad-asterisk-runs",
    hint: "Runs of 4+ `*` outside code. Turndown produces this when adjacent `<strong>` siblings are emitted as `**A****B**`. Fix at the HTML level: merge adjacent same-type emphasis siblings before turndown.",
    check: (md) => {
      const stripped = stripFences(md);
      const violations: string[] = [];
      const lines = stripped.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const noCode = stripInlineCode(lines[i]);
        if (/\*{4,}/.test(noCode)) {
          violations.push(`line ${i + 1}: ${noCode.match(/\*{4,}/)?.[0].length} consecutive \`*\` chars`);
        }
      }
      return violations;
    },
  },
];

export interface StructuralViolation {
  rule: string;
  hint: string;
  details: string[];
}

/**
 * Run all structural rules over the markdown. Returns an array of
 * violations (empty = passes). Each violation lists the rule name, its
 * fix hint, and the per-line details emitted by the rule.
 */
export function validateStructure(md: string): StructuralViolation[] {
  const out: StructuralViolation[] = [];
  for (const rule of RULES) {
    const details = rule.check(md);
    if (details.length > 0) {
      out.push({ rule: rule.name, hint: rule.hint, details });
    }
  }
  return out;
}

/**
 * Format a list of violations as a human-readable error message suitable
 * for `assert.fail()`.
 */
export function formatViolations(violations: StructuralViolation[], context: string): string {
  if (violations.length === 0) return "";
  const lines: string[] = [`${context}: structural rule violations`];
  for (const v of violations) {
    lines.push(`  [${v.rule}] (${v.details.length} match${v.details.length === 1 ? "" : "es"})`);
    lines.push(`    hint: ${v.hint}`);
    for (const d of v.details.slice(0, 5)) {
      lines.push(`    - ${d}`);
    }
    if (v.details.length > 5) {
      lines.push(`    ... and ${v.details.length - 5} more`);
    }
  }
  return lines.join("\n");
}

export { RULES };
