---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# Tailscale

VPN/overlay network software using WireGuard, with tailscaled daemon for cross-platform mesh networking

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- tailscaled守护进程（官方文档，last validated 2026-01-05）：Linux以systemd服务运行，macOS（非GUI版）以launchd服务运行，Windows以系统服务运行；关键flag：`--tun=userspace-networking`（纯用户态无内核支持）、`--state=mem:`（临时节点不持久化）、`--state=kube:<secret-name>`（K8s Secret存储）；SOCKS5和HTTP代理可共用同一端口；Linux通过`/etc/default/tailscaled`中的`FLAGS`修改flag；Windows通过`C:\ProgramData\Tailscale\tailscaled-env.txt`设置环境变量。 — [[2025-12-06-tailscaled-daemon]]
