---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/emKvuW8RyIBM8otkypCLRw
tags: [inference, observability]
---

# [2025-12-29] 【译】Kubernetes 中的 GPU 调度：从 Device Plugin 到 Operator 的边界与下一步

## TL;DR
比较 NVIDIA Device Plugin 与 NVIDIA GPU Operator 在 Kubernetes 中管理 GPU 的两种架构路径。Device Plugin 是轻量级手动方式，GPU Operator 是通过 CRD + controller 实现全栈自动化的元 Operator。选择取决于集群规模与运维能力。

## Key claims
- [[NVIDIA]] Device Plugin 以 DaemonSet 形式实现 Kubernetes 设备插件框架，通过 gRPC + NVML 将 GPU 暴露为 `nvidia.com/gpu` 资源，但要求节点预装驱动、containerd 及 nvidia-container-toolkit。
- GPU Operator 是"元 Operator"，通过 ClusterPolicy CRD 统一管理 driver DaemonSet、container toolkit、Device Plugin、DCGM Exporter、MIG Manager 等多个容器化组件，`helm install gpu-operator` 一条命令完成全栈部署。
- GPU Operator 并非替代 Device Plugin，而是将其纳入自动化管理体系，同时附加 GPU Feature Discovery（GFD）节点标签、DCGM 监控、MIG 分区等增值能力。
- 对比表：Device Plugin 适合小型/托管环境，极小资源开销，最大手动控制；GPU Operator 适合大规模企业级、混合云场景，支持 vGPU、GPUDirect、时分复用，但组件更多。
- KuberneteS GPU 管理边界正从手动配置走向全自动化，Platform team 与 AI 工程师的协作范式取决于 Device Plugin vs Operator 的分工选择。

## Visual observations
*No load-bearing images — diagrams are architectural illustrations (Device Plugin flow, GPU Operator flow) that duplicate prose already captured above.*

## Entities touched
[[NVIDIA]], [[CUDA]]

## Topics touched
[[GPU Resource Partitioning]], [[Multi-Tenancy on GPUs]]

## Raw source
[mp.weixin.qq.com/2026-02-12-译-kubernetes-中的-gpu-调度-从-device-plugin-到](https://mp.weixin.qq.com/s/emKvuW8RyIBM8otkypCLRw) — WeChat public account 几米宋, translated from thenewstack.io, published 2025-12-29. Read 2026-05-15.
