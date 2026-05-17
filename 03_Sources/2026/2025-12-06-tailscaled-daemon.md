---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://tailscale.com/kb/1278/tailscaled#environment-variables
tags: [tooling, production-deployment]
---

# [2026-01-05] tailscaled Daemon — Tailscale Docs

## TL;DR

Tailscale官方文档对tailscaled守护进程的完整参考：平台差异（Linux/macOS/Windows）、启停方法、日志获取、命令行参数（TUN设备、UDP端口、状态存储、SOCKS5/HTTP代理）以及Windows环境变量配置。

## Key claims

- 平台分布：Linux/Unix以systemd服务运行，macOS（非GUI版本）以launchd服务运行，Windows以名为"Tailscale"的系统服务运行；macOS GUI版本将所有组件捆绑成单一二进制，技术上不是`tailscaled`，某些`tailscaled` flag选项在macOS GUI变体中不可用。
- 关键命令行参数：`--tun=NAME`（TUN设备名，或`userspace-networking`纯用户态）、`--port=N`（UDP监听端口，0自动选择）、`--state=`（支持本地路径、`kube:<secret-name>`、`arn:aws:ssm:...`、`mem:`临时节点）、`--encrypt-state`（Linux TPM加密状态文件）。
- 代理支持：`--socks5-server=[host]:port` 运行SOCKS5服务器，`--outbound-http-proxy-listen=[host]:port` 运行HTTP代理；两者可共用同一端口，自动按客户端协议区分。
- Linux flag配置：修改`/etc/default/tailscaled`中的`FLAGS`变量，由systemd单元定义引用。
- Windows环境变量：在`C:\ProgramData\Tailscale\tailscaled-env.txt`中设置（如`PORT=N`），`net stop Tailscale` + `net start Tailscale`生效。

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[Tailscale]]

## Topics touched

[[GPU Cluster Networking]]

## Raw source

[tailscale.com/kb/1278/tailscaled](https://tailscale.com/kb/1278/tailscaled#environment-variables) — Tailscale官方文档，last validated 2026-01-05. Read 2026-05-15.
