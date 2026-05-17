---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/J70fP6fFccq2D7TC0hLAiw
tags: [training-infrastructure, gpu-networking, research-paper, chinese-source]
---

# [2025-12-19] 火山引擎 Force 大会发布 veRoCE 传输协议！

## TL;DR

字节跳动在 2025 年 12 月 18 日 Force 大会上正式发布自研高性能 RDMA 传输协议 veRoCE，从源头解决 RoCEv2 依赖 PFC 无损网络和不支持多路径传输两大关键局限，在 128 GPU 集群中 LLM 训练速度较 RoCEv2 提升约 11.2%，AlltoAll 通信吞吐提升约 48.4%。

## Key claims

- 传统 RoCEv2 存在两大关键局限：依赖 PFC 无损网络（大规模组网中 PFC 极易引发稳定性问题）；不支持多路径传输（ECMP 冲突导致带宽浪费）。
- veRoCE 原生支持多路径传输（修改源端熵值、交换机报文喷洒两种模式），通过 DDP（Direct Data Placement）让乱序数据无需等待保序即可直接交付应用，对所有语义（RDMA Write/Read、Send/Recv、Atomics）原生支持乱序接收。
- 高效重传机制：基于 SACK 的选择性重传 + lazy SACK 智能区分乱序报文和丢包报文，确保多路径场景下高效运行。
- 多路径拥塞控制：路径粒度与连接粒度两种模式，拥塞信号与可靠传输完全解耦；基于报文序列号的快速慢路径检测算法以最小开销定位并剔除慢路径。
- 兼容性：支持通用 verbs 接口，与 RoCEv2 网卡互通时自动回退到 RoCEv2 模式，降低迁移部署门槛。
- 性能基准（128 GPU 集群）：LLM 训练速度提升约 11.2%；AlltoAll 通信吞吐提升约 48.4%；2% 丢包率下有效吞吐仍达网卡带宽 95.7%（RoCEv2 在此场景下通信中断）。
- 字节跳动正与 [[NVIDIA]]、[[AMD]]、[[Broadcom]]、云脉芯联、比特智路等厂商合作，支持 400G/800G/1.6T 网卡，欢迎更多设备厂商与云厂商参与。

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## What this changes

veRoCE 代表了超大规模 AI 训练集群网络协议从依赖 PFC 无损以太网向无 PFC 多路径传输的方向性转变，与 [[NCCL]] 等通信库的配合使字节跳动具备了自主可控的全栈 GPU 集群通信能力。

## Entities touched

[[NVIDIA]], [[AMD]], [[Broadcom]], [[NCCL]]

## Topics touched

[[GPU Cluster Networking]], [[Training Infrastructure]]

## Raw source

[mp.weixin.qq.com/s/J70fP6fFccq2D7TC0hLAiw](https://mp.weixin.qq.com/s/J70fP6fFccq2D7TC0hLAiw) — 火山引擎Agent社区 WeChat公众号, 2025-12-19, Chinese. Read 2026-05-15.
