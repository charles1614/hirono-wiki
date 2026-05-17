---
created: 2026-05-15
updated: 2026-05-17
type: entity
refs: 5
tier: active
---

# Torchtitan

PyTorch-native large-scale LLM training framework using torch.compile and DTensor

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Torchtitan 是 `torch.compile` 原生的大模型训练框架，展示如何将 PyTorch 原生功能（torch.compile、DTensor、FSDP2、AutoParallel、SimpleFSDP）组合实现大规模训练；Edward Yang 推荐大规模训练团队以 fork torchtitan 作为训练栈起点，替换关心的组件，保留其他部分。 — [[2025-09-04-torch-compile-训练的现状总结-2025年8月]]
- [[TorchTitan RL]] (May 2026 PyTorch DevLog) uses Torchtitan's single unified model definition for both training and inference, enabling shared [[Torch Compile]] artifacts across trainer and generator — yields a 6× end-to-end RL speedup on Qwen3 0.6B / GSM8K (446s → 70s). — [[2026-05-12-pytorch-devlog]]
