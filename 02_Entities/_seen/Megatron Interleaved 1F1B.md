---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# Megatron Interleaved 1F1B

interleaved pipeline parallelism schedule in Megatron-LM enabling compute-communication overlap

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Megatron Interleaved 1F1B（VP>1）稳态阶段 overlap 成立的两个条件：(1) 相邻计算与通信无依赖（send_forward_recv_forward 可与 Backward 并行执行），(2) 发起通信时对端已准备好数据（排布设计保证数据就绪）；Native 1F1B 因 send_forward_recv_backward 直接用于下一步 backward_step，存在强依赖，无法 overlap。 — [[2025-08-25-megatron-interleaved-1f1b流水线并行中的计算负载不均衡问]]
- 计算负载不均衡（最后一个流水线 Stage 含额外 Logit & Loss 计算）破坏 Interleaved 1F1B 的 overlap：实验（PP=4, VP=2, 4×A100, GBS=8）显示 GPU 0/1/2 出现通信等待 bubble；随 GBS 扩大至 16/32，周期性通信延迟出现于稳态阶段；root cause：前序 Mini Batch 在 GPU 3 Chunk 1 的额外计算累积推后了后续 Mini Batch 的前向传播时间点。 — [[2025-08-25-megatron-interleaved-1f1b流水线并行中的计算负载不均衡问]]
