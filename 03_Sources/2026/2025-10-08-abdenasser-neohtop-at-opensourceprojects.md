---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://github.com/Abdenasser/neohtop
tags: [tooling]
---

# [2025-10-08] NeoHtop — Cross-Platform System Monitor (GitHub README)

## TL;DR

[[NeoHtop]] 是一款基于 Svelte、Rust 和 Tauri 构建的跨平台现代系统监控器，提供实时进程监控、CPU/内存追踪、深色/浅色主题，以及进程搜索/过滤/固定/杀死等功能。

## Key claims

- NeoHtop 技术栈：前端 SvelteKit + TypeScript，后端 Rust + Tauri，样式 CSS Variables，图标 FontAwesome；支持 macOS、Linux、Windows。
- 安装方式包括：Homebrew（macOS，`brew install --cask neohtop`）、AUR（Arch Linux，`yay -S neohtop`）、Fedora Terra 仓库、Scoop（Windows）、Solus eopkg；官方构建仅通过 GitHub Releases 提供，社区包为非官方维护。
- 搜索功能支持多词逗号分隔（`arm, x86`）、正则表达式（`d$` 匹配守护进程，`^(\w+\.)+\w+$` 匹配反向域名进程）。
- 配套推出 NeoHtop CLI（Go + Charm 生态构建），支持实时 CPU sparklines、内存条、进程树视图、主题，通过 `npm install -g neohtop-cli` 安装。
- 开发工作流：`npm run tauri dev`（开发模式），`npm run tauri build`（生产构建），代码格式化使用 Prettier（前端）+ `cargo fmt`（Rust）。

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## Entities touched

[[NeoHtop]]

## Topics touched

## Raw source

[github.com/Abdenasser/neohtop](https://github.com/Abdenasser/neohtop) — GitHub README，Abdenasser，2025-10-08 bookmark。Read 2026-05-15.
