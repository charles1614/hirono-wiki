---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://zhuanlan.zhihu.com/p/29001189476
tags: [tooling, inference]
---

# [2025-04-12] MCP (Model Context Protocol)，一篇就够了

## TL;DR

面向使用者视角的[[MCP Protocol]]完整教程：解释MCP的必要性（替代平台相关的function call）、三层架构（Host/Client/Server）、现有生态资源，并以Claude 3.7构建一个统计桌面TXT文件数量的MCP Server为实战收尾。

## Key claims

- MCP由Anthropic于2024年11月25日发布，定位为LLM与外部数据源/工具之间的"USB-C万能转接头"，解决不同平台function call API不兼容（OpenAI vs Google等）的碎片化问题。
- 三层架构：Host（如Claude Desktop）运行MCP Client，Client与MCP Server通信，Server封装具体数据源或工具能力；Host与Server之间的数据安全由用户自控（敏感数据留本地）。
- 生态资源：官方提供Awesome MCP Servers、mcpservers.org等目录，filesystem工具允许Claude读写本地文件；官方Claude Desktop Quick Start提供零配置上手路径。
- MCP Python SDK用FastMCP封装工具声明，`@mcp.tool()`装饰器即可暴露工具；文中示例为Claude 3.7直接生成的Desktop TXT文件统计器，使用`uv`管理Python环境。
- function call的核心局限：平台绑定性强（OpenAI/Google API不兼容），切换模型需重写代码；MCP的统一性使任何支持MCP的模型均可无缝复用同一Server。

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## Entities touched

[[Anthropic]], [[Claude]]

## Topics touched

[[MCP Protocol]], [[Educational LLM Tooling]]

## Raw source

[zhuanlan.zhihu.com/p/29001189476](https://zhuanlan.zhihu.com/p/29001189476) — LastWhisper，Zhihu专栏，2025-04-12。Read 2026-05-16.
