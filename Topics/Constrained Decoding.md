---
created: 2026-05-15
updated: 2026-05-15
type: topic
source_count: 1
---

# Constrained Decoding

## What

Techniques that force an LLM's token sampling to respect an external constraint (vocabulary allowlist, grammar, schema) by modifying logit scores at each decoding step, rather than filtering outputs post-generation.

## Current understanding

Constrained decoding intervenes at the logit level during autoregressive generation so that invalid tokens are assigned probability −∞ before sampling. The central design question is how to define "valid" efficiently at each step.

**String-level `LogitsProcessor` (vocabulary allowlist)** ([[2025-08-19-用-vibe-coding-解决-llm-限制采样的面试题]]): for a 3,000-word allowlist, the cleanest implementation avoids tokenizer internals entirely. For each top-k candidate token, simulate appending it to the current generated text, decode the full candidate string, extract the last partial word at the string boundary, and check whether it is a prefix or complete member of the vocabulary. Tokens that produce an invalid partial word are masked. This bypasses the tokenizer edge-case zoo (space-prefixed tokens, compound tokens, capitalization variants) that makes token-level Trie matching brittle.

A naive token-whitelist approach — building a set of token IDs corresponding to vocabulary words and sampling only from that set — fails because multi-token words (e.g. `apple` → `ap` + `ple`) can never be completed: `ple` alone is not in the vocabulary, so it is masked even when it legitimately continues `ap`.

A Trie-based approach is theoretically correct (prefix matching on the character sequence of partial words) but requires extensive special-casing for tokenizer artifacts; the string-simulation approach achieves the same semantic guarantee with far less state.

**Backtracking** can be layered on top: maintain a `DecisionPoint` stack recording generation positions where multiple valid tokens existed. On a dead-end (all continuations masked), pop the stack, truncate to the saved position, and resume from the next alternative. Exhausting the stack triggers an out-of-vocabulary fallback token to prevent infinite loops.

## Open threads

## Sources drawn on

_(populated as Sources wikilink this Topic; cite each with one-line relevance.)_
