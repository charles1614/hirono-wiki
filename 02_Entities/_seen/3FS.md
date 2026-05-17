---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# 3FS

DeepSeek open-source distributed file system for AI training and inference, supporting RDMA and NVMe SSD

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- 3FS（DeepSeek开源分布式文件系统）被集成为SGLang HiCache的持久化存储底座：采用存算分离架构，180节点集群可达6.6 TiB/s读取带宽；通过RDMA网络+NVMe SSD，结合USRBIO接口实现Page-wise零拷贝传输；阿里云开源的3FS Operator通过Kubernetes原生能力提供云原生化部署，支持声明式部署、故障自愈、弹性扩缩容、多租隔离。 — [[2025-12-14-阿里云-tair-联手-sglang-共建-hicache-构建面向-智能体式推]]
