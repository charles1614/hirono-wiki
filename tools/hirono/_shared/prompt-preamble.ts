/**
 * Shared stable preambles for `hirono refine-*` + `auto-detect-entities` +
 * `propose-curation` subagent prompts.
 *
 * Why these exist: every `refine-*` prompt today mixes stable rules with
 * variable context (entity name, source bodies, etc.) in arbitrary order.
 * The Claude API caches by EXACT prefix match — so if every prompt-builder
 * puts these stable strings FIRST and variable context LAST, the API
 * caches the preamble once (per 5-minute TTL window) and bills only the
 * variable suffix at full rate on subsequent calls.
 *
 * Rules for editing these strings:
 *   - Every byte change invalidates the cache for ~5 minutes (TTL).
 *   - Keep them as deterministic constants — no interpolation, no dates.
 *   - Long enough to be worth caching (~500-1500 tokens each).
 *   - Subject-specific instructions belong in the per-command prompt-
 *     builder AFTER the preamble, not here.
 */

export const REFINE_ENTITY_PREAMBLE = `# refine-entity — Synthesis regeneration

You are regenerating the \`## Synthesis\` paragraph for an Entity page in
an LLM-maintained wiki (Karpathy LLM-wiki pattern; see
00_Meta/references/karpathy-llm-wiki-gist.md).

## Output format (strict — the CLI pastes your response verbatim)

  - **4–6 sentences**. No more, no fewer.
  - **Plain prose**. No bullet list, no headings, no fenced blocks.
  - **No wikilinks inside the Synthesis itself** — wikilinks belong in
    Observations bullets, not in the Synthesis paragraph.
  - **No preamble** like "Here is the new Synthesis:". Output ONLY the
    paragraph text. The CLI prepends \`## Synthesis\\n\\n\` automatically.

## Source-of-truth rules

  - Every substantive claim must trace to an Observation bullet OR to a
    cited Source excerpt provided below. Do not invent claims.
  - When evidence conflicts, name the conflict in the paragraph rather
    than silently picking one side.
  - When evidence is thin, say so (\"limited evidence so far ...\") rather
    than padding.

## Voice

Compressed, neutral, citation-grounded. Mirror the existing Synthesis
paragraphs in other active-tier entities — terse, no marketing language,
no rhetorical hedging beyond what the evidence supports.
`;

export const REFINE_TOPIC_PREAMBLE = `# refine-topic — Current understanding regeneration

You are regenerating the \`## Current understanding\` section of a Topic
page in an LLM-maintained wiki. Topics aggregate cross-source consensus
on a cross-cutting concept (e.g. "LLM Inference Systems", "Low-Precision
Training").

## Output format

  - **3–8 short paragraphs** OR a structured bullet list with sub-headers.
    Topic Current-understanding is denser than Entity Synthesis — Topics
    aggregate across multiple Sources, so longer is fine.
  - **No bold inside headings**, but inline **bold** for key terms within
    prose IS allowed (Topic style differs from Entity-Synthesis style).
  - **Inline \`[[<source-slug>]]\` wikilinks encouraged** so the reader can
    navigate to the cited evidence.

## Source-of-truth rules

  - Every substantive claim should trace to a cited Source excerpt provided
    below. Don't invent.
  - Cover: what we now know, where Sources agree, where they disagree (if
    anywhere), and the load-bearing primitives.
  - When evidence conflicts, name the conflict; when thin, say so.

## Comparison sub-shape (if present)

If the Topic body carries a \`## Comparison\` H2 heading, your response
MUST include both \`## Current understanding\` AND \`## Comparison\` sections,
in that order, with these exact headings. The \`## Comparison\` section
carries an axis × option markdown table (≥1 data row + header + separator).
Table cell values must be cited; cells whose value can't be cited from a
Source get \`?\` / \`N/A\` — do NOT invent numbers.

If the Topic body has NO \`## Comparison\` heading, output ONLY the new
\`## Current understanding\` content (no heading — the CLI prepends it).

## Voice

Dense, opinionated, citation-heavy. Mirror existing Topic pages.
`;

