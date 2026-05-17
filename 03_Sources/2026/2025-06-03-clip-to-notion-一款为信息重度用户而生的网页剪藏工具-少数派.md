---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://sspai.com/post/99591
tags: [tooling]
---

# [2025-06-03] Copy to Notion：一款为信息重度用户而生的网页剪藏工具

## TL;DR

对Copy to Notion（第三方[[Notion]]网页剪藏浏览器扩展）的深度评测：功能、隐私架构、优缺点及Roadmap，对比官方Web Clipper，重点揭示其数据中转架构（浏览器→copytonotion.com服务器→Notion API）的隐私含义。

## Key claims

- Copy to Notion由开发者Idriss Ait Hafid个人开发，用户超13,000人；支持全文剪藏、选区、截图、书签，并可映射到Notion数据库字段模板，自动提取主体内容过滤广告/导航。
- 高级功能：CSS Selector可定向提取任意`document.querySelector()`可获取的DOM元素，满足技术用户的精确提取需求。
- 隐私架构关键发现：剪藏数据并非直达Notion，而是经由`copytonotion.com`中转服务器代理调用Notion OAuth API；数据路径：浏览器采集→HTTPS POST至开发者服务器→后端转发至Notion。
- 权限设计克制：仅申请activeTab权限，不申请后台运行或持久监听；操作需用户主动触发。
- 局限：免费版剪藏数量上限偏低；无移动端支持；闭源（但Chrome扩展本地代码可通过开发者工具审查）；Roadmap包括移动端App和无弹窗快捷保存。
- 替代选择：如对隐私敏感，可考虑Save to Notion等开源插件（所有逻辑留在浏览器本地，代码公开可审计）。

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## Entities touched

[[Notion]]

## Topics touched

[[PKM Tooling]]

## Raw source

[sspai.com/post/99591](https://sspai.com/post/99591) — 少数派Matrix，2025-06-03。Read 2026-05-16.
