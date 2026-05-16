---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://github.com/jesseduffield/lazydocker
tags: [tooling, production-deployment]
---

# [2025-05-28] lazydocker: Terminal UI for Docker Management

## TL;DR

lazydocker 是一个用 Go 编写的终端 UI 工具，基于 gocui 库，将 docker 和 docker-compose 的常用操作集成到单一键位驱动界面，解决多终端窗口管理 container 的痛点。

## Key claims

- [[lazydocker]] 支持 Docker >= 29.0.0（API >= 1.24）和 Docker Compose >= 1.23.2，可通过 Homebrew（`brew install lazydocker`）、Scoop、Chocolatey、AUR、Go install 或 Docker 镜像安装。
- 核心功能：一键查看所有 container/service 状态和日志、ASCII 指标图表（可自定义）、attach/restart/remove/rebuild container、查看 image 层、prune 无用资源；支持鼠标操作。
- 使用 `--cpu-offload-gb` 风格的直观参数设计理念（见 vLLM PR #6496）相通：将复杂 CLI 操作收敛为单键操作，降低认知负担。
- 项目由 Jesse Duffield（也是 lazygit 作者）维护，GitHub Sponsors 资助，有超过 80 位赞助商；由 Go 1.8+ 构建，单二进制。

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## Entities touched

[[lazydocker]]

## Topics touched

## Raw source

[github.com/jesseduffield/lazydocker](https://github.com/jesseduffield/lazydocker) — GitHub README, jesseduffield/lazydocker. Read 2026-05-16.
