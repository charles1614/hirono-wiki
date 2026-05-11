/**
 * Clean raw `pdftotext` output into something readable as markdown.
 *
 * pdftotext preserves the PDF's column-based spatial layout — centered
 * title blocks get ~50 spaces of leading indent, page-footer text
 * appears mid-flow, the arxiv vertical banner shows up as a random
 * line, and PDF fonts with character tracking render "FLUX" as "F LUX".
 * The raw dump is technically correct but unreadable.
 *
 * `cleanPdfText` is the orchestrator. Each pass is a named pure
 * function below. Passes are applied in order; order is load-bearing
 * (e.g. letter-spacing normalization must run before section-opener
 * detection, otherwise "A BSTRACT" won't match `Abstract`).
 */

// ---------------------------------------------------------------------------
// Heuristic thresholds — exposed so they're easy to tune.
// ---------------------------------------------------------------------------

/** Above this length, a line counts as "long" and likely contains prose. */
const LONG_LINE_THRESHOLD = 60;

/** Cluster of short-orphan blocks ≥ this size gets dropped as chart noise. */
const CHART_CLUSTER_MIN_BLOCKS = 2;

/** Scan only the first N lines for the cover-page section-opener. */
const COVER_PAGE_SCAN_LIMIT = 40;

/** English connective words. Lines with ≥2 of these are almost certainly prose. */
const STOP_WORDS: ReadonlySet<string> = new Set([
  "the", "a", "an", "of", "and", "to", "in", "is", "for", "with",
  "that", "this", "are", "on", "as", "be", "or", "not", "by", "from",
  "at", "we", "our", "their", "its", "it", "but", "if", "than", "have",
  "has", "can", "was", "were", "these", "those",
]);

