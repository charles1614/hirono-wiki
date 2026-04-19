---
created: 2026-04-20T00:00:00.000Z
updated: '2026-04-19'
type: entity
refs: 4
tier: active
---

# MCP

Model Context Protocol. [[Anthropic]]'s open standard for letting LLM agents talk to external tools and data sources. Surfaces consistently in Anthropic-internal usage as the preferred integration layer over raw CLI calls — better audit, better permissioning, better composition.

## Synthesis

Thin (1 source). Pattern: when a team has a sensitive data source or a repeatable platform integration (BigQuery, Meta Ads), the recommended path is "build an MCP server" rather than "shell out to the CLI." This wiki itself uses MCP for the [[Raindrop]]-side integration.

## Observations

- Data Infrastructure team's recommendation: use MCP servers rather than the BigQuery CLI for sensitive data — better security control over what [[Claude Code]] can access. — [[2026-04-20-anthropic-teams-use-claude-code]]
- Growth Marketing built a Meta Ads MCP server for campaign-performance queries inside [[Claude.ai]] desktop. — [[2026-04-20-anthropic-teams-use-claude-code]]
- Legal team flags MCP integration security implications as a forward-looking concern as AI tools access more sensitive systems. — [[2026-04-20-anthropic-teams-use-claude-code]]
