---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://github.com/cooderl/wewe-rss
tags: [tooling]
---

# [2025] WeWe RSS — 微信公众号RSS生成工具

## TL;DR

[[WeWe RSS]]是基于微信读书API的微信公众号RSS生成器，支持私有化部署（Docker/Docker Compose），输出`.atom`/`.rss`/`.json`三种格式，支持全文内容输出和标题过滤，v2.x改用全新接口更稳定。

## Key claims

- 核心能力：订阅微信公众号、获取历史文章、后台定时更新、生成标准RSS feeds（支持全文内容，非仅摘要）、导出OPML。
- 高级功能：通过URL参数`title_include`/`title_exclude`过滤标题（支持正则/多选），支持`?update=true`手动触发单个feed更新。
- 部署方式：Docker Compose（MySQL推荐）或SQLite单容器，也支持Zeabur/Railway/Hugging Face一键部署；Docker Compose示例见项目内`docker-compose.yml`和`docker-compose.sqlite.yml`。
- 认证流程：扫码登录微信读书授权后，后台持续拉取已订阅公众号的新文章，无需在微信客户端中手动操作。

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## Entities touched

[[WeWe RSS]]

## Topics touched

[[PKM Tooling]]

## Raw source

[github.com/cooderl/wewe-rss](https://github.com/cooderl/wewe-rss) — cooderl，GitHub repository。Read 2026-05-16.
