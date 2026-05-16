---
created: 2026-05-16
updated: 2026-05-16
type: topic
source_count: 3
---

# PKM Tooling

## What

Personal knowledge management tools for capturing, organizing, and retrieving information (web clippers, note-taking apps, RSS)

## Current understanding

_(stub — populate as sources accumulate. `topic-content-gaps` will lint-warn once source_count ≥ 3.)_

## Open threads

## Observations

- Copy to Notion（13,000+用户）填补Notion官方Web Clipper的全文还原不足：CSS Selector精确提取、数据库字段模板映射；但数据经由copytonotion.com中转，隐私模型依赖开发者自律；开源替代Save to Notion所有逻辑留本地。 — [[2025-06-03-clip-to-notion-一款为信息重度用户而生的网页剪藏工具-少数派]]
- WeWe RSS基于微信读书API生成微信公众号RSS（.atom/.rss/.json全文输出），支持Docker私有化部署，v2.x接口更稳定；标题过滤通过URL参数实现（title_include/title_exclude），是将微信生态内容引入RSS订阅体系的主要工具。 — [[2025-06-03-cooderl-wewe-rss-更优雅的微信公众号订阅方式-支持私有化部署-微]]

## Sources drawn on

- [[2025-06-03-clip-to-notion-一款为信息重度用户而生的网页剪藏工具-少数派]] — Copy to Notion深度评测：功能、隐私架构（数据中转）、优缺点及Roadmap。
- [[2025-06-03-cooderl-wewe-rss-更优雅的微信公众号订阅方式-支持私有化部署-微]] — WeWe RSS：微信公众号RSS私有化部署工具，功能和部署文档。
