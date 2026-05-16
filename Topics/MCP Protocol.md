---
created: 2026-05-16
updated: 2026-05-16
type: topic
source_count: 1
---

# MCP Protocol

## What

Model Context Protocol: Anthropic standard for connecting AI models to external data sources and tools via a uniform interface

## Current understanding

_(stub — populate as sources accumulate. `topic-content-gaps` will lint-warn once source_count ≥ 3.)_

## Open threads

## Observations

- MCP由Anthropic于2024年11月25日发布，解决不同LLM平台function call不兼容的碎片化问题：Host（如Claude Desktop）运行Client，Client与Server通信；Server封装数据源/工具；任何支持MCP的模型可无缝切换Server，敏感数据可留本地；Python SDK通过`@mcp.tool()`装饰器暴露工具接口。 — [[2025-06-04-https-zhuanlan-zhihu-com-p-29001189476]]

## Sources drawn on

- [[2025-06-04-https-zhuanlan-zhihu-com-p-29001189476]] — 面向使用者的MCP全流程教程：协议动机、三层架构（Host/Client/Server）、生态目录、FastMCP Python SDK实战（Claude 3.7生成MCP Server代码）。
