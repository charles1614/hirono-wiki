---
created: 2026-04-20T00:00:00.000Z
updated: '2026-04-19'
type: entity
refs: 4
tier: active
---

# Claude.ai

[[Anthropic]]'s consumer-facing chat product. In the workflow patterns documented by Anthropic teams, Claude.ai sits **before** [[Claude Code]] — used for thinking through a task, fleshing out the design, and producing the prompt that Claude Code will execute against the codebase.

## Synthesis

Thin (1 source). Notable: the "plan in Claude.ai, build in [[Claude Code]]" two-step is consistent across multiple Anthropic teams (Legal, Growth Marketing). Implies these are complementary surfaces, not competing — Claude.ai is the discussion / spec-writing layer, Claude Code is the implementation layer.

## Observations

- Used as the planning surface in the "plan-in-Claude.ai → build-in-Claude-Code" two-step. Legal team explicitly: "brainstorm and plan with Claude.ai first, then move to Claude Code." — [[2026-04-20-anthropic-teams-use-claude-code]]
- Growth Marketing built a Meta Ads [[MCP]] server integrated with Claude.ai desktop for campaign analytics queries. — [[2026-04-20-anthropic-teams-use-claude-code]]
