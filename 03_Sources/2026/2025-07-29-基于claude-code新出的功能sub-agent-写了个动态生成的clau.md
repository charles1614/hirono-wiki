---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://linux.do/t/topic/824930
tags: [tooling, production-deployment]
---

# [2025-07-29] 基于 Claude Code Sub-agent 动态生成 CLAUDE.md 的实践讨论

## TL;DR

Linux.do 社区帖子，作者 anyme 分享了一套基于 Claude Code sub-agent 功能的智能 CLAUDE.md 动态生成系统，核心创新是利用 Claude 4 原生并行能力在项目目录下自动生成专用 sub-agent 配置，取代手工维护复杂的 CLAUDE.md。帖子收获 50+ 回复，讨论了 MCP 集成、global vs project 级 CLAUDE.md、以及 CLAUDE.md 内容约束原则。

## Key claims

- 作者提供两个版本：满血版（20.5 KB）和精简版（3.4 KB），推荐日常用精简版以减少每轮对话 token 消耗。
- Sub-agent 的最佳实践：不在 CLAUDE.md 直接写 agent，而是让系统在项目目录下的 `.claude/agents/` 文件夹中动态生成；官方已支持 `/agents` 命令和 `commands` 触发。
- 全局 CLAUDE.md 放在 `~/.claude/`，项目级 CLAUDE.md 放在项目根目录，二者互不冲突。
- 社区贡献者 desineyli 补充了一套高质量 CLAUDE.md 规则片段：文件≤300 LOC、函数≤50 行、类≤100 行、强制完整阅读文件再修改，并要求 LLM 承认不确定性。
- 另一社区帖（context-engineering-intro）推荐在 CLAUDE.md 加入 KISS、YAGNI、SOLID、依赖倒置、开闭原则等设计理念，作为 sub-agent 协作的基础约束。
- agent 配置类修改需要重启 Claude Code 才能生效（/agents 命令刷新不到新创建的 agent）。

## Visual observations

![](../../raw/raindrop/linux.do/2025-07-29-基于claude-code新出的功能sub-agent-写了个动态生成的clau/linuxdo-img-001.jpg)

*Other images decorative — screenshot of agent not appearing in /agents list.*

## What this changes

Claude Code sub-agent 功能开放后，CLAUDE.md 的最佳实践正从"大而全的全局规则"转向"最小基础规则 + 动态生成专用 agent"的分层架构，有助于降低每轮对话 context 消耗。

## Entities touched

[[Claude Code]], [[Claude]]

## Topics touched

[[Agentic AI Infrastructure]]

## Raw source

[linux.do/t/topic/824930](https://linux.do/t/topic/824930) — community discussion, anyme, 2025-07-29, forum thread. Read 2026-05-15.
