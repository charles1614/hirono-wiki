---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://sspai.com/post/59368
tags: [tooling, production-deployment]
---

# [2025-07-29] 如何更好地清理 Time Machine 备份

## TL;DR

少数派博文（2020-03-07，blanboom）。介绍了三种清理 macOS Time Machine 备份的方法：使用 `tmutil` 命令行工具手动或脚本化批量删除旧备份、以「保留 50%」等比例的方式精简历史快照、以及用 BackupLoupe 深入分析备份空间占用后进行针对性清理。

## Key claims

- **`tmutil listbackups` + `tmutil delete`** 是 macOS 自带的基础接口，可在 shell 脚本中批量删除指定日期前的备份。
- 第三方脚本 `tmcleanup.sh`（blanboom fork）支持按「保留天数」或「保留 50%/25%/75% 快照」两种模式清理，连续执行两次可实现保留 25%（近似每月一份）的效果。
- Time Machine 原生只能保留每周快照；要保留「每两周一份」或「每月一份」的历史版本需借助外部脚本。
- **BackupLoupe** 提供两维分析：哪些备份快照占用空间最大；备份内哪些文件/目录占用空间最大（Steam 游戏库、虚拟机、iOS 模拟器等）。BackupLoupe 只分析不清理，实际删除仍需 `tmutil`。

## Visual observations

**Time Machine 备份保留策略示意图** — Time Machine's native tiered-retention schedule: hourly for 24 h, daily for a month, weekly thereafter. Shows the temporal granularity cliff that motivates custom pruning scripts.

![Time Machine 备份保留策略示意图，展示按小时/天/周递减保留的层级结构](https://hirono-wiki.litenext.digital/raindrop/sspai.com/2025-07-29-如何更好地清理-time-machine-备份-少数派/sspai-img-001.png)

**BackupLoupe 空间占用树形视图** — UI screenshot of BackupLoupe showing per-snapshot and per-directory space usage as a tree. Visual spatial layout (proportional bars + hierarchy) carries meaning beyond a prose list.

![BackupLoupe 界面截图，显示各备份快照及目录的空间占用树形分析视图](https://hirono-wiki.litenext.digital/raindrop/sspai.com/2025-07-29-如何更好地清理-time-machine-备份-少数派/sspai-img-002.png)

## Entities touched

[[Time Machine]], [[tmutil]], [[BackupLoupe]]

## Raw source

[sspai.com/post/59368](https://sspai.com/post/59368) — 少数派短文 · ~3.5 KB · 2 截图 · 2020-03-07 发表，2026-05-15 采集。