/** Patterns whose entire-line match is dropped (boilerplate + chart noise). */
const DROP_PATTERNS: readonly RegExp[] = [
  /^arXiv:\s*\d+\.\d+v?\d*\s*\[/i,            // arxiv vertical banner
  /^Preprint\.\s*Under\s+review\.?\s*$/i,      // arxiv preprint footer
  /^Under\s+review\s+as\s+a\s+conference\s+paper/i,
  /^Published\s+as\s+a\s+conference\s+paper/i,
  /^Copyright\s+©?\s*\d{4}/i,                  // generic copyright
  /^\d{1,3}\s*$/,                              // bare page number
  /^\d+(\.\d+)?\s*$/,                          // chart-axis bare float (4.4, 0.8)
  /^Page\s+\d+\s+of\s+\d+$/i,                  // "Page N of M"
  /^\*+\s*$/,                                  // bare footnote marker "*" / "**"
  /^†+\s*$/,                                   // bare dagger footnote marker
  /^These\s+authors\s+contributed\s+equally/i, // arxiv-style first-author footnote
];

/** Canonical openers used to skip a paper's cover-page title block. */
const SECTION_OPENERS: readonly RegExp[] = [
  /^Abstract$/,
  /^ABSTRACT$/,
  /^Introduction$/,
  /^1\s+Introduction$/,
  /^1\.\s+Introduction$/,
  /^I\.\s+INTRODUCTION$/i,
  /^Executive\s+Summary$/i,
];

/** A line ending in one of these almost certainly ends a sentence. */
const SENTENCE_ENDERS = /[.!?:;]\s*$/;

/** Section / figure / table caption openers — preserve their parent block as prose. */
const SECTION_OR_CAPTION = /^(?:Figure|Table|Algorithm|Listing)\s+\d+[:.]|^\d+(?:\.\d+)?\s+[A-Z]|^[IVX]+\.\s+[A-Z]/;

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Clean a raw pdftotext dump into readable markdown body text.
 * Passes run in order; each transforms an in-memory line array.
 */
export function cleanPdfText(raw: string): string {
  let lines = raw.split(/\r?\n/);
  lines = trimEveryLine(lines);
  lines = normalizeLetterSpacing(lines);
  lines = dropBoilerplate(lines);
  lines = joinHyphenLineBreaks(lines);
  lines = dropChartTextClusters(lines);
  lines = skipCoverPageTitleBlock(lines);
  return finalizeText(lines);
}

// ---------------------------------------------------------------------------
// Passes
// ---------------------------------------------------------------------------

/** Pass 1: trim leading + trailing whitespace from each line. */
function trimEveryLine(lines: string[]): string[] {
  return lines.map((line) => line.replace(/\s+$/, "").replace(/^\s+/, ""));
}

/**
 * Pass 2: collapse letter-spaced text from PDF font tracking.
 *
 *   "F LUX"   → "FLUX"
 *   "A BSTRACT" → "ABSTRACT"
 *   "P REPRINT" → "PREPRINT"
 *
 * Pattern: a single uppercase letter + space + 2+ uppercase letters.
 * Run twice so chains like "A P REPRINT" → "A PREPRINT" → "APREPRINT"
 * resolve (first pass produces "PREPRINT"; second handles the leading
 * "A P" → "AP" once "PREPRINT" exists adjacent to it).
 */
function normalizeLetterSpacing(lines: string[]): string[] {
  const glue = (line: string) =>
    line.replace(/\b([A-Z]) ([A-Z]{2,})\b/g, (_m, head, tail) => head + tail);
  return lines.map((l) => glue(glue(l)));
}

/** Pass 3: drop lines matching DROP_PATTERNS (boilerplate + chart noise). */
function dropBoilerplate(lines: string[]): string[] {
  return lines.filter((line) => !DROP_PATTERNS.some((re) => re.test(line)));
}

/**
 * Pass 4: collapse line-wrap hyphenation conservatively.
 *
 * PDF line-wraps can hit two shapes:
 *   - Syllable break: "infer-\nence" → should be "inference"
 *   - Compound word:  "prefill-\nheavy" → should be "prefill-heavy"
 *
 * Without a dictionary we can't disambiguate. The safe collapse is to
 * keep the hyphen and drop the newline — "infer-ence" (slightly ugly
 * but readable) vs "prefill-heavy" (perfectly correct). Destroying
 * real compound words is the worst failure mode of the alternative,
 * so we accept the syllable-break ugliness.
 */
function joinHyphenLineBreaks(lines: string[]): string[] {
  const merged: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    const next = lines[i + 1];
    const endsWithHyphen = /[a-z]-$/.test(cur);
    const nextStartsLower = next && /^[a-z]/.test(next);
    if (endsWithHyphen && nextStartsLower) {
      merged.push(cur + next);
      i++;  // consumed next
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

/**
 * Pass 5: drop chart-text intrusions.
 *
 * When pdftotext encounters an embedded figure (bar chart, scatter
 * plot, line graph), it extracts the figure's axis labels + legend
 * entries as text inline with the surrounding prose. Symptom: clusters
 * of short non-sentence lines like "Speedup", "EAGLE-2", "Data scale"
 * appearing between paragraphs.
 *
 * Algorithm: split into blocks separated by blank lines. Classify each
 * block as prose vs short-orphan. Drop runs of ≥ CHART_CLUSTER_MIN_BLOCKS
 * consecutive short-orphan blocks (separated only by blanks). Single
 * short-orphan blocks survive — they're plausibly section headings or
 * figure captions worth keeping.
 */
function dropChartTextClusters(lines: string[]): string[] {
  const blocks = splitIntoBlocks(lines);
  const dropLineIdxs = new Set<number>();

  for (let bi = 0; bi < blocks.length; bi++) {
    if (blocks[bi].kind !== "short-orphan") continue;
    let runEnd = bi;
    let count = 1;
    while (
      runEnd + 2 < blocks.length &&
      blocks[runEnd + 1].kind === "blank" &&
      blocks[runEnd + 2].kind === "short-orphan"
    ) {
      runEnd += 2;
      count++;
    }
    if (count >= CHART_CLUSTER_MIN_BLOCKS) {
      for (let bk = bi; bk <= runEnd; bk++) {
        for (let li = blocks[bk].start; li < blocks[bk].end; li++) {
          dropLineIdxs.add(li);
        }
      }
      bi = runEnd;
    }
  }

  return dropLineIdxs.size === 0
    ? lines
    : lines.filter((_, idx) => !dropLineIdxs.has(idx));
}

/**
 * Pass 6: drop the cover-page title block. Title + authors are already
 * in the §2-frontmatter callout. Look for the first canonical
 * section-opener line ("Abstract", "1 Introduction", etc.) within the
 * first N lines. If found, drop everything before it.
 */
function skipCoverPageTitleBlock(lines: string[]): string[] {
  const limit = Math.min(lines.length, COVER_PAGE_SCAN_LIMIT);
  for (let i = 0; i < limit; i++) {
    if (SECTION_OPENERS.some((re) => re.test(lines[i]))) {
      return i > 0 ? lines.slice(i) : lines;
    }
  }
  return lines;
}

/** Pass 7: collapse 3+ blank-line runs to 2; strip leading + trailing blanks. */
function finalizeText(lines: string[]): string {
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*\n+/, "")
    .replace(/\n+\s*$/, "\n");
}

// ---------------------------------------------------------------------------
// Block-level classification (used by Pass 5)
// ---------------------------------------------------------------------------

type BlockKind = "prose" | "short-orphan" | "blank";

interface Block {
  kind: BlockKind;
  start: number;
  end: number;
}

function splitIntoBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i] === "") {
      const start = i;
      while (i < lines.length && lines[i] === "") i++;
      blocks.push({ kind: "blank", start, end: i });
      continue;
    }
    const start = i;
    while (i < lines.length && lines[i] !== "") i++;
    const blockLines = lines.slice(start, i);
    blocks.push({ kind: classifyBlock(blockLines), start, end: i });
  }
  return blocks;
}

function classifyBlock(blockLines: string[]): "prose" | "short-orphan" {
  return blockLines.some(isProseLine) ? "prose" : "short-orphan";
}

function isProseLine(line: string): boolean {
  if (SENTENCE_ENDERS.test(line)) return true;
  if (SECTION_OR_CAPTION.test(line)) return true;
  if (line.length > LONG_LINE_THRESHOLD && hasStopWords(line)) return true;
  return false;
}

function hasStopWords(line: string): boolean {
  const tokens = line.toLowerCase().match(/\b[a-z]+\b/g) ?? [];
  let count = 0;
  for (const t of tokens) {
    if (STOP_WORDS.has(t)) count++;
    if (count >= 2) return true;
  }
  return false;
}
