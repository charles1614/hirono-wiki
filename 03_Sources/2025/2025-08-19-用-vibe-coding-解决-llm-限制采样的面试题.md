---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://01.me/2025/07/constrained_sampling_vibe_coding/
tags: [inference, minimal-impl]
---

# [2025-08-19] 用 Vibe Coding 解决 LLM 限制采样的面试题

## TL;DR

[[Bojie Li]] walks through a [[Pine AI]] vibe-coding interview challenge — implement constrained LLM sampling so every generated word falls within a 3,000-word vocabulary — using Cursor + Gemini 2.5 Pro. Five rounds of human-directed iteration: an initial wrong token-whitelist approach, a Trie-based approach that collapsed under tokenizer edge cases, a string-level LogitsProcessor that worked, then backtracking and colorized debug output. The entire session (coding + this blog post auto-generated from a work log) took 1.5 hours.

## Key claims

- **Naive token-whitelist fails**: building a whitelist of token IDs from the 3,000-word vocabulary blocks multi-token words — after generating `ap`, no legal continuation `ple` exists, so `apple` can never be produced. The error is treating tokens as words rather than as sub-word units.
- **Trie approach is theoretically sound but collapses under tokenizer edge cases**: space-prefixed tokens (e.g. `▁apple`), compound tokens (`cat.`), and capitalization tokens (`\nOnce`) all require special-casing that makes the state machine brittle. The Trie was abandoned in favor of string-level validation.
- **String-level `LogitsProcessor` is the robust solution**: for each candidate token in top-k, simulate appending it to the current generated text, decode the candidate string, extract the last partial word at the string level, and check whether it is a prefix or complete member of the vocabulary. No tokenizer internals exposed; the check operates on human-readable strings.
- **Backtracking is implementable as a `DecisionPoint` stack**: each generation step with multiple valid tokens creates a `DecisionPoint` recording the position and remaining alternatives. On a dead-end, pop the stack, truncate the generation to the saved position, and try the next alternative. If the stack is exhausted, emit an out-of-vocabulary token (marked red) and continue — avoiding infinite loops.
- **Colorized token-level logging accelerates debugging**: green = passed constraint, blue = chosen via backtrack, red = out-of-vocabulary fallback. The contraction bug (`she's` → apostrophe treated as word boundary, `s` deemed illegal) was discovered and fixed through visual inspection of this log.
- **Vibe coding posture**: human acts as architect + tester + PM; AI handles implementation. The first conceptual error (token-whitelist) was caught by the human before the AI built it out. The Trie pivot was also human-initiated. The AI is described as "a gifted but guidance-needing junior developer."
- **Hiring signal**: the challenge reveals whether a candidate understands tokenization deeply enough to catch the token-whitelist error and propose the Trie, and whether they can execute quickly via vibe coding. Candidates who cannot articulate the sub-word structure problem cannot direct the AI to correct it.

## Visual observations

*No load-bearing images — all panels are terminal-output screenshots; content fully extracted into Key claims above.*

## What this changes

- **Adds a concrete worked example** of string-level `LogitsProcessor` design to the [[Constrained Decoding]] topic — the string-simulation-then-validate pattern sidesteps tokenizer internals cleanly.
- **Extends the vibe-coding-as-hiring-filter pattern** from the hallucination-detector challenge ([[2025-08-19-又一道-vibe-coding-面试题-基于注意力的-llm-幻觉检测器]]): a second [[Pine AI]] interview problem where the conceptual depth test IS the vibe-coding test.

## Entities touched

[[Bojie Li]], [[Pine AI]], [[Cursor]]

## Topics touched

[[Constrained Decoding]], [[Minimal-Implementation Pedagogy]]

## Raw source

[01.me/2025/07/constrained_sampling_vibe_coding](https://01.me/2025/07/constrained_sampling_vibe_coding/) — Chinese-language blog post · 5 images (terminal screenshots) · code linked as external `.py`. Read 2026-05-15.
