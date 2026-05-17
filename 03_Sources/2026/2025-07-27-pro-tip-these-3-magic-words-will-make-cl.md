---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://www.reddit.com/r/ClaudeAI/comments/1gqcsn6/pro_tip_these_3_magic_words_will_make_claude/?share_id=QBQIbDkoZ_g_sfMYsmMp1&utm_content=2&utm_medium=ios_app&utm_name=iossmf&utm_source=share&utm_term=22
tags: [tooling, production-deployment]
---

# [2024-11-13] Pro Tip: KISS, YAGNI, SOLID Make Claude Write Better Code

## TL;DR

Reddit r/ClaudeAI post (score 498) by u/philip_laureano: adding KISS, YAGNI, and SOLID principles to Claude prompts dramatically reduces code bloat and over-engineering. The author reports using Claude Haiku 3.5 via API and cutting output size roughly in half while maintaining correctness. Top comment by u/ainomege provides a detailed ~800-token system prompt scaffold that encodes these principles as structured behavioral directives.

## Key claims

- KISS/YAGNI/SOLID can be used verbatim without explanation — Claude understands the acronyms even on Haiku 3.5 without Sonnet-level capability.
- Best workflow: (1) discuss requirements and let Claude ask clarifying questions; (2) challenge Claude to find simpler approaches; (3) agree on requirements before writing any code; (4) have Claude write tests alongside code and fix failures immediately; (5) explicitly tell Claude to wait for permission before writing code.
- u/ainomege's ~800-token structured system prompt uses pseudo-code syntax (`ENFORCE { ... }`, `VALIDATE_AGAINST { ... }`) that Claude interprets as machine-readable behavioral directives — reportedly created by Claude itself when asked to optimize a prompt for LLM adherence.
- A commenter (u/Lirendium) argues SOLID over-complicates designs and recommends KISS + YAGNI + DRY as the minimal effective set; author acknowledges SOLID has surface-compliance issues on complex codebases.
- On context window: the 800-token system prompt is negligible vs 200K available context; the author reports sending full codebases 20–30× per day and staying within Haiku 3.5's 50M daily token limit.
- Author's lesson learned: LLMs lack recursive reasoning for robust multi-layer designs and always require human code review.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[Claude]], [[Claude Code]]

## Topics touched

[[Educational LLM Tooling]]

## Raw source

[reddit.com/r/ClaudeAI/comments/1gqcsn6](https://www.reddit.com/r/ClaudeAI/comments/1gqcsn6/pro_tip_these_3_magic_words_will_make_claude/?share_id=QBQIbDkoZ_g_sfMYsmMp1&utm_content=2&utm_medium=ios_app&utm_name=iossmf&utm_source=share&utm_term=22) — Reddit discussion, u/philip_laureano, 2024-11-13, community thread. Read 2026-05-15.