export const REFINE_SYNTHESIS_PREAMBLE = `# refine-synthesis — Corpus-wide thesis regeneration

You are regenerating the body of \`Synthesis.md\` — the corpus-wide thesis
page that states what an LLM-maintained wiki collectively argues across
all its Topics.

## Output format (strict — the CLI parses this)

Output ONLY the new body content (the section between the
\`# Synthesis — what this corpus argues\` H1 title and the
\`## How this page stays current\` footer). The CLI preserves the title
and footer; do not include them in your response.

  - **5–7 numbered H2 thematic sections** + one \`## Open threads\` footer.
  - Each section names a load-bearing claim about the systems layer of
    frontier LLMs and grounds it in named Topics.
  - **3–6 cross-cutting Open threads** at the bottom — questions that
    remain unresolved across the Topic set.

## Source-of-truth rules

  - Every substantive claim must be backed by ≥1
    \`[[01_Topics/<X>]]\` or \`[[03_Sources/YYYY/<slug>]]\` or \`[[<Entity>]]\`
    wikilink. **Orphan claims** (assertions with no link) **are a regression**.
  - **Preserve through-line where the corpus is unchanged**. Mirror the
    existing Synthesis's section structure unless the corpus has
    materially shifted; this is a refresh, not a from-scratch rewrite.
  - **Coverage**: the page should touch every Topic that has materially
    non-stub \`## Current understanding\`. A non-stub Topic absent from the
    synthesis means either you missed it (regression) or it doesn't fit
    any thematic section (flag as an Open thread).

## Voice

Dense, opinionated, citation-heavy. The synthesis is an *argument*, not
a tour. Each section should advance a claim the corpus jointly makes.

  - **No bold inside headings.** Inline **bold** in prose IS allowed.
  - **No "summary of summaries"** — each section advances a claim.
  - Do NOT wrap the response in code fences.
`;

export const AUTO_DETECT_ENTITIES_PREAMBLE = `# auto-detect-entities — Whole-Source NER pass

Extract entity references from one Source page. An entity is a named,
identifiable thing the wiki should track separately:

  - Specific models (DeepSeek-V3, Kimi K2, Llama 3.1-70B)
  - Specific hardware (H100, B200, Hopper, TPU v5e)
  - Specific frameworks/libraries (vLLM, SGLang, FlashAttention-3)
  - Specific organizations (NVIDIA, Anthropic, DeepSeek, HSBC)
  - Specific concepts with established names (MLA, MoE, chunked-prefill)

**NOT entities**: generic terms ("the model", "GPUs", "transformers"
without a specific architecture), filler phrases, prose verbs.

## Source-of-truth rules

  - Only extract entities **EXPLICITLY mentioned** in the Source body.
    Don't infer or generalize.
  - **Use existing entity slugs** when the Source mentions them — exact
    spelling, no variants. The existing-entity list is provided below.
  - **Skip generic concepts** that should be Topics, not Entities.
    Heuristic: "Transformers" is a Topic (cross-cutting concept);
    "TransformerEngine" is an Entity (specific library).

## Output format (strict — JSON only, no preamble, no markdown fence)

\`\`\`
{
  "entities": [
    { "name": "DeepSeek-V3", "description": "MoE LLM by DeepSeek, ~671B total / 37B active" },
    { "name": "FlashAttention-3", "description": "FA optimized for Hopper" }
  ]
}
\`\`\`

Empty array if nothing new is mentioned. One-line description per entity.
`;

export const PROPOSE_CURATION_PREAMBLE = `# propose-curation — wiki curation judgments

You are reviewing health-check + lint findings for an LLM-maintained wiki
and proposing specific curation actions. Each proposal maps to an
existing atomic CLI command which a dispatcher will execute on operator
approval.

## Available proposal kinds

  - \`merge-entities\` — two entity slugs refer to the same thing
    (e.g. \`bfloat16\` ↔ \`BF16\`). args: { source, target, reason }
  - \`merge-topics\` — two topic slugs collide. args: { source, target, reason }
  - \`rename-entity\` — canonical naming should change. args: { old, new, reason }
  - \`delete-orphan\` — a \`_seen/\` entity has refs=0 and is genuinely
    unwanted. args: { slug, reason }
  - \`refine-entity\` — active entity's Synthesis has drifted (stale or
    contradicted by Observations). args: { name, reason }
  - \`refine-topic\` — same for a Topic's Current understanding. args: { name, reason }
  - \`refine-synthesis\` — top-level Synthesis.md older than newest Topic
    \`synthesis_updated_at\` (lint: stale-top-synthesis). args: { reason }
  - \`add-comparison-heading\` — \`comparison-opportunity\` lint suggests a
    Topic might warrant a \`## Comparison\` section. Propose this kind
    ONLY when the contrasts are load-bearing (the Topic's central job
    is contrasting named options on shared axes), NOT incidental
    mentions. False positives: Topics that cite multiple entities but
    don't actually contrast them. args: { name, reason }
  - \`skip\` — finding is a false positive (SKU distinction like H100 vs
    H200, intentional naming, etc.). args: { finding, reason }

## Confidence levels

  - \`high\` — mechanically obvious, low risk if applied (case-only
    variants, refs=0 with no semantic value).
  - \`medium\` — defensible call but a thoughtful operator could disagree.
  - \`low\` — judgment-heavy, operator should definitely review.

## Output format (strict — JSON only, no preamble, no fence)

\`\`\`
{
  "proposals": [
    {
      "kind": "merge-entities",
      "args": { "source": "bfloat16", "target": "BF16", "reason": "case+spelling variant" },
      "confidence": "high",
      "rationale": "one-line: why this proposal"
    }
  ]
}
\`\`\`
`;
