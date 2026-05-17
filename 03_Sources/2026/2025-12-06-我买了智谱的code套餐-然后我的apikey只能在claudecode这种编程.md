---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://linux.do/t/topic/1279145/13
tags: [tooling, production-deployment]
---

# [2025-12-06] 智谱GLM Coding套餐API接入Cherry Studio等第三方客户端

## TL;DR

Linux.do论坛问答帖：用户询问智谱GLM Coding Plan的API Key如何在Claude Code以外的客户端（如Cherry Studio）中使用，社区解答为使用Coding专属端点 `https://open.bigmodel.cn/api/coding/paas/v4` 而非通用API端点。

## Key claims

- 智谱GLM Coding Plan使用专属API端点 `https://open.bigmodel.cn/api/coding/paas/v4`，而非通用API端点；使用通用端点会按token计费而非消费套餐额度。
- 在Cherry Studio等客户端中，新建Anthropic兼容提供商，填入上述Coding专属端点即可使用套餐额度。
- 额度管理：输入token够就放行请求，输出超额抹0不溢出；智谱coding套餐不完全按量计费，有模糊调用量限制。
- 智谱文档 `docs.bigmodel.cn/cn/coding-plan/tool/others` 有完整的第三方工具接入说明。

## Visual observations

*No load-bearing images — all panels are UI screenshots of API configuration dialogs, content captured in key claims.*

## Entities touched

[[GLM Coding Plan]]

## Topics touched

[[LLM Inference Systems]]

## Raw source

[linux.do/t/topic/1279145](https://linux.do/t/topic/1279145/13) — Linux.do论坛，26楼帖子，标签"快问快答、人工智能、ChatGPT"，2025年12月6日. Read 2026-05-15.
